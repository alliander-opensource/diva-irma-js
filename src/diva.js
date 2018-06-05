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

function updateQRContentWithApiEndpoint(qrContent, endpoint) {
  return {
    ...qrContent,
    u: `${divaConfig.irmaApiServerUrl}${endpoint}/${qrContent.u}`,
  };
}

function attributeToContent(attribute, attributeLabel) {
  return [{
    label: attributeLabel,
    attributes: [attribute],
  }];
}

/**
 * Start a new IRMA session: request session token, save it and return it
 * @param {String} endpoint URL endpoint of IRMA Api Server (without base url)
 * @param {String} jwtBody Encoded JWT containing issue, disclosure or signing request
 * @returns {Promise<json>} Session token and content of IRMA QR
 */
function requestIrmaSession(endpoint, jwtBody) {
  return request
    .post(divaConfig.irmaApiServerUrl + endpoint)
    .type('text/plain')
    .send(jwtBody)
    .then((result) => {
      divaState.setIrmaEntry(result.body.u, 'PENDING'); // Async
      return {
        irmaSessionId: result.body.u,
        qrContent: updateQRContentWithApiEndpoint(result.body, endpoint),
      };
    })
    .catch((error) => {
      // TODO: make this a typed error
      const e = new Error(`Error starting IRMA session: ${error.message}`);
      throw e;
    });
}

/**
 * Generate a content array that can be used in either disclosure of signature request
 * @param {String/Object} attribute identitifier to be disclosed or content object
 * @param {String/Undefined} label used with attribute identifier (only if no content object)
 * @returns {Array<Object>} list of attribute disjunctions
 */
function generateDisclosureContent(attributes, attributeLabel) {
  return (typeof attributes === 'string' && typeof attributeLabel === 'string')
    ? attributeToContent(attributes, attributeLabel)
    : attributes;
}

function startDisclosureSession(
  divaSessionId,
  attributes,
  attributeLabel,
) {
  const content = generateDisclosureContent(attributes, attributeLabel);

  const sprequest = {
    data: divaSessionId,
    validity: 60,
    timeout: 600,
    request: {
      content,
    },
  };

  const jwtOptions = divaConfig.jwtDisclosureRequestOptions;

  const signedVerificationRequestJwt = jwt.sign(
    { sprequest },
    divaConfig.apiKey,
    jwtOptions,
  );

  return requestIrmaSession(divaConfig.verificationEndpoint, signedVerificationRequestJwt);
}

function startSignatureSession(
  attributes,
  attributeLabel,
  message,
) {
  const content = generateDisclosureContent(attributes, attributeLabel);

  const absrequest = {
    validity: 60,
    timeout: 600,
    request: {
      message,
      messageType: 'STRING',
      content,
    },
  };

  const jwtOptions = divaConfig.jwtSignatureRequestOptions;

  const signedSignatureRequestJwt = jwt.sign(
    { absrequest },
    divaConfig.apiKey,
    jwtOptions,
  );

  return requestIrmaSession(divaConfig.signatureEndpoint, signedSignatureRequestJwt);
}

/**
 * Start an issuance session.
 * @param {*} credentials Array of the credentials to be issued. See
 * https://credentials.github.io/protocols/irma-protocol/#issuing for the format. Note that if
 * the validity of the credentials is not a multiple of 60*60*24*7 = 604800, the API server may
 * reject the issuance request, or it may accept it but floor it, depending on its configuration.
 * @returns {Promise<json>} Session token and content of IRMA QR
 */
