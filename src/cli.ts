#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import figlet from 'figlet';
import { App, AppArguments } from './App';
import { getLogger } from './logger';

const logger = getLogger(__filename);

async function main() {
  logger.debug('CLI started');

  const program = new Command();
  logger.debug('created Commander instance');

  const meta = require(path.resolve(__dirname, '..', 'package.json'));
  logger.debug('resolved metadata');

  console.log(figlet.textSync(meta.displayName));

  program
    .version(meta.version)
    .name(meta.name)
    .description('A remote-controllable iOS build server')
    .option(
      '-p, --port <port>',
      'The port on which to run the SocketIO listener',
      '6969'
    )
    .parse();
  logger.debug('parsed arguments');

  const options = program.opts();
  logger.debug(`CLI args: ${JSON.stringify(options)}`);

  const args: AppArguments = {
    port: options.port,
  };

  const app = new App(args);
  logger.debug('app instance created. starting...');
  app.run();
}

main();
