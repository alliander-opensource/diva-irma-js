/*!
 * diva-irma-js
 * Diva state Redis storage module
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

const BPromise = require('bluebird');
const logger = require('../diva-logger')('divaState');

const divaState = {};
const irmaState = {};

function init() {
}

function getDivaEntry(divaSessionId) {
  logger.debug(`Obtaining DivaEntry for: ${divaSessionId}`);
  return BPromise.resolve(
    (divaState[divaSessionId] !== undefined)
      ? divaState[divaSessionId]
      : {},
  );
}

function setDivaEntry(divaSessionId, entry) {
  logger.debug(`Setting DivaEntry for: ${divaSessionId}`);
  divaState[divaSessionId] = entry;
  return BPromise.resolve(divaState);
}

function deleteDivaEntry(divaSessionId) {
  logger.debug(`Delete DivaEntry for: ${divaSessionId}`);
  divaState[divaSessionId] = {};
  return BPromise.resolve(divaState);
}

function getIrmaEntry(irmaSessionId) {
  logger.debug(`Obtain IrmaEntry for: ${irmaSessionId}`);
  return BPromise.resolve(irmaState[irmaSessionId]);
}

function setIrmaEntry(irmaSessionId, state) {
  logger.debug(`Setting IrmaEntry for: ${irmaSessionId}`);
  irmaState[irmaSessionId] = state;
  return BPromise.resolve(irmaState);
}

module.exports.init = init;
module.exports.getDivaEntry = getDivaEntry;
module.exports.setDivaEntry = setDivaEntry;
module.exports.deleteDivaEntry = deleteDivaEntry;
module.exports.getIrmaEntry = getIrmaEntry;
module.exports.setIrmaEntry = setIrmaEntry;
