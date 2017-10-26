const defaults = {
  completeDisclosureSessionEndpoint: '/api/complete-disclosure-session',
  verificationEndpoint: '/api/v2/verification',
  jwtIrmaApiServerVerifyOptions: {
    algorithm: 'RS256',
    subject: 'disclosure_result',
  },
  useRedis: false,
  redisOptions: {
    host: '127.0.0.1',
    port: '6379',
  },
};

module.exports = defaults;
