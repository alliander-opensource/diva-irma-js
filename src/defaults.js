const defaults = {
  completeDisclosureSessionEndpoint: '/api/complete-disclosure-session',
  verificationEndpoint: '/api/v2/verification',
  jwtIrmaApiServerVerifyOptions: {
    algorithm: 'RS256',
    subject: 'disclosure_result',
  },
};

module.exports = defaults;
