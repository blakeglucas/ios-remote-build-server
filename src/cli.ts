import { Command } from 'commander';
import path from 'path';
import figlet from 'figlet';
import { App, AppArguments } from './App';
import { getLogger } from './logger';

async function main() {
  const program = new Command();
  const meta = require(path.resolve(__dirname, '..', 'package.json'));

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

  const options = program.opts();

  const args: AppArguments = {
    port: options.port,
  };

  const app = new App(args);
  app.run();
}

main();
