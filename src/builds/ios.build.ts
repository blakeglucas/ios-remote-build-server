import { formatISO } from 'date-fns';
import fs from 'fs/promises';
import fsx from 'fs-extra';
import glob from 'glob';
import ignore from 'ignore';
import path from 'path';
import { Socket } from 'socket.io';
import { Readable, Writable } from 'stream';
import tar from 'tar-fs';
import { CommandRunner } from '../utils/CommandRunner';
import { BuildBase } from '../utils/BuildBase';
import { create } from 'xmlbuilder2';

export class IOSBuild extends BuildBase {
  constructor(
    protected readonly socket: Socket,
    protected readonly workDir: string,
    protected readonly files: Buffer,
    protected readonly developmentTeamId: string,
    protected readonly provisioningProfile?: Buffer,
    protected readonly provisioningSpecifier?: string,
    protected readonly exportOptionsPlist?: Buffer,
    protected readonly release?: boolean,
    protected buildId?: string,
    protected readonly stepsToRun?: number[]
  ) {
    super(socket, stepsToRun);
    this.buildSteps = [
      {
        order: 0,
        name: 'Yarn Install',
        task: this.yarnInstall.bind(this),
      },
      {
        order: 1,
        name: 'Expo Prebuild',
        task: this.expoPrebuild.bind(this),
      },
      {
        order: 2,
        name: 'Validate XCode Workspace',
        task: this.validateXCWorkspace.bind(this),
      },
      {
        order: 3,
        name: 'Validate and Install Provisioning Profile',
        task: this.validateAndInstallProvisioning.bind(this),
      },
      {
        order: 4,
        name: 'Create Archive',
        task: this.createArchive.bind(this),
      },
      {
        order: 5,
        name: 'Create exportOptions.plist',
        task: this.createExportOptionsPlist.bind(this),
      },
      {
        order: 6,
        name: 'Export Archive',
        task: this.exportArchive.bind(this),
      },
    ];
  }

  createBuildId() {
    if (!this.buildId) {
      this.buildId = formatISO(new Date(), { format: 'basic' }).replace(
        /[^A-Za-z0-9]/g,
        ''
      );
    }
    this.context['buildId'] = this.buildId;
    return this.buildId;
  }

  async ensureWorkDir(): Promise<void> {
    const { buildId } = this.context;
    const fp = path.join(process.cwd(), this.workDir, buildId);
    await fsx.ensureDir(fp, 0o2777);
    this.context['fp'] = fp;
  }

  async populateWorkDir(): Promise<void> {
    const fp = this.context['fp'] as string;
    const files = this.files;
    new Readable({
      read() {
        this.push(files);
        this.push(null);
      },
    }).pipe(tar.extract(fp, { readable: true, writable: true }));
    this.context['iosPath'] = path.join(fp, 'ios');
  }

  async yarnInstall() {
    const { fp } = this.context;
    // We yarn/npm install locally to ensure any platform-specific modules don't affect building
    const retCode = await CommandRunner('yarn install', fp, {
      onStdOut: (msg) => this.onStdOut(msg),
      onStdErr: (msg) => this.onStdErr(msg),
    });
    if (retCode !== 0) {
      throw new Error(`command failed with code ${retCode}`);
    }
  }

  async expoPrebuild() {
    const { fp } = this.context;
    const retCode = await CommandRunner(`CI=1 npx expo prebuild`, fp, {
      onStdOut: (msg) => this.onStdOut(msg),
      onStdErr: (msg) => this.onStdErr(msg),
    });
    if (retCode !== 0) {
      throw new Error(`command failed with code ${retCode}`);
    }
  }

