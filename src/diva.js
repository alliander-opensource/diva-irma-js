const packageJson = require('./../package.json');

exports.version = function version() {
  return packageJson.version;
};