function startIssueSession(credentials, attributes, attributeLabel) {
  const disclose = (attributes !== undefined)
    ? generateDisclosureContent(attributes, attributeLabel)
    : null;

  const iprequest = {
    validity: 600,
    timeout: 600,
    request: {
      credentials,
      disclose,
    },
  };
  const jwtOptions = divaConfig.jwtIssueRequestOptions;

  const signedIssueRequestJwt = jwt.sign(
    { iprequest },
    divaConfig.apiKey,
    jwtOptions,
  );

  return requestIrmaSession(divaConfig.issueEndpoint, signedIssueRequestJwt);
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

function verifyIrmaApiServerSignature(token) {
  const key = divaConfig.irmaApiServerPublicKey;
  return BPromise.try(() => jwt.verify(token, key, divaConfig.jwtIrmaApiServerSignatureOptions));
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

function completeSignatureSession(irmaSessionId, token) {
  return verifyIrmaApiServerSignature(token)
    .then((signatureResult) => {
      divaState.setIrmaEntry(irmaSessionId, 'COMPLETED'); // Async
      const { attributes, message, status } = signatureResult;
      return { jwt: token, attributes, message, proofStatus: status };
    });
}

function getProofs(divaSessionId) {
  return divaState.getDivaEntry(divaSessionId);
}

function removeDivaSession(divaSessionId) {
  return divaState.deleteDivaEntry(divaSessionId);
}

function finishIrmaApiProof(irmaSessionId) {
  return request
    .get(`${divaConfig.irmaApiServerUrl}${divaConfig.verificationEndpoint}/${irmaSessionId}/getproof`)
    .then(result => result.text)
    .then(proof => completeDisclosureSession(irmaSessionId, proof));
}

function getSignatureFromApiServer(irmaSessionId) {
  return request
    .get(`${divaConfig.irmaApiServerUrl}${divaConfig.signatureEndpoint}/${irmaSessionId}/getsignature`)
    .then(result => result.text)
    .then(signature => completeSignatureSession(irmaSessionId, signature));
}

function getIrmaSignatureStatus(irmaSessionId) {
  const getSignatureStatus = divaState.getIrmaEntry(irmaSessionId);
  const getServerStatus = request
    .get(`${divaConfig.irmaApiServerUrl}${divaConfig.signatureEndpoint}/${irmaSessionId}/status`)
    .type('text/plain')
    .then(result => result.body)
    .catch(() => { // eslint-disable-line arrow-body-style
      // The IRMA api server returns an error on expired sessions.
      // For now we treat all errors as non-existing irma disclosure sessions.
      return 'NOT_FOUND';
    });

  return BPromise
    .all([
      getSignatureStatus,
      getServerStatus,
    ])
    .spread((signatureStatus, serverStatus) => {
      if (serverStatus === 'DONE') {
        return getSignatureFromApiServer(irmaSessionId)
          .then(signature => ({
            signatureStatus: 'COMPLETED',
            serverStatus,
            ...signature,
          }));
      }

      // This is for when we poll again
      // TODO: does this work?
      if (signatureStatus === 'COMPLETED') {
        return {
          signatureStatus,
        };
      }

      if (serverStatus === 'CANCELLED' || serverStatus === 'NOT_FOUND') {
        divaState.setIrmaEntry(irmaSessionId, 'ABORTED'); // Async
        return {
          signatureStatus: 'ABORTED',
          serverStatus,
        };
      }

      // Pending
      return { signatureStatus, serverStatus };
    });
}

function getIrmaIssueStatus(irmaSessionId) {
  const getIssueStatus = divaState.getIrmaEntry(irmaSessionId);
  const getServerStatus = request
    .get(`${divaConfig.irmaApiServerUrl}${divaConfig.issueEndpoint}/${irmaSessionId}/status`)
    .type('text/plain')
    .then(result => result.body)
    .catch(() => { // eslint-disable-line arrow-body-style
      // The IRMA api server returns an error on expired sessions.
      // For now we treat all errors as non-existing irma disclosure sessions.
      return 'NOT_FOUND';
    });

  // Issuance sessions are easier than disclosure or signing sessions, as we don't have to retrieve
  // a proof or signature at the end of the session.
  return BPromise
    .all([
      getIssueStatus,
      getServerStatus,
    ])
    .spread((issueStatus, serverStatus) => {
      if (serverStatus === 'DONE') {
        return {
          issueStatus: 'COMPLETED',
          serverStatus,
        };
      }

      // Issuance status is PENDING
      // Set issueStatus to ABORTED when serverStatus is CANCELLED or NOT_FOUND
      if (serverStatus === 'CANCELLED' || serverStatus === 'NOT_FOUND') {
        divaState.setIrmaEntry(irmaSessionId, 'ABORTED'); // Async
        return {
          issueStatus: 'ABORTED',
          serverStatus,
        };
      }
      return {
        issueStatus,
        serverStatus,
      };
    });
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
      if (serverStatus === 'DONE') {
        return finishIrmaApiProof(irmaSessionId)
          .then(() =>
            this.getProofStatus(divaSessionId, irmaSessionId)
              .then(proofStatus => ({
                disclosureStatus,
                proofStatus,
                serverStatus, // TODO: investigate
              })),
          );
      }

      // This is for when we poll again
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
        // We set local state to ABORTED because when the IRMA API SERVER is not aware
        // of this irmaSession, and we don't have any record locally (which we check by
        // checking for COMPLETED above), we don't have any other option than setting
        // local state to ABORTED.
        divaState.setIrmaEntry(irmaSessionId, 'ABORTED'); // Async
        return {
          disclosureStatus: 'ABORTED',
          serverStatus,
        };
      }

      // Default case, still waiting for proof
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
module.exports.startSignatureSession = startSignatureSession;
module.exports.startIssueSession = startIssueSession;
module.exports.getAttributes = getAttributes;
module.exports.getProofs = getProofs;
module.exports.removeDivaSession = removeDivaSession;
module.exports.getIrmaAPISessionStatus = getIrmaAPISessionStatus;
module.exports.getIrmaSignatureStatus = getIrmaSignatureStatus;
module.exports.getIrmaIssueStatus = getIrmaIssueStatus;
module.exports.getProofStatus = getProofStatus;
