// Source - https://stackoverflow.com/a/40906364
// Posted by KeshavDulal, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-21, License - CC BY-SA 3.0

// Modified extensively by Rajat Tyagi (@moai379) to fit project needs

const winston = require('winston');
const winstonRotator = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const consoleTransport = new winston.transports.Console({
  format: winston.format.colorize()
});

const successLogger = winston.createLogger({
  transports: [
    consoleTransport,
    new winstonRotator({
      level: 'info',
      filename: path.join(logDir, '%DATE%-access.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '14d'
    })
  ]
});

const errorLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    consoleTransport,
    new winstonRotator({
      level: 'error',
      filename: path.join(logDir, '%DATE%-error.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: '14d'
    })
  ]
});

module.exports = { successlog: successLogger, errorlog: errorLogger };   