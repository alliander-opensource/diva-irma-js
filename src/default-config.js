const defaults = {
  verificationEndpoint: '/api/v2/verification',
  signatureEndpoint: '/api/v2/signature',
  jwtIrmaApiServerVerifyOptions: {
    algorithm: 'RS256',
    subject: 'disclosure_result',
  },
  jwtIrmaApiServerSignatureOptions: {
    algorithm: 'RS256',
    subject: 'abs_result',
  },
  useRedis: false,
  redisOptions: {
    host: '127.0.0.1',
    port: '6379',
  },
};

module.exports = defaults;
