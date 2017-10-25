/*!
 * diva-irma-js
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

// TODO fix state in a better way!
const divaState = {};
const irmaState = {};
let divaConfig;

/**
* Module dependencies.
* @private
*/

const BPromise = require('bluebird');
const jwt = require('jsonwebtoken');
const request = require('superagent');

const defaults = require('./defaults');
const packageJson = require('./../package.json');

function version() {
  return packageJson.version;
}

function init(options) {
  divaConfig = {
    ...defaults,
    ...options,
  };
}

function mergeAttribute(attributes, attributeName, attributeValue) {
  const mergedAttributes = attributes;
  if (attributes[attributeName] === undefined) {
    mergedAttributes[attributeName] = [attributeValue];
  } else {
    mergedAttributes[attributeName] = attributes[attributeName].push(attributeValue);
  }
  return mergedAttributes;
}

function getAttributes(divaSessionId) {
  if (divaState[divaSessionId] === undefined) {
    return {};
  }

  let attributes = {};
  Object.values(divaState[divaSessionId]).forEach((proof) => {
    if (proof.status === 'VALID') {
      const attributeMap = proof.attributes;
      Object.keys(attributeMap).forEach((name) => {
        attributes = mergeAttribute(attributes, name, attributeMap[name]);
      });
    }
  });

  return attributes;
}

function getMissingAttributes(divaSessionId, requiredAttributes) {
  const existingAttributes = Object.keys(getAttributes(divaSessionId));
  return requiredAttributes.filter(el => !existingAttributes.includes(el));
}

function requireAttributes(attributes) {
  return (req, res, next) => {
    const missingAttributes = getMissingAttributes(req.sessionId, attributes);
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
      irmaState[result.body.u] = 'PENDING';
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
  const divaStateEntry = (divaState[divaSessionId] !== undefined)
    ? divaState[divaSessionId]
    : {};

  divaStateEntry[irmaSessionId] = proofResult;
  divaState[divaSessionId] = divaStateEntry;
}

function completeDisclosureSession(irmaSessionId, token) {
  return verifyIrmaApiServerJwt(token)
    .then((proofResult) => {
      addIrmaProof(proofResult, irmaSessionId);
      irmaState[irmaSessionId] = 'COMPLETED';
    });
}

function getProofs(divaSessionId) {
  if (divaState[divaSessionId] === undefined) {
    return {};
  }
  return divaState[divaSessionId];
}

function removeDivaSession(divaSessionId) {
  return divaState.delete(divaSessionId);
}

function getIrmaAPISessionStatus(irmaSessionId) {
  const irmaStatus = irmaState[irmaSessionId];
  return BPromise.resolve(irmaStatus);
}

function getProofStatus(divaSessionId, irmaSessionId) {
  const proof = divaState[divaSessionId][irmaSessionId];
  if (!proof || !proof.status) {
    return BPromise.resolve('UNKNOWN');
  }
  return BPromise.resolve(proof.status);
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