  async validateXCWorkspace() {
    const { iosPath } = this.context;
    const xcWorkspaceFile = await new Promise<string | null>(
      (resolve, reject) => {
        glob(path.join(iosPath, '*.xcworkspace'), (err, matches) => {
          if (matches.length === 0) {
            resolve(null);
          }
          resolve(path.basename(matches[0]));
        });
      }
    );
    if (xcWorkspaceFile) {
      this.context['xcWorkspaceFile'] = xcWorkspaceFile;
      this.context['scheme'] = xcWorkspaceFile.split('.')[0];
    } else {
      throw new Error('No .xcworkspace file could be found');
    }
  }

  async validateAndInstallProvisioning() {
    if (!this.provisioningSpecifier && !this.provisioningProfile) {
      throw new Error(
        'One of provisioningSpecifier or provisioningProfile needs to be provided'
      );
    }

    const { iosPath, buildId } = this.context;

    let provisioningSpecifierSafe = this.provisioningSpecifier;

    if (this.provisioningProfile && !this.provisioningSpecifier) {
      const provisioningProfilePath = path.join(
        iosPath,
        `${buildId}.mobileprovision`
      );
      await fs.writeFile(provisioningProfilePath, this.provisioningProfile);
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
      const installCode = await CommandRunner(
        `open /Applications/Xcode.app ${provisioningProfilePath}`,
        iosPath
      );
      if (installCode !== 0) {
        this.logError('error installing provisioning profile :(');
      }
      provisioningSpecifierSafe = provisioningUUID;
    }
    this.context['validatedProvisioningSpecifier'] = provisioningSpecifierSafe;
  }

  async createArchive() {
    const { xcWorkspaceFile, scheme, iosPath, validatedProvisioningSpecifier } =
      this.context;
    const retCode = await CommandRunner(
      `RCT_NO_LAUNCH_PACKAGER=1 xcodebuild -configuration ${
        this.release ? 'Release' : 'Debug'
      } -workspace ${xcWorkspaceFile} -scheme ${scheme} archive -archivePath "${path.join(
        iosPath,
        `${scheme}.xcarchive`
      )}" -allowProvisioningUpdates DEVELOPMENT_TEAM=${
        this.developmentTeamId
      } PROVISIONING_PROFILE_SPECIFIER=${validatedProvisioningSpecifier} CODE_SIGN_STYLE=Manual`,
      iosPath,
      {
        onStdOut: (msg) => this.onStdOut(msg),
        onStdErr: (msg) => this.onStdErr(msg),
      }
    );
    if (retCode !== 0) {
      throw new Error(`command failed with code ${retCode}`);
    }
  }

  async createExportOptionsPlist() {
    const { buildId, iosPath, validatedProvisioningSpecifier } = this.context;
    const exportOptionsPlistPath = path.join(iosPath, `${buildId}.plist`);
    if (this.exportOptionsPlist) {
      await fs.writeFile(exportOptionsPlistPath, this.exportOptionsPlist);
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
        .txt(validatedProvisioningSpecifier!)
        .end({ prettyPrint: true });
      await fs.writeFile(exportOptionsPlistPath, plistDoc);
    }
    this.context['exportOptionsPlistPath'] = exportOptionsPlistPath;
  }

  async exportArchive() {
    const { iosPath, scheme, exportOptionsPlistPath } = this.context;
    const retCode = await CommandRunner(
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
    if (retCode !== 0) {
      throw new Error(`command failed with code ${retCode}`);
    }
  }

  async finishBuild(): Promise<any> {
    const { iosPath } = this.context;
    const chunks: Buffer[] = [];
    const ws = new Writable({
      write: (chunk, encoding, next) => {
        chunks.push(Buffer.from(chunk));
        next();
      },
    });
    const outIgnores = ignore().add('Pods/');
    tar
      .pack(iosPath, {
        ignore(name) {
          return outIgnores.ignores(
            path.relative(iosPath, name).split(path.sep).join(path.posix.sep)
          );
        },
        readable: true,
        writable: true,
      })
      .pipe(ws);
    await new Promise((resolve) => {
      ws.on('finish', resolve);
    });
    return Buffer.concat(chunks);
  }
}
