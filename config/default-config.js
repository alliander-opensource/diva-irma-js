const defaults = {
  verificationEndpoint: '/api/v2/verification',
  signatureEndpoint: '/api/v2/signature',
  issueEndpoint: '/api/v2/issue',
  jwtIrmaApiServerVerifyOptions: {
    algorithm: 'RS256',
    subject: 'disclosure_result',
  },
  jwtIrmaApiServerSignatureOptions: {
    algorithm: 'RS256',
    subject: 'abs_result',
  },
  jwtDisclosureRequestOptions: {
    algorithm: 'RS256',
    issuer: 'diva',
    subject: 'verification_request',
  },
  jwtSignatureRequestOptions: {
    algorithm: 'RS256',
    issuer: 'diva',
    subject: 'signature_request',
  },
  jwtIssueRequestOptions: {
    algorithm: 'RS256',
    issuer: 'diva',
    subject: 'issue_request',
  },
  useRedis: false,
  redisOptions: {
    host: '127.0.0.1',
    port: '6379',
  },
  addDisclosureJwt: false,
};

module.exports = defaults;
