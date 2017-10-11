const uuidv4 = require('uuid/v4');

const packageJson = require('./../package.json');

exports.version = function version() {
  return packageJson.version;
};

// TODO make this more functional
exports.addProof = function addProof(divaSessionState, proof) {
  divaSessionState.user.attributes.push(proof);
  return divaSessionState;
}

exports.deauthenticate = function deauthenticate() {
  return {
    user: {
      sessionId: uuidv4(),
      attributes: [],
    },
  };;
}
