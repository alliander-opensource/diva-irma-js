/*!
 * diva-irma-js
 * Diva state module for IRMA and HTTP session storage
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

/**
* Module dependencies.
* @private
*/

const logger = require('../diva-logger')('divaState');
const defaults = require('../config/default-config');
const divaRedis = require('./diva-state-redis');
const divaMem = require('./diva-state-mem');

let divaState;

function init(options) {
  logger.level = options.logLevel ? options.logLevel : 'off';
  logger.trace('calling init()');

  // Don't init again if we have already in other function
  if (divaState !== undefined) {
    return divaState;
  }

  const divaConfig = {
    ...defaults,
    ...options,
  };

  if (divaConfig.useRedis) {
    logger.debug('Using redis voor session storage');
    divaRedis.init(divaConfig.redisOptions);
    divaState = divaRedis;
  } else {
    logger.debug('Using in-mem session storage');
    divaMem.init();
    divaState = divaMem;
  }

  return divaState;
}

/**
* Module exports.
* @public
*/
module.exports = init;
module.exports.init = init;
