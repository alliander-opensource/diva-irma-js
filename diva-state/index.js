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

let divaState;

function init(options) {
  // Don't init again if we have already in other function
  if (divaState !== undefined) {
    return divaState;
  }

  const divaConfig = {
    ...defaults,
    ...options,
  };

  if (divaConfig.useRedis) {
    divaState = require('./diva-state-redis'); // eslint-disable-line global-require
    divaState.init(divaConfig.redisOptions);
  } else {
    divaState = require('./diva-state-mem'); // eslint-disable-line global-require
    divaState.init();
  }

  return divaState;
};

/**
* Module exports.
* @public
*/
module.exports = init;
module.exports.init = init;
