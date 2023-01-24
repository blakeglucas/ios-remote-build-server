import { Socket } from 'socket.io';
import { IDisposable } from '../interfaces/IDisposable';
import { BuildHandler } from './BuildHandler';
import { WorkspaceHandler } from './WorkspaceHandler';

export class ClientHandler {
  private readonly handlers: IDisposable[] = [];

  constructor(private readonly socket: Socket) {
    this.handlers.push(new BuildHandler(socket), new WorkspaceHandler(socket));
    this.socket.on('disconnect', () => {
      this.handlers.forEach((handler) => handler.dispose());
    });
  }
}
