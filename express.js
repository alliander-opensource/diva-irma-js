/*!
 * diva-irma-js
 * Express middleware module for Diva
 * Copyright(c) 2017 Alliander, Koen van Ingen, Timen Olthof
 * BSD 3-Clause License
 */
const logger = require('./diva-logger')('express');

/**
* Module dependencies.
* @private
*/

function requireAttributes(divaSession, attributes) {
  return (req, res, next) => {
    logger.trace('calling requireAttributes()');
    divaSession.getMissingAttributes(req.sessionId, attributes)
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

function setLogLevel(level) {
  logger.level = level;
  logger.trace('calling setLogLevel()');
}

/**
* Module exports.
* @public
*/
module.exports.requireAttributes = requireAttributes;
module.exports.setLogLevel = setLogLevel;
