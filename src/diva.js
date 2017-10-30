/*!
 * diva-irma-js
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

let divaConfig;

/**
* Module dependencies.
* @private
*/

const BPromise = require('bluebird');
const jwt = require('jsonwebtoken');
const request = require('superagent');

const defaults = require('./default-config');
const packageJson = require('./../package.json');

function version() {
  return packageJson.version;
}

let divaState;
function init(options) {
  divaConfig = {
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
}

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

function requireAttributes(attributes) {
  return (req, res, next) => {
    getMissingAttributes(req.sessionId, attributes)
      .then((missingAttributes) => {
        if (missingAttributes.length === 0) {
          next();
        } else {
          res
            .status(401)
            .send({
              success: false,
              requiredAttributes: attributes,
              message: `You are missing attributes: [${missingAttributes}]`,
            });
        }
      });
  };
}

function updateQRContentWithApiEndpoint(qrContent) {
  return {
    ...qrContent,
    u: `${divaConfig.irmaApiServerUrl}${divaConfig.verificationEndpoint}/${qrContent.u}`,
  };
}

function attributesToContent(attributes, attributesLabel) {
  return attributes.map(el => ({
    label: attributesLabel,
    attributes: [el],
  }));
}

function startDisclosureSession(
  divaSessionId,
  attributes,
  attributesLabel,
) {
  const callbackUrl = divaConfig.baseUrl + divaConfig.completeDisclosureSessionEndpoint;
  const sprequest = {
    callbackUrl,
    data: divaSessionId,
    validity: 60,
    timeout: 600,
    request: {
      content: attributesToContent(attributes, attributesLabel),
    },
  };

  const jwtOptions = {
    algorithm: 'RS256',
    issuer: 'diva',
    subject: 'verification_request',
  };

  const signedVerificationRequestJwt = jwt.sign(
    { sprequest },
    divaConfig.apiKey,
    jwtOptions,
  );

  return request
    .post(divaConfig.irmaApiServerUrl + divaConfig.verificationEndpoint)
    .type('text/plain')
    .send(signedVerificationRequestJwt)
    .then((result) => {
      divaState.setIrmaEntry(result.body.u, 'PENDING'); // Async
      return {
        irmaSessionId: result.body.u,
        qrContent: updateQRContentWithApiEndpoint(result.body),
      };
    })
    .catch((error) => {
      // TODO: make this a typed error
      const e = new Error(`Error starting IRMA session: ${error.message}`);
      return e;
    });
}

/**
 * Decode and verify JWT verify token from api server and check validity/signature
 * @function verifyIrmaJwt
 * @param {string} token JWT string
 * @returns {Promise<json>} decoded IRMA JWT token from api server
 */
function verifyIrmaApiServerJwt(token) {
  const key = divaConfig.irmaApiServerPublicKey;
  return BPromise.try(() => jwt.verify(token, key, divaConfig.jwtIrmaApiServerVerifyOptions));
}

function addIrmaProof(proofResult, irmaSessionId) {
  const divaSessionId = proofResult.jti;

  return divaState.getDivaEntry(divaSessionId)
    .then(divaStateEntry =>
      divaState.setDivaEntry(divaSessionId, {
        ...divaStateEntry,
        [irmaSessionId]: proofResult,
      }),
    );
}

function completeDisclosureSession(irmaSessionId, token) {
  return verifyIrmaApiServerJwt(token)
    .then(proofResult => addIrmaProof(proofResult, irmaSessionId))
    .then(() => divaState.setIrmaEntry(irmaSessionId, 'COMPLETED'));
}

function getProofs(divaSessionId) {
  return divaState.getDivaEntry(divaSessionId);
}

function removeDivaSession(divaSessionId) {
  return divaState.deleteDivaEntry(divaSessionId);
}

function getIrmaAPISessionStatus(divaSessionId, irmaSessionId) {
  const getDisclosureStatus = divaState.getIrmaEntry(irmaSessionId);
  const getServerStatus = request
    .get(`${divaConfig.irmaApiServerUrl}${divaConfig.verificationEndpoint}/${irmaSessionId}/status`)
    .type('text/plain')
    .then(result => result.body)
    .catch(() => { // eslint-disable-line arrow-body-style
      // The IRMA api server returns an error on expired sessions.
      // For now we treat all errors as non-existing irma disclosure sessions.
      return 'NOT_FOUND';
    });

  return BPromise
    .all([
      getDisclosureStatus,
      getServerStatus,
    ])
    .spread((disclosureStatus, serverStatus) => {
      if (disclosureStatus === 'COMPLETED') {
        return this
          .getProofStatus(divaSessionId, irmaSessionId)
          .then(proofStatus => ({
            disclosureStatus,
            proofStatus,
          }));
      }
      // Disclosure status is PENDING
      // Set disclosureStatus to ABORTED when serverStatus is CANCELLED or NOT_FOUND
      if (serverStatus === 'CANCELLED' || serverStatus === 'NOT_FOUND') {
        divaState.setIrmaEntry(irmaSessionId, 'ABORTED'); // Async
        return {
          disclosureStatus: 'ABORTED',
          serverStatus,
        };
      }
      return {
        disclosureStatus,
        serverStatus,
      };
    });
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

/**
* Module exports.
* @public
*/

module.exports.version = version;
module.exports.init = init;
module.exports.requireAttributes = requireAttributes;
module.exports.startDisclosureSession = startDisclosureSession;
module.exports.completeDisclosureSession = completeDisclosureSession;
module.exports.getAttributes = getAttributes;
module.exports.getProofs = getProofs;
module.exports.removeDivaSession = removeDivaSession;
module.exports.getIrmaAPISessionStatus = getIrmaAPISessionStatus;
module.exports.getProofStatus = getProofStatus;
