import { Socket } from 'socket.io';

import { BuildPayload } from '../types/BuildPayload';
import { HandlerBase } from '../utils/HandlerBase';
import { CommandRunner } from '../utils/CommandRunner';
import fsx from 'fs-extra';
import { IOSBuild } from '../builds/ios.build';
import path from 'path';
import { statSync } from 'fs';
import fs from 'fs/promises';
import { IDisposable } from '../interfaces/IDisposable';
import { getLogger } from '../logger';

const logger = getLogger(__filename);

export class BuildHandler extends HandlerBase implements IDisposable {
  private buildCancellationController: AbortController | undefined;
  private remoteRunController: AbortController | undefined;
  private procRunPromise: Promise<any> | undefined;

  constructor(protected readonly socket: Socket) {
    super(socket, logger);
    this.buildStart = this.buildStart.bind(this);
    this.buildCancel = this.buildCancel.bind(this);
    this.runBuild = this.runBuild.bind(this);
    this.listBuilds = this.listBuilds.bind(this);
    socket.on('build/start', this.buildStart);
    socket.on('build/cancel', this.buildCancel);
    socket.on('build/run', this.runBuild);
    socket.on('builds/list', this.listBuilds);
  }

  async buildStart({
    files,
    developmentTeamId,
    provisioningProfile,
    provisioningSpecifier,
    exportOptionsPlist,
    release,
  }: BuildPayload) {
    const workDir = '.builds';
    const iosBuild = new IOSBuild(
      this.socket,
      workDir,
      files,
      developmentTeamId,
      provisioningProfile,
      provisioningSpecifier,
      exportOptionsPlist,
      release,
      undefined
    );
    const iosFolderTar = await iosBuild.run();
    if (iosFolderTar) {
      this.socket.emit('build/finish', iosFolderTar);
    }
  }

  buildCancel() {
    if (this.buildCancellationController) {
      this.buildCancellationController.abort();
    }
  }

  runBuild(buildId: string) {
    this.remoteRunController = new AbortController();
    // We use the CLI directly to maintain an accurate PID, yarn start spawns another process we can't get directly
    this.procRunPromise = CommandRunner(
      'node node_modules/@expo/cli/build/bin/cli start --dev-client',
      path.join(process.cwd(), '.builds', buildId),
      {
        onStdOut: (msg) => this.onStdOut(msg),
        onStdErr: (msg) => this.onStdErr(msg),
        onClose: (code) => {
          this.logMessage('Remote run exited with code ' + code);
        },
        signal: this.remoteRunController.signal,
      }
    );
  }

  stopRun() {
    if (this.remoteRunController) {
      this.remoteRunController.abort();
      this.remoteRunController = undefined;
      this.procRunPromise = undefined;
    }
  }

  dispose(): void | Promise<void> {
    this.stopRun();
    this.buildCancel();
    this.socket.off('build/start', this.buildStart);
    this.socket.off('build/cancel', this.buildCancel);
    this.socket.off('build/run', this.runBuild);
    this.socket.off('builds/list', this.listBuilds);
  }

  async listBuilds() {
    const buildsPath = path.join(process.cwd(), '.builds');
    if (!fsx.existsSync(buildsPath)) {
      this.socket.emit('builds/list', []);
      return;
    }
    const builds = (await fs.readdir(buildsPath)).filter((x) =>
      statSync(path.join(process.cwd(), '.builds', x)).isDirectory()
    );
    this.socket.emit('builds/list', builds);
  }
}
