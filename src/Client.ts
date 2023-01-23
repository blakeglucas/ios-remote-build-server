import { Socket } from 'socket.io';
import { IDisposable } from './interfaces/IDisposable';
import { exec, spawn } from 'child_process';
import { Stream, Readable, Writable } from 'stream';
import fs from 'fs/promises';
import fsx from 'fs-extra';
import os from 'os';
import path from 'path';
import tar from 'tar-fs';
import { formatISO } from 'date-fns';
import glob from 'glob';
import { CommandRunner } from './CommandRunner';
import { create } from 'xmlbuilder2';
// @ts-ignore
import ignoreParser from '@gerhobbelt/gitignore-parser';

export class Client implements IDisposable {
  private buildRunning = false;
  private buildCancellationController = new AbortController();

  constructor(private readonly socket: Socket) {
    this.buildStart = this.buildStart.bind(this);
    this.buildCancel = this.buildCancel.bind(this);
    socket.on('build/start', this.buildStart);
    socket.on('build/cancel', this.buildCancel);
  }

  async buildStart(
    files: Buffer,
    developmentTeamId: string,
    exportOptionsPlist?: Buffer,
    provisioningProfile?: Buffer,
    provisioningSpecifier?: string
  ) {
    this.buildRunning = true;
    const buildId = formatISO(new Date(), { format: 'basic' }).replace(
      /[^A-Za-z0-9]/g,
      ''
    );
    // const buildId = '20230123T1339560600';
    const fp = path.join(process.cwd(), '.builds', buildId);
    await fsx.ensureDir(fp, 0o2777);

    new Readable({
      read() {
        this.push(files);
        this.push(null);
      },
    }).pipe(tar.extract(fp, { readable: true, writable: true }));

    this.logMessage('Beginning yarn install');

    // We yarn/npm install locally to ensure any platform-specific modules don't affect building
    const yarnInstallCode = await CommandRunner('yarn install', fp, {
      onStdOut: (msg) => this.onStdOut(msg),
      onStdErr: (msg) => this.onStdErr(msg),
    });

    this.logMessage(`yarn install finished with code ${yarnInstallCode}`);

    console.log(this.socket.handshake.address);
    const prebuildCode = await CommandRunner(
      `REACT_NATIVE_PACKAGER_HOSTNAME=${this.socket.handshake.address} CI=1 npx expo prebuild`,
      fp,
      {
        onStdOut: (msg) => this.onStdOut(msg),
        onStdErr: (msg) => this.onStdErr(msg),
      }
    );

    this.logMessage(`expo prebuild finished with code ${prebuildCode}`);

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

    if (!provisioningSpecifier && !provisioningProfile) {
      throw new Error(
        'One of provisioningSpecifier or provisioningProfile need to be provided'
      );
    }

    let provisioningSpecifierSafe = provisioningSpecifier;

    if (provisioningProfile && !provisioningSpecifier) {
      const provisioningProfilePath = path.join(
        iosPath,
        `${buildId}.mobileprovision`
      );
      await fs.writeFile(provisioningProfilePath, provisioningProfile);
      const provisioningUUID = await new Promise<string>((resolve, reject) => {
        CommandRunner(
          `security cms -D -i ${buildId}.mobileprovision | plutil -extract UUID raw -o - -`,
          iosPath,
          {
            onStdOut: (msg) => {
              resolve(msg);
            },
          }
        );
      });
      // Install provisioning profile
      const installCode = await CommandRunner(
        `open /Applications/Xcode.app ${provisioningProfilePath}`,
        iosPath
      );
      if (installCode !== 0) {
        this.logError('error installing provisioning profile :(');
      }
      provisioningSpecifierSafe = provisioningUUID;
    }

    // Create archive
    const archiveRet = await CommandRunner(
      `xcodebuild -configuration Debug -workspace ${xcWorkspaceFile} -scheme ${scheme} archive -archivePath "${path.join(
        iosPath,
        `${scheme}.xcarchive`
      )}" -allowProvisioningUpdates DEVELOPMENT_TEAM=${developmentTeamId} ${
        provisioningProfile
          ? 'PROVISIONING_PROFILE_SPECIFIER=' + provisioningSpecifierSafe
          : ''
      } CODE_SIGN_STYLE=Manual`,
      iosPath,
      {
        onStdOut: (msg) => this.onStdOut(msg),
        onStdErr: (msg) => this.onStdErr(msg),
      }
    );

    if (archiveRet !== 0) {
      return;
    }

    const exportOptionsPlistPath = path.join(iosPath, `${buildId}.plist`);
    if (exportOptionsPlist) {
      await fs.writeFile(exportOptionsPlistPath, exportOptionsPlist);
    } else {
      const appId = await new Promise<string>((resolve) => {
        CommandRunner(
          `security cms -D -i ${buildId}.mobileprovision | plutil -extract Entitlements.application-identifier raw -o - -`,
          iosPath,
          {
            onStdOut: (msg) => {
              resolve(msg.split('.').slice(1).join('.'));
            },
          }
        );
      });
      const plistDoc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('plist', { version: '1.0' })
        .ele('dict')
        .ele('key')
        .txt('provisioningProfiles')
        .up()
        .ele('dict')
        .ele('key')
        .txt(appId)
        .up()
        .ele('string')
        .txt(provisioningSpecifierSafe!)
        .end({ prettyPrint: true });
      await fs.writeFile(exportOptionsPlistPath, plistDoc);
    }

    // Export archive
    const exportRet = await CommandRunner(
      `xcodebuild -archivePath "${path.join(
        iosPath,
        `${scheme}.xcarchive`
      )}" -exportArchive -exportPath "${iosPath}" -exportOptionsPlist "${exportOptionsPlistPath}"`,
      iosPath,
      {
        onStdOut: (msg) => this.onStdOut(msg),
        onStdErr: (msg) => this.onStdErr(msg),
      }
    );

    const ignoredPaths = ignoreParser.compile('Pods/');

    if (exportRet === 0) {
      const chunks: Buffer[] = [];
      const ws = new Writable({
        write: (chunk, encoding, next) => {
          chunks.push(Buffer.from(chunk));
          next();
        },
      });
      tar
        .pack(iosPath, {
          ignore(name) {
            path.relative(iosPath, name).split(path.sep).join(path.posix.sep);
            return ignoredPaths.denies(name);
          },
          readable: true,
          writable: true,
        })
        .pipe(ws);
      await new Promise((resolve) => {
        ws.on('finish', resolve);
      });
      const iosFolder = Buffer.concat(chunks);
      console.log(iosFolder);
      this.socket.emit('build/finish', 0, iosFolder);
    } else {
      this.socket.emit('build/finish', exportRet);
    }
  }

  buildCancel() {
    if (this.buildRunning) {
      this.buildCancellationController.abort();
    }
  }

  dispose(): void | Promise<void> {
    this.socket.off('build/start', this.buildStart);
    this.socket.off('build/cancel', this.buildCancel);
  }

  private onStdOut(msg: string) {
    console.log(msg);
    return this.socket.emit('log/stdout', msg);
  }

  private onStdErr(msg: string) {
    console.log(msg);
    return this.socket.emit('log/stderr', msg);
  }

  private logMessage(msg: string) {
    console.log(msg);
    return this.socket.emit('log/msg', msg);
  }

  private logError(msg: string) {
    console.log(msg);
    return this.socket.emit('log/error', msg);
  }
}
