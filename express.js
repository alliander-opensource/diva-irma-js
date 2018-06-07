/*!
 * diva-express
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

let divaSession;

/**
* Module dependencies.
* @private
*/

function getMissingAttributes(divaSessionId, requiredAttributes) {
  return divaSession.getAttributes(divaSessionId)
    .then((attributes) => {
      const existingAttributes = Object.keys(attributes);
      return requiredAttributes.filter(el => !existingAttributes.includes(el));
    });
}

function requireAttributes(attributes) {
  return (req, res, next) => {
    getMissingAttributes(req.sessionId, attributes)
      .then((missingAttributes) => {
        if (missingAttributes.length === 0) {
          next();
        } else {
          res
            .status(401)
            .send({
              success: false,
              requiredAttributes: attributes,
              message: `You are missing attributes: [${missingAttributes}]`,
            });
        }
      });
  };
}

/**
* Module exports.
* @public
*/
module.exports = function init(state) {
  if (state === undefined) {
    throw new Error('You must call this module with a state object, see documentation');
  }

  divaSession = require('./session')(state); // eslint-disable-line global-require

  return {
    requireAttributes,
  };
};

// TODO: import check via wrapper file?

module.exports.requireAttributes = requireAttributes;
