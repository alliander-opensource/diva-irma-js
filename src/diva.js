const packageJson = require('./../package.json');

exports.version = function version() {
  return packageJson.version;
};

exports.addProof = function addProof(divaSessionState, proof) {
  divaSessionState.user.attributes.push(proof);
}
