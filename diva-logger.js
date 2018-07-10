const log4js = require('log4js');

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    // By default, we log nothing
    default: { appenders: ['out'], level: 'off' }, // Unused, but mandatory
    session: { appenders: ['out'], level: 'off' },
    express: { appenders: ['out'], level: 'off' },
    divaIrma: { appenders: ['out'], level: 'off' },
    divaState: { appenders: ['out'], level: 'off' },
  },
});


function getLogger(appender) {
  return log4js.getLogger(appender);
}

module.exports = getLogger;
