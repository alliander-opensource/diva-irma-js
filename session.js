/*!
 * diva-session
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

const divaStateModule = require('./diva-state');

let divaState;

/**
* Module dependencies.
* @private
*/

const BPromise = require('bluebird');

function mergeAttribute(attributes, attributeName, attributeValue) {
  // If an attribute of the same type is already stored, add the
  // new value. Otherwise, add a new array with the first value.
  const valuesForAttributeName = attributes[attributeName] ?
    attributes[attributeName].concat(attributeValue) :
    [attributeValue];
  return {
    ...attributes,
    [attributeName]: valuesForAttributeName,
  };
}

function getAttributes(divaSessionId) {
  return divaState.getDivaEntry(divaSessionId)
    .then((divaStateEntry) => {
      let attributes = {};
      Object.values(divaStateEntry).forEach((proof) => {
        if (proof.status === 'VALID') {
          const attributeMap = proof.attributes;
          Object.keys(attributeMap).forEach((name) => {
            attributes = mergeAttribute(attributes, name, attributeMap[name]);
          });
        }
      });

      return attributes;
    });
}

function getMissingAttributes(divaSessionId, requiredAttributes) {
  return getAttributes(divaSessionId)
    .then((attributes) => {
      const existingAttributes = Object.keys(attributes);
      return requiredAttributes.filter(el => !existingAttributes.includes(el));
    });
}

function addIrmaProofToSession(proofResult, irmaSessionId) {
  const divaSessionId = proofResult.jti;

  return divaState.getDivaEntry(divaSessionId)
    .then(divaStateEntry =>
      divaState.setDivaEntry(divaSessionId, {
        ...divaStateEntry,
        [irmaSessionId]: proofResult,
      }),
    );
}

function getProofs(divaSessionId) {
  return divaState.getDivaEntry(divaSessionId);
}

function removeDivaSession(divaSessionId) {
  return divaState.deleteDivaEntry(divaSessionId);
}

function getProofStatus(divaSessionId, irmaSessionId) {
  return divaState.getDivaEntry(divaSessionId)
    .then((divaStateEntry) => {
      const proof = divaStateEntry[irmaSessionId];
      if (!proof || !proof.status) {
        return BPromise.resolve('NO_PROOF_STATUS');
      }
      return BPromise.resolve(proof.status);
    });
}

function requireAttributes(sessionId, attributes) {
  return getMissingAttributes(sessionId, attributes)
    .then((missingAttributes) => {
      if (missingAttributes.length !== 0) {
        throw new Error(`You are missing attributes: [${missingAttributes}]`);
      }
    });
}

function init(divaStateOptions) {
  divaState = divaStateModule.init(divaStateOptions);
}

/**
* Module exports.
* @public
*/
module.exports = init;
module.exports.init = init;
module.exports.getAttributes = getAttributes;
module.exports.getProofs = getProofs;
module.exports.removeDivaSession = removeDivaSession;
module.exports.getProofStatus = getProofStatus;
module.exports.addIrmaProofToSession = addIrmaProofToSession;
module.exports.requireAttributes = requireAttributes;
module.exports.getMissingAttributes = getMissingAttributes;
