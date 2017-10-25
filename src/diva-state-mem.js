/*!
 * diva-irma-js
 * Diva state module for in-mem storage
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

const BPromise = require('bluebird');

const divaState = {};
const irmaState = {};

function init() {
}

function getDivaEntry(divaSessionId) {
  return BPromise.resolve(
    (divaState[divaSessionId] !== undefined)
      ? divaState[divaSessionId]
      : {},
  );
}

function setDivaEntry(divaSessionId, entry) {
  divaState[divaSessionId] = entry;
  return BPromise.resolve(divaState);
}

function deleteDivaEntry(divaSessionId) {
  divaState[divaSessionId] = {};
  return BPromise.resolve(divaState);
}

function getIrmaEntry(irmaSessionId) {
  return BPromise.resolve(irmaState[irmaSessionId]);
}

function setIrmaEntry(irmaSessionId, state) {
  irmaState[irmaSessionId] = state;
  return BPromise.resolve(irmaState);
}

module.exports.init = init;
module.exports.getDivaEntry = getDivaEntry;
module.exports.setDivaEntry = setDivaEntry;
module.exports.deleteDivaEntry = deleteDivaEntry;
module.exports.getIrmaEntry = getIrmaEntry;
module.exports.setIrmaEntry = setIrmaEntry;
