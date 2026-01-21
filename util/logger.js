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