/*!
 * diva-irma-js
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

// TODO get these from appconfig
const appConfig = {
  baseUrl: 'http://localhost/',
};

const divaConfig = {
  apiKey: 'SECRET',
  cookieSecret: 'StRoNGs3crE7',
  cookieName: 'diva-session',
  cookieSettings: {
    httpOnly: true,
    maxAge: 300000,
    sameSite: true,
    signed: true,
    secure: false, // TODO: NOTE: must be set to true and be used with HTTPS only!
  },
  completeDisclosureSessionEndpoint: '/api/complete-disclosure-session',
  irmaApiServerUrl: 'https://dev-diva-irma-api-server.appx.cloud',
  irmaApiServerPublicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAql7fb0EMMkqKcXIuvCVb
P+V1qV6AIzhxFlBO8k0GLogMUT6UXJSnXQ3P7iTIfr+/5+yf4dfKNHhalphe+2OB
zspt6zymteKAuQ9/NwUNGTSP4l8mD8wQb5ZyiNMUt6leu42SPe/7uOtcRA6AzN2L
6eKNqUGpNvQZTVwEFNNNiChqrkmQVnoyWVe6fHHooxTCtIyXWJY2WqC8lYStIbZc
NP5xwUdLGOuGo41T7Q+wkR5KqXDif+FKoR7qlG7jEUHcbd1OQe7b6DxzSHCI65Bw
TIZwMj2LtEwB6Op7vemHkeNaPAYK33t5kdyq+P55KMDuJgj+nxpFO00U4msD+CRa
7QIDAQAB
-----END PUBLIC KEY-----`,
};

const verificationEndpoint = '/api/v2/verification';
const jwtIrmaApiServerVerifyOptions = {
  algorithm: 'RS256',
  subject: 'disclosure_result',
};

// TODO fix state in a better way!
const divaState = new Map();

/**
* Module dependencies.
* @private
*/

const BPromise = require('bluebird');
const jwt = require('jsonwebtoken');
const request = require('superagent');

const packageJson = require('./../package.json');

function version() {
  return packageJson.version;
}

// TODO: make this check more sophisticated
function checkAttribute(divaSessionId, attribute) {
  return divaState.get(divaSessionId) !== undefined &&
    divaState.get(divaSessionId).attributes !== undefined &&
  divaState.get(divaSessionId).attributes[attribute] !== undefined;
}

function requireAttribute(attribute) {
  return (req, res, next) => {
    if (checkAttribute(req.divaSessionState.sessionId, attribute)) {
      next();
    } else {
      // TODO: make redirect and label not hard-coded
      const attributesLabel = 'Geslacht';
      res
        .redirect(`/api/start-disclosure-session?attribute=${attribute}&attributesLabel=${attributesLabel}`);
      // res
      //   .status(401)
      //   .send({
      //     success: false,
      //     requiredAttributes: [attribute],
      //     message: `You are missing attribute ${attribute}`,
      //   });
    }
  };
}

function addApiServerUrl(qrContent) {
  return {
    ...qrContent,
    u: `${divaConfig.irmaApiServerUrl}${verificationEndpoint}/${qrContent.u}`,
  };
}

function startDisclosureSession(
  divaSessionId,
  attribute,
  attributesLabel,
) {
  const callbackUrl = appConfig.baseUrl + divaConfig.completeDisclosureSessionEndpoint;
  const sprequest = {
    callbackUrl,
    data: divaSessionId,
    validity: 60,
    timeout: 60,
    request: {
      content: [
        {
          label: attributesLabel,
          attributes: [attribute],
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
    .post(divaConfig.irmaApiServerUrl + verificationEndpoint)
    .type('text/plain')
    .send(signedVerificationRequestJwt)
    .then(result => addApiServerUrl(result.body))
    .then(JSON.stringify)
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
  return BPromise.try(() => jwt.verify(token, key, jwtIrmaApiServerVerifyOptions));
}

function addIrmaProof(proofResult, irmaSessionId) {
  const divaSessionId = proofResult.jti;
  const divaStateEntry = (divaState.get(divaSessionId) !== undefined)
    ? divaState.get(divaSessionId)
    : new Map();

  divaStateEntry.set(irmaSessionId, proofResult);
  divaState.set(divaSessionId, divaStateEntry);
}

function completeDisclosureSession(token, irmaSessionId) {
  return verifyIrmaApiServerJwt(token)
    .then((proofResult) => {
      addIrmaProof(proofResult, irmaSessionId);
    });
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
  divaState.get(divaSessionId).forEach((_, proof) => {
    if (proof.status === 'VALID') {
      const attributeMap = proof.attributes;
      Object.keys(attributeMap).forEach((name) => {
        attributes = mergeAttribute(attributes, name, attributeMap[name]);
      });
    }
  });

  return attributes;
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

/**
* Module exports.
* @public
*/

module.exports.version = version;
module.exports.requireAttribute = requireAttribute;
module.exports.startDisclosureSession = startDisclosureSession;
module.exports.completeDisclosureSession = completeDisclosureSession;
module.exports.getAttributes = getAttributes;
module.exports.getProofs = getProofs;
module.exports.removeDivaSession = removeDivaSession;
