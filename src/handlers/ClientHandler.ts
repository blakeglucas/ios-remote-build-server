import { Socket } from 'socket.io';
import { BuildHandler } from './BuildHandler';
import { WorkspaceHandler } from './WorkspaceHandler';

export class ClientHandler {
  private readonly buildHandler: BuildHandler;
  private readonly workspaceHandler: WorkspaceHandler;
  constructor(private readonly socket: Socket) {
    this.buildHandler = new BuildHandler(socket);
    this.workspaceHandler = new WorkspaceHandler(socket);
    this.socket.on('disconnect', () => {
      this.buildHandler.dispose();
      this.workspaceHandler.dispose();
    });
  }
}
