/*!
 * diva-state
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

/**
* Module dependencies.
* @private
*/

const defaults = require('../config/default-config');

module.exports = function init(options) {
  const divaConfig = {
    ...defaults,
    ...options,
  };

  let divaState;

  if (divaConfig.useRedis) {
    divaState = require('./diva-state-redis'); // eslint-disable-line global-require
    divaState.init(divaConfig.redisOptions);
  } else {
    divaState = require('./diva-state-mem'); // eslint-disable-line global-require
    divaState.init();
  }

  return divaState;
};
