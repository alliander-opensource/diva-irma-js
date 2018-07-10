# diva-irma-js

This repository contains the DIVA JavaScript SDK.
DIVA is an SDK to easily integrate [IRMA attributes](https://privacybydesign.foundation/irma-controleur/) into NodeJS based applications.

## Overview

This library consist of the following part, which can work independent from each other:

- diva-irma-js
    - A library that allows NodeJS backend applications to easily communicate with an [IRMA API server](https://github.com/privacybydesign/irma_api_server)
    - This module depends on diva-irma-js/state.
- diva-irma-js/state
    - Internal module to store Diva and IRMA sessions. It uses in-mem or Redis for storage of IRMA sessions.
    - Do NOT import this module directly, but use:
- diva-irma-js/session
    - Session management library that use diva-irma-js/state for session storage.
    - This module depends on diva-irma-js/state.
- diva-irma-js/express
    - Express middleware that can be used to check requests on disclosed attributes.
    - This module depends on diva-irma-js/session.

## Example / reference implementation

For a full starter project that shows how to use the three core components with examples, see the [DIVA js Reference Third Party](https://github.com/Alliander/diva-js-reference-3p)

## Usage

First add diva-irma-js as a dependency

`npm install diva-irma-js --save`

Then import/require the relevant Diva components:

### Quick start guide: verifying an attribute

See the API reference below for more details and points on each step. Also, see (the [DIVA js Reference Third Party](https://github.com/Alliander/diva-js-reference-3p) for an example).

First initialize `diva-irma-js/session`:

```
    const divaSession = require('diva-irma-js/session');
    const divaStateOptions = { useRedis: false };
    divaSession.init(divaStateOptions);
```

After initialising the Diva session module, import the diva library and set an IRMA Api Server  (see below for options on how to do this).

```
    const diva = require('diva-irma-js');
    const divaOptions = {
       ...divaStateOptions                       // See above
      jwtDisclosureRequestOptions: {
        algorithm: 'none',
        issuer: 'diva',
      },
      jwtSignatureRequestOptions: {
        algorithm: 'none',
        issuer: 'diva',
      },
      jwtIssueRequestOptions: {
        algorithm: 'none',
        issuer: 'diva',
      },
      irmaApiServerUrl: 'http://FILL_IN:8080',
      irmaApiServerPublicKey: `-----BEGIN PUBLIC KEY-----
    FILL_IN
    `,
    };
    diva.init(divaOptions);
```

Now we can request a new disclosure session for a street attribute:

```
    const divaSessionId = 'foobar';   // This can be any string: use this to integrate diva-irma-js into your own session management system!
    diva.startDisclosureSession(['irma-demo.MijnOverheid.address.street'], 'Test label', divaSessionId)
      .then(irmaSessionInfo => ...);
```

irmaSessionInfo contains the string `irmaSessionId` and a `qrContent` object that needs to be converted to a QR code. The QR code can be scanned by the IRMA app.


After the QR code has been shown to the user, we can poll the IRMA api server for the current status:

```
     diva.getIrmaStatus('DISCLOSE', irmaSessionId)
       .then(irmaStatus => ...);
```

See below for possible statuses. After `irmaStatus.serverStatus` is 'DONE', we can retrieve the proof and add it to the IRMA session:

```
    if (irmaStatus.serverStatus === 'DONE') {
      divaSession.addAttributesFromProof(irmaStatus.disclosureProofResult, irmaSessionId);
    }
```

Now we can retrieve the disclosed attributes using the `divaSessionId` we defined earlier:

```
  getAttributes(divaSessionId)
    .then(attributes => ...)
```

You now have a working Diva installation!

#### Troubleshooting

If it does not work for some reason, first try to increase the log level by passing `logLevel: 'DEBUG'` to the `divaOptions`. Hopefully this will print some useful error messages. Also, looking at the IRMA Api Server logs can help sometimes.


## API reference

### diva-irma-js/session

This module is used for session storage of IRMA sessions. It uses in-mem or Redis for storage using diva-irma-js/state.

This module is initialized in the following way:
```
    const divaSession = require('diva-irma-js/session'); // Import this modulule
    const divaStateOptions = {};                         // See below
    divaSession.init(divaStateOptions);                  // Init module (this will create the actual in-mem or Redis store)
```

#### divaStateOptions

The following options can be passed to divaState:

- `useRedis`: True/False (Use Redis or in-mem storage)
- `redisOptions`: Dict with redis options, namely:
    - `host`: Redis host
    - `port`: Redis port
    - `password`: Redis password
- `logLevel`: [log4js](https://www.npmjs.com/package/log4js) log level (TRACE is most fine-grained)

#### IRMA vs Diva session

In diva-irma-js/state, we manage two type of sessions: IRMA sessions and Diva sessions. IRMA sessions are short-lived, and only exist in one IRMA interactive proof. These sessions are used by the IRMA Api Server and are also passed to the user via a QR code.

Diva sessions are more long-term and can for instance be bound to a specific browser/user via an HTTP cookie (the [DIVA js Reference Third Party](https://github.com/Alliander/diva-js-reference-3p) does this for example). Attributes disclosed in IRMA sessions can be bound to a Diva session. Also pending and failed IRMA sessions can be bound to a Diva session. This way, we can store a log of executed IRMA actions of a user.

#### Exposed functions:

_BASIC functions:_
- `getAttributes(divaSessionId)`
    - Obtain attributes belonging to a session. All non-valid attributes are filtered and won't be returned.
    - This method can be used to check which attribute a user has disclosed in earlier IRMA sessions.
- `addAttributesFromProof(irmaSessionId)`:
    - Add IRMA attributes from an IRMA session to a Diva Session.
    - This way, attributes can later be obtained using `getAttributes(divaSessionId)`.
    - Note that this function *must* be called after an IRMA session is done. See [src/actions/irma-session-status.js](https://github.com/Alliander/diva-js-reference-3p-backend/blob/develop/src/actions/irma-session-status.js) in the [DIVA js Reference Third Party](https://github.com/Alliander/diva-js-reference-3p) for an example.
- `removeDivaSession(divaSessionId)`
    - Remove a session from the store
- `requireAttributes(attributes,divaSessionId)`
    - Check whether a specific DivaSessionId has disclosed the specified attributes, throw an exception otherwise.

_Advanced functions:_ (normally not needed outside diva-js):
- `getProofStatus(divaSessionId, irmaSessionId)`
    - Get a proof from a Diva Session belonging to a specific irmaSession.
- `getProofs(sessionId)`
    - Obtain raw IRMA JWT proofs for a session. Note that this also returns failed (i.e. non-valid) IRMA sessions/proofs.
- `getMissingAttributes(divaSessionId, attributes)`
    - Show which attributes are missing from a divaSessionId.

### diva-irma-js/express

`Diva-irma-js/express` can be used to protect endpoints, and only return them if a user has disclosed the specified attributes. This module depends on a correctly initialized `diva-irma-js/session` library, see above on how to do that.

After that, this library can be imported in the following way:

```
    const divaExpress = require('diva-irma-js/express');
```

Then, endpoints can be protected in the following way:
```
    app.use('/api/endpoint/to/protect', divaExpress.requireAttributes(divaSession, ['irma-demo.MijnOverheid.address.street']), require('./actions/protected-endpoint'));
```

In this way, `/api/endpont/to/protect` can only be visited if a user had disclosed its street attribute.


### diva-irma-js

The core library is used for communication with the IRMA Api Server. It therefore requires a working IRMA Api Server.

To run your own local IRMA API SERVER, see its [README](https://github.com/privacybydesign/irma_api_server/blob/master/README.md). We recommend running it with [Docker](https://github.com/privacybydesign/irma_api_server#running-with-docker), because that save a lot of configuration. The 'Running With Docker tutorial' also shows a script that will generate the required public key.

This module depends on `diva-irma-js/state`, and therefore depends on the `diva-irma-js/session` options, see above.

```
    const diva = require('diva-irma-js');       // Import diva library
    const divaStateOptions = {};                // divaStateOptions are needed here as well, see above.
    const divaOptions = {                       // Options for ApiServer communication
      ...divaStateOptions
    };
    diva.init(divaOptions);                     // Init Diva library
```

#### divaOptions
- `baseUrl`: URL (port included) on which the backend that uses this library is available.
- `apiKey`:  JWT Private key to sign requests to the Api Server with. See the [README](https://github.com/privacybydesign/irma_api_server#jwt-keys) of the IRMA Api Server on how to configure these at the server. Note that the [Docker](https://github.com/privacybydesign/irma_api_server#running-with-docker) version of the IRMA Api Server by defaults accepts unsigned requets, so if you're using that version this field can be omitted.
- `irmaApiServerUrl`: URL of the IRMA Api Server (port included).
- `irmaApiServerPublicKey`: Public key of the IRMA Api Server. This key is needed to verify JWT responses from the IRMA Api Server. The script that is used to run the Docker version of the IRMA Api Server will print this key for yiou.
- `jwtDisclosureRequestOptions`, `jwtIssueRequestOptions`, `jwtSignatureRequestOptions`: JWT options for requests that are sent to the IRMA Api Server, which are:
    - `subject`: Subject of the JWT token, should be `verification_request`, `issue_request` and `signature_request` in order to get the JWT accepted by the IRMA APi Server
    - `algorithm`: JWT signing algorithm, should be 'none' of no apiKey is set up. Otherwise, use `RS256`.
    - `issuer`: The issuer of this JWT, an issuer corresponds in the IRMA Api Server to a private key (apiKey in Diva). The issuer is also shown in the IRMA App after scanning a QR code. The Docker version of the IRMA Api Server accepts all possible values for issuer.
- `logLevel`: [log4js](https://www.npmjs.com/package/log4js) log level (TRACE is most fine-grained)

#### Exposed functions:
See the [DIVA js Reference Third Party](https://github.com/Alliander/diva-js-reference-3p) for an example implementation of all the functions exposed functions.

`version()` will return the currently running Diva library version.

_Starting an IRMA session_:

Use one of these three functions to respectively start a disclosure, signing or issuing session. All these functions return an `irmaSessionData` object, which needs to be passed to the user in the form of a QR code.

- `startDisclosureSession(attributes, attributeLabel, divaSessionId)`: Start an IRMA Disclosure session. Attributes is an array of requested IRMA attributes (for instance `['irma-demo.MijnOverheid.address.street']`. Together, they will construct the `content` object that is sent to the IRMA Api Server. `divaSesssionId` is the Diva session where the resulting IRMA session will be connected to. `attributeLabel` can be any string.
   Alternatively, attributes can be defined as 'a set of conjunctions containing disjunctions, a concept that is more powerful (but complex) and explained [here](http://credentials.github.io/protocols/irma-protocol/#verification).
- `startSignatureSession(attributes, attributeLabel, message,)`: Start an IRMA Signature session. In addition to attributes and a label, the message to be signed need to be provided as well.
- `startIssueSession(credentials, attributes, attributeLabel)`: Start an IRMA Issue session. See http://credentials.github.io/protocols/irma-protocol/#issuing on how to define `credentials`. `Attributes` and `AttributeLabel` are optional here and only needed if you want to disclose attributes before issuing.

_Polling the status of a running session:_:

Use `getIrmaStatus(irmaSessionType, irmaSessionId)` to retrieve the session status of a running IRMA session.
- `irmaSessionType`: This can either be 'DISCLOSE', 'SIGN' or 'ISSUE'.
- `irmaSessionId`: The IRMA Session id as returned by the IRMA Api Server to one of the startSession() functions.

This function will return an `irmaSessionStatus` and a `serverStatus`.

ServerStatus is the status that is returned by the IRMA Api Server, which can be:
- `INITIALIZED`: Session has been created at server.
- `CONNECTED`: User scanned the QR code and connected to the Api Server with the IRMA App.
- `CANCELLED`: User cancelled on the phone (or doesn't possess the required attributes/forgot his pin/etc.).
- `DONE`: The IRMA session has been done, a disclosure proof or signature can be retrieved.
- `NOT_FOUND`: The IRMA session cannot be found. (note that sessions that are done and, will also be `NOT_FOUND` after the proof has been retrieved.

IrmaSessionStatus is Divas own locally cached version of the ServerStatus (mainly to prevent `NOT_FOUND` after the session is done):
- `PENDING`: Session has been created at server.
- `ABORTED`: User cancelled on the phone (or doesn't possess the required attributes/forgot his pin/etc.).
- `COMPLETED`: The IRMA session has been done, a disclosure proof or signature can be retrieved.

## IRMA

For more information about IRMA, see: https://privacybydesign.foundation/irma/

The IRMA client apps can be downloaded from their respective app stores:

- [Apple App Store](https://itunes.apple.com/nl/app/irma-authentication/id1294092994?mt=8)
- [Google Play Store](https://play.google.com/store/apps/details?id=org.irmacard.cardemu)

Other components in the IRMA ecosystem include:

- [IRMA Android/iOS app](https://github.com/privacybydesign/irma_mobile)
- [IRMA API server](https://github.com/privacybydesign/irma_api_server)
