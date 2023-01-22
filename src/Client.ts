import { Socket } from 'socket.io';
import { IDisposable } from './interfaces/IDisposable';
import { exec, spawn } from 'child_process';
import { Stream, Readable } from 'stream';
import fs from 'fs/promises';
import fsx from 'fs-extra';
import os from 'os';
import path from 'path';
import tar from 'tar-fs';
import { formatISO } from 'date-fns';
import glob from 'glob';

export class Client implements IDisposable {
  private buildRunning = false;
  private buildCancellationController = new AbortController();

  constructor(private readonly socket: Socket) {
    this.buildStart = this.buildStart.bind(this);
    this.buildCancel = this.buildCancel.bind(this);
    this.startLogStream = this.startLogStream.bind(this);
    this.stopLogStream = this.stopLogStream.bind(this);
    socket.on('build/start', this.buildStart);
    socket.on('build/cancel', this.buildCancel);
    socket.on('build/logs/start', this.startLogStream);
    socket.on('build/logs/stop', this.stopLogStream);
  }

  async buildStart(files: Buffer) {
    this.buildRunning = true;
    const buildId = formatISO(new Date(), { format: 'basic' }).replace(
      /[^A-Za-z0-9]/g,
      ''
    );
    // const buildId = '20230122T1321430600';
    const fp = path.join(process.cwd(), '.builds', buildId);
    console.log(fp);
    await fsx.ensureDir(fp, 0o2777);

    new Readable({
      read() {
        this.push(files);
        this.push(null);
      },
    }).pipe(tar.extract(fp, { readable: true, writable: true }));

    // We yarn/npm install locally to ensure any platform-specific modules don't affect building
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(`yarn install`, { shell: true, cwd: fp });
      proc.stdout.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.on('error', (err) => {
        reject(err);
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });

    // Ensure ios folder exists
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('CI=1 npx expo prebuild', { shell: true, cwd: fp });
      proc.stdout.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.on('error', (err) => {
        reject(err);
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });

    const iosPath = path.join(fp, 'ios');

    const xcWorkspaceFile = await new Promise<string>((resolve, reject) => {
      glob(path.join(iosPath, '*.xcworkspace'), (err, matches) => {
        if (matches.length === 0) {
          reject('No XCWorkspace file found');
        }
        resolve(path.basename(matches[0]));
      });
    });

    const scheme = xcWorkspaceFile.split('.')[0];

    // Create archive
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        `xcodebuild -configuration Debug -workspace ${xcWorkspaceFile} -scheme ${scheme} archive -archivePath "${path.join(
          iosPath,
          `${scheme}.xcarchive`
        )}"`,
        { shell: true, cwd: iosPath }
      );
      proc.stdout.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.stderr.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.on('error', (err) => {
        reject(err);
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });

    // Export archive
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        `xcodebuild -archivePath "${path.join(
          iosPath,
          `${scheme}.xcarchive`
        )}" -exportArchive -exportPath "${iosPath}" -exportOptionsPlist "${path.join(
          iosPath,
          '../../../stubExportOptions.plist'
        )}"`,
        { shell: true, cwd: iosPath }
      );
      proc.stdout.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.stderr.on('data', (msg: Buffer) => {
        console.log(msg.toString().trim());
      });
      proc.on('error', (err) => {
        reject(err);
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  }

  buildCancel() {
    if (this.buildRunning) {
      this.buildCancellationController.abort();
    }
  }

  startLogStream() {}

  stopLogStream() {}

  dispose(): void | Promise<void> {
    this.socket.off('build/start', this.buildStart);
    this.socket.off('build/cancel', this.buildCancel);
    this.socket.off('build/logs/start', this.startLogStream);
    this.socket.off('build/logs/stop', this.stopLogStream);
  }
}
