import fs from 'fs';
import fsx from 'fs-extra';
import path from 'path';
import { Socket } from 'socket.io';
import { BuildPayload } from '../types/BuildPayload';
import { HandlerBase } from '../utils/HandlerBase';
import { pack } from 'tar-fs';
import ignore from 'ignore';
import { IOSBuild } from '../builds/ios.build';
import tar from 'tar-fs';
import readdir_recursive from 'recursive-readdir';
import { Readable } from 'stream';
import { CommandRunner } from '../CommandRunner';
import { IDisposable } from '../interfaces/IDisposable';

export class WorkspaceHandler extends HandlerBase implements IDisposable {
  private readonly workspacesPath = path.join(process.cwd(), '.workspaces');
  private readonly workspacesIgnores = ignore()
    .add('Pods/')
    .add('node_modules/')
    .add('.git/')
    .add('.vscode/')
    .add('.expo/')
    .add('android/')
    .add('ios/')
    // Required for built apps to run
    .add('index.js')
    .add('metro.config.js');
  private wsPath = '';
  private activeWorkspace: string | undefined;
  private runController: AbortController | undefined;

  constructor(protected readonly socket: Socket) {
    super(socket);
    this.activateWorkspace = this.activateWorkspace.bind(this);
    this.createWorkspace = this.createWorkspace.bind(this);
    this.syncFiles = this.syncFiles.bind(this);
    this.onFileDelete = this.onFileDelete.bind(this);
    this.onFileCreate = this.onFileCreate.bind(this);
    this.onFileChange = this.onFileChange.bind(this);
    this.listWorkspaces = this.listWorkspaces.bind(this);
    this.deactivateWorkspace = this.deactivateWorkspace.bind(this);
    socket.on('workspace/activate', this.activateWorkspace);
    socket.on('workspace/create', this.createWorkspace);
    socket.on('workspace/syncFiles', this.syncFiles);
    socket.on('workspace/file/delete', this.onFileDelete);
    socket.on('workspace/file/create', this.onFileCreate);
    socket.on('workspace/file/change', this.onFileChange);
    socket.on('workspace/list', this.listWorkspaces);
    socket.on('workspace/deactivate', this.deactivateWorkspace);
  }

  async activateWorkspace(name: string) {
    this.wsPath = path.join(this.workspacesPath, name);
    if (fs.existsSync(this.wsPath)) {
      this.activeWorkspace = name;
      this.runController = new AbortController();
      // We use the CLI directly to maintain an accurate PID, 'yarn start' spawns another process we can't get directly
      CommandRunner(
        'node node_modules/@expo/cli/build/bin/cli start --dev-client',
        path.join(process.cwd(), '.workspaces', name),
        {
          onStdOut: (msg) => this.onStdOut(msg),
          onStdErr: (msg) => this.onStdErr(msg),
          onClose: (code) => {
            this.logMessage('Workspace exited with code ' + code);
          },
          signal: this.runController.signal,
        }
      );
    } else {
      this.logError(
        'Workspace does not exist, please create it before activating it'
      );
    }
  }

  async deactivateWorkspace() {
    if (!this.activeWorkspace) {
      return;
    }
    this.runController?.abort();
  }

  async createWorkspace(
    name: string,
    fromBuildId?: string,
    buildPayload?: BuildPayload
  ) {
    const wsPath = path.join(this.workspacesPath, name);
    if (fs.existsSync(wsPath)) {
      this.logError(`Workspace ${name} already exists`);
    } else {
      if (fromBuildId) {
        const buildFolder = path.join(process.cwd(), '.builds', fromBuildId);
        if (!fs.existsSync(buildFolder)) {
          this.logError(`Build ${fromBuildId} does not exist`);
          return;
        }
        const ignores = ignore().add('Pods/').add('node_modules/');
        pack(buildFolder, {
          ignore(name) {
            return (
              ignores.ignores(name.split(path.sep).join(path.posix.sep)) ||
              false
            );
          },
        }).pipe(fs.createWriteStream(wsPath));
        this.socket.emit('workspace/create/finish');
      } else if (buildPayload) {
        const {
          files,
          developmentTeamId,
          provisioningProfile,
          provisioningSpecifier,
          exportOptionsPlist,
        } = buildPayload;
        const iosBuild = new IOSBuild(
          this.socket,
          '.workspaces',
          files,
          developmentTeamId,
          provisioningProfile,
          provisioningSpecifier,
          exportOptionsPlist,
          false,
          name
        );
        const iosFolderTar = await iosBuild.run();
        if (iosFolderTar) {
          this.socket.emit('build/finish', iosFolderTar);
          this.socket.emit('workspace/create/finish');
        }
      }
    }
  }

  async syncFiles(sourceContent: Buffer) {
    const trackableFiles = await readdir_recursive(this.wsPath, [
      (file) =>
        this.workspacesIgnores.ignores(path.relative(this.wsPath, file)),
    ]);
    await Promise.all(
      trackableFiles.map(async (file) => await fsx.remove(file))
    );
    new Readable({
      read() {
        this.push(sourceContent);
        this.push(null);
      },
    }).pipe(tar.extract(this.wsPath, { readable: true, writable: true }));
  }

  async onFileDelete(relPath: string) {
    const absPath = path.join(this.wsPath, relPath);
    if (await fsx.exists(absPath)) {
      await fsx.remove(absPath);
    }
  }

  async onFileCreate(relPath: string, content?: Buffer) {
    const absPath = path.join(this.wsPath, relPath);
    if (content) {
      await fsx.writeFile(absPath, content);
    } else {
      fsx.createFile(absPath);
    }
  }

  async onFileChange(relPath: string, content: Buffer) {
    const absPath = path.join(this.wsPath, relPath);
    await fsx.writeFile(absPath, content);
  }

  async listWorkspaces() {
    if (!fsx.existsSync(this.workspacesPath)) {
      this.socket.emit('workspace/list', []);
      return;
    }
    const dirContents = await fsx.readdir(this.workspacesPath);
    this.socket.emit(
      'workspace/list',
      dirContents.filter((x) =>
        fsx.statSync(path.join(this.workspacesPath, x)).isDirectory()
      )
    );
  }

  async dispose(): Promise<void> {
    await this.deactivateWorkspace();
    this.socket.off('workspace/activate', this.activateWorkspace);
    this.socket.off('workspace/create', this.createWorkspace);
    this.socket.off('workspace/syncFiles', this.syncFiles);
    this.socket.off('workspace/file/delete', this.onFileDelete);
    this.socket.off('workspace/file/create', this.onFileCreate);
    this.socket.off('workspace/file/change', this.onFileChange);
    this.socket.off('workspace/list', this.listWorkspaces);
    this.socket.off('workspace/deactivate', this.deactivateWorkspace);
  }
}
