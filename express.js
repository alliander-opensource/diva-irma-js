/*!
 * diva-express
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */

/**
* Module dependencies.
* @private
*/

function getMissingAttributes(divaSession, divaSessionId, requiredAttributes) {
  return divaSession.getAttributes(divaSessionId)
    .then((attributes) => {
      const existingAttributes = Object.keys(attributes);
      return requiredAttributes.filter(el => !existingAttributes.includes(el));
    });
}

function requireAttributes(divaSession, attributes) {
  return (req, res, next) => {
    getMissingAttributes(divaSession, req.sessionId, attributes)
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
module.exports.requireAttributes = requireAttributes;
