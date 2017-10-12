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
  completeDisclosureSessionEndpoint: '/api/diva/completeDisclosureSession',
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

// TODO fix state in a better way!
const proofMap = {};

/**
* Module dependencies.
* @private
*/

const BPromise = require('bluebird');
const uuidv4 = require('uuid/v4');
const jwt = require('jsonwebtoken');
const request = require('superagent');

const packageJson = require('./../package.json');

function divaCookieParser(req, res, next) {
  if (typeof req.signedCookies[divaConfig.cookieName] === 'undefined' ||
      typeof req.signedCookies[divaConfig.cookieName].user === 'undefined' ||
      typeof req.signedCookies[divaConfig.cookieName].user.sessionId === 'undefined' ||
      typeof req.signedCookies[divaConfig.cookieName].user.attributes === 'undefined') {
    req.divaSessionState = this.deauthenticate();
    this.sendCookie(req, res);
  } else {
    req.divaSessionState = req.signedCookies[divaConfig.cookieName];
  }
  next();
}

function version() {
  return packageJson.version;
}

// TODO make this more functional
function addProof(divaSessionState, proof) {
  divaSessionState.user.attributes.push(proof);
  return divaSessionState;
}

// TODO Do we really want this to be stateful?
function completeDisclosureSession(proof) {
  return verifyProof(proof)
    .then((result) => {
      addProofToSession(result.session, result.attributes, proof);
    });
};

function deauthenticate() {
  return {
    user: {
      sessionId: uuidv4(),
      attributes: [],
    },
  };
}

function requireAttribute(attribute) {
  return (req, res, next) => {
    if (req.divaSessionState.user.attributes.indexOf(attribute) > -1) {
      next();
    } else {
      const attributesLabel = 'Geslacht';
      res
        .redirect(`/api/attributes-required?attribute=${attribute}&attributesLabel=${attributesLabel}`);
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

function sendCookie(req, res) {
  res.cookie(divaConfig.divaCookieName, req.divaSessionState, divaConfig.cookieSettings);
}

function startDisclosureSession(
  divaSessionId,
  attribute,
  attributesLabel,
) {
  const callbackUrl = appConfig.baseUrl + divaConfig.divaCompleteDisclosureSessionEndpoint;
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
    .then(result => JSON.stringify(result.body))
    .catch((error) => {
      // console.log(error);
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
  // const key = config.irmaApiServerPublicKey;
  // TODO: change decode to verify!
  // return BPromise.try(() => jwt.verify(token, key, jwtIrmaApiServerStatusOptions));
  return BPromise.try(() => jwt.decode(token));
}

/**
 * Check IRMA proof status
 * @function checkIrmaProofValidity
 * @param {json} jwtPayload IRMA JWT token from api server
 * @throws AuthenticationError if status is not equal to 'VALID'
 * @returns {Promise<json>} decoded IRMA JWT token from api server
 */
function checkIrmaProofValidity(jwtPayload) {
  const proofStatus = jwtPayload.status;
  if (proofStatus !== 'VALID') {
    throw new Error(`Invalid IRMA proof status: ${proofStatus}`); // TODO: custom error class
  }
  return BPromise.resolve(jwtPayload);
}

function verifyProof(proof) {
  return verifyIrmaApiServerJwt(proof)
    .then(decoded => checkIrmaProofValidity(decoded))
    .then(checkedToken => ({
      session: checkedToken.jti,
      attributes: checkedToken.attributes,
    }));
}

function addProofToSession(session, attributes, proof) {
  proofMap[session] = {
    attributes, // TODO merge current attributes with already existing attributes in session
    proof, // include original proof as well TODO: merge with older proofs
  };
  console.log(JSON.stringify(proofMap));
}

/**
* Module exports.
* @public
*/

module.exports = divaCookieParser;
module.exports.version = version;
module.exports.addProof = addProof;
module.exports.deauthenticate = deauthenticate;
module.exports.requireAttribute = requireAttribute;
module.exports.sendCookie = sendCookie;
module.exports.startDisclosureSession = startDisclosureSession;
module.exports.completeDisclosureSession = completeDisclosureSession;
