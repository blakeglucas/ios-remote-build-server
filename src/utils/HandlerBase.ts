import { Socket } from 'socket.io';
import winston from 'winston';
import { getLogger } from '../logger';

export abstract class HandlerBase {
  protected readonly logger: winston.Logger;
  constructor(protected readonly socket: Socket) {
    this.logger = getLogger();
  }

  protected onStdOut(msg: string) {
    this.logger.info(msg);
    return this.socket.emit('log/stdout', msg);
  }

  protected onStdErr(msg: string) {
    this.logger.warn(msg);
    return this.socket.emit('log/stderr', msg);
  }

  protected logMessage(msg: string) {
    this.logger.info(msg);
    return this.socket.emit('log/msg', msg);
  }

  protected logError(msg: string) {
    this.logger.error(msg);
    return this.socket.emit('log/error', msg);
  }
}
