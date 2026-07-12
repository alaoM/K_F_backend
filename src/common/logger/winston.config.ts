import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const winstonConfig = {
  transports: [
    // 1. Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, ms }) => {
          return `[Nest] ${timestamp} ${level} [${context || 'App'}] ${message} ${ms}`;
        }),
      ),
    }),
    // 2. Error logs (File)
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d', // Keep logs for 30 days
    }),
    // 3. Combined logs (All activities)
    new winston.transports.DailyRotateFile({
      filename: 'logs/activity-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
  ],
};