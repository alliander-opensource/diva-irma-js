/*!
 * diva-irma-js
 * Diva state in-mem storage module
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

const BPromise = require('bluebird');
const redis = require('redis');
const logger = require('../diva-logger')('divaState');

const divaPrefix = 'diva-';
const irmaPrefix = 'irma-';

let client;
function init(options) {
  logger.debug(`Init Redis with options: ${options}`);
  BPromise.promisifyAll(redis.RedisClient.prototype);
  client = redis.createClient(options);
}

function getDivaEntry(divaSessionId) {
  logger.debug(`Obtaining DivaEntry for: ${divaSessionId}`);
  return client.getAsync(divaPrefix + divaSessionId)
    .then((redisEntry) => {
      if (!redisEntry) {
        return {};
      }
      return JSON.parse(redisEntry);
    });
}

function setDivaEntry(divaSessionId, entry) {
  logger.debug(`Setting DivaEntry for: ${divaSessionId}`);
  return client.setAsync(
    divaPrefix + divaSessionId,
    JSON.stringify(entry),
  );
}

function deleteDivaEntry(divaSessionId) {
  logger.debug(`Delete DivaEntry for: ${divaSessionId}`);
  return client.delAsync(
    divaPrefix + divaSessionId,
  );
}

function getIrmaEntry(irmaSessionId) {
  logger.debug(`Obtain IrmaEntry for: ${irmaSessionId}`);
  return client.getAsync(irmaPrefix + irmaSessionId)
    .then((redisEntry) => {
      if (!redisEntry) {
        return {};
      }
      return JSON.parse(redisEntry);
    });
}

function setIrmaEntry(irmaSessionId, state) {
  logger.debug(`Setting IrmaEntry for: ${irmaSessionId}`);
  return client.setAsync(
    irmaPrefix + irmaSessionId,
    JSON.stringify(state),
  );
}

module.exports.init = init;
module.exports.getDivaEntry = getDivaEntry;
module.exports.setDivaEntry = setDivaEntry;
module.exports.deleteDivaEntry = deleteDivaEntry;
module.exports.getIrmaEntry = getIrmaEntry;
module.exports.setIrmaEntry = setIrmaEntry;
