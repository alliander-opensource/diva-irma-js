/*!
 * diva-irma-js
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

'use strict';

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

/**
* Module dependencies.
* @private
*/

const uuidv4 = require('uuid/v4');
const jwt = require('jsonwebtoken');
const request = require('superagent');

const packageJson = require('./../package.json');

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
};

function version() {
  return packageJson.version;
};

// TODO make this more functional
function addProof(divaSessionState, proof) {
  divaSessionState.user.attributes.push(proof);
  return divaSessionState;
};

function deauthenticate() {
  return {
    user: {
      sessionId: uuidv4(),
      attributes: [],
    },
  };
};

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
};

function sendCookie(req, res) {
  res.cookie(divaConfig.divaCookieName, req.divaSessionState, divaConfig.cookieSettings);
};

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
};
