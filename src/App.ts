import { Server, Socket } from 'socket.io';
import winston from 'winston';
import { ClientHandler } from './handlers/ClientHandler';
import { getLogger } from './logger';

export type AppArguments = {
  port: string | number;
};

export class App {
  private readonly port;
  private readonly connectedClients: Record<string, ClientHandler> = {};
  private readonly io: Server;
  private readonly logger: winston.Logger;
  constructor(args: AppArguments) {
    this.logger = getLogger()
    this.port = Number(args.port);
    this.io = new Server({ maxHttpBufferSize: 1e9 });
    this.io.on('connection', (socket: Socket) => {
      socket.on('disconnect', () => {
        this.logger.info(socket.id + ' disconnected');
        if (this.connectedClients[socket.id]) {
          delete this.connectedClients[socket.id];
        }
      });
      this.logger.info(socket.id + ' connected');
      this.connectedClients[socket.id] = new ClientHandler(socket);
    });
  }

  run() {
    this.io.listen(this.port);
  }
}
