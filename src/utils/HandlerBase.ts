import { Socket } from 'socket.io';

export abstract class HandlerBase {
  constructor(protected readonly socket: Socket) {}

  protected onStdOut(msg: string) {
    console.log(msg);
    return this.socket.emit('log/stdout', msg);
  }

  protected onStdErr(msg: string) {
    console.log(msg);
    return this.socket.emit('log/stderr', msg);
  }

  protected logMessage(msg: string) {
    console.log(msg);
    return this.socket.emit('log/msg', msg);
  }

  protected logError(msg: string) {
    console.log(msg);
    return this.socket.emit('log/error', msg);
  }
}
