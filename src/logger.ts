import winston from 'winston';

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.cli(),
    }),
    new winston.transports.File({
        filename: 'combined.json',
        level: 'info',
        dirname: 'logs',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        tailable: true,
    }),
    new winston.transports.File({
        filename: 'error.json',
        level: 'error',
        dirname: 'logs',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        tailable: true,
    })
  ],
  
});

export function getLogger() {
    return logger
}