import path from 'path';
import winston from 'winston';

export function getLogger(uufilename?: string) {
  const filename = uufilename ? path.basename(uufilename) : '';
  const logFileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) =>
        (filename ? `[${filename}]\t` : '') +
        `${info.timestamp}\t${info.level}\t${info.message}`
    )
  );

  return winston.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.cli(),
      }),
      new winston.transports.File({
        filename: 'debug.log',
        level: 'debug',
        dirname: 'logs',
        format: logFileFormat,
      }),
      new winston.transports.File({
        filename: 'combined.log',
        level: 'info',
        dirname: 'logs',
        format: logFileFormat,
        tailable: true,
      }),
      new winston.transports.File({
        filename: 'error.log',
        level: 'error',
        dirname: 'logs',
        format: logFileFormat,
        tailable: true,
      }),
    ],
  });
}
