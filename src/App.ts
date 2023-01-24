import { Server, Socket } from 'socket.io';
import { ClientHandler } from './handlers/ClientHandler';
import { getLogger } from './logger';

const logger = getLogger(__filename);

export type AppArguments = {
  port: string | number;
};

export class App {
  private readonly port;
  private readonly connectedClients: Record<string, ClientHandler> = {};
  private readonly io: Server;
  constructor(args: AppArguments) {
    this.port = Number(args.port);
    this.io = new Server({ maxHttpBufferSize: 1e9 });
    this.io.on('connection', (socket: Socket) => {
      logger.info(
        `CONNECTED  ->  ${socket.handshake.address}  ->  ${socket.id}`
      );
      socket.on('disconnect', () => {
        logger.info(
          `DISCONNECTED  ->  ${socket.id}  (ip ${socket.handshake.address})`
        );
        if (this.connectedClients[socket.id]) {
          logger.debug(`deleting clientHandler for socket ${socket.id}`);
          delete this.connectedClients[socket.id];
        }
      });
      this.connectedClients[socket.id] = new ClientHandler(socket);
      logger.debug(`created clientHandler for socket ${socket.id}`);
    });
  }

  run() {
    logger.debug('app run starting...');
    this.io.listen(this.port);
  }
}
