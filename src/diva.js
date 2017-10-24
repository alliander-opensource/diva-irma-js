/*!
 * diva-irma-js
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

// TODO fix state in a better way!
const divaState = new Map();
const irmaState = new Map();
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
  if (attributes.get(attributeName) === undefined) {
    return {
      ...attributes,
      attributeName: [attributeValue],
    };
  }

  return {
    ...attributes,
    attributeName: attributes[attributeName].push(attributeValue),
  };
}

function getAttributes(divaSessionId) {
  if (divaState.get(divaSessionId) === undefined) {
    return new Map();
  }

  let attributes = new Map();
  divaState.get(divaSessionId).forEach((proof) => {
    if (proof.status === 'VALID') {
      const attributeMap = proof.attributes;
      Object.keys(attributeMap).forEach((name) => {
        attributes = mergeAttribute(attributes, name, attributeMap[name]);
      });
    }
  });

  return attributes;
}

function checkAttributes(divaSessionId, requiredAttributes) {
  const existingAttributes = getAttributes(divaSessionId).keys();

  return requiredAttributes.filter(
    el => existingAttributes.includes(el)).length === 0;
}

function requireAttributes(attributes) {
  return (req, res, next) => {
    if (checkAttributes(req.sessionId, attributes)) {
      next();
    } else {
      res
        .status(401)
        .send({
          success: false,
          requiredAttributes: attributes,
          message: `You are missing attributes: ${attributes}`,
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
      content: [
        {
          label: attributesLabel,
          attributes,
        },
      ],
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
      irmaState.set(result.body.u, 'PENDING');
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
  const divaStateEntry = (divaState.get(divaSessionId) !== undefined)
    ? divaState.get(divaSessionId)
    : new Map();

  divaStateEntry.set(irmaSessionId, proofResult);
  divaState.set(divaSessionId, divaStateEntry);
}

function completeDisclosureSession(irmaSessionId, token) {
  return verifyIrmaApiServerJwt(token)
    .then((proofResult) => {
      addIrmaProof(proofResult, irmaSessionId);
      irmaState.set(irmaSessionId, 'COMPLETED');
    });
}

function getProofs(divaSessionId) {
  if (divaState.get(divaSessionId) === undefined) {
    return new Map();
  }
  return divaState.get(divaSessionId);
}

function removeDivaSession(divaSessionId) {
  return divaState.delete(divaSessionId);
}

function getIrmaAPISessionStatus(irmaSessionId) {
  const irmaStatus = irmaState.get(irmaSessionId);
  return BPromise.resolve(irmaStatus);
}

function getProofStatus(divaSessionId, irmaSessionId) {
  const proof = divaState.get(divaSessionId).get(irmaSessionId);
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
