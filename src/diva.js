const uuidv4 = require('uuid/v4');

const packageJson = require('./../package.json');

exports.version = function version() {
  return packageJson.version;
};

// TODO make this more functional
exports.addProof = function addProof(divaSessionState, proof) {
  divaSessionState.user.attributes.push(proof);
  return divaSessionState;
};

exports.deauthenticate = function deauthenticate() {
  return {
    user: {
      sessionId: uuidv4(),
      attributes: [],
    },
  };
};

exports.requireAttribute = function requireAttribute(attribute) {
  return (req, res, next) => {
    if (req.divaSessionState.user.attributes.indexOf(attribute) > -1) {
      next();
    } else {
      res
        .status(401)
        .send({
          success: false,
          message: `You are missing attribute  ${attribute}`,
        });
    }
  };
};
