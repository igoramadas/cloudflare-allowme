# Anyhow

[![Version](https://img.shields.io/npm/v/anyhow.svg)](https://npmjs.com/package/anyhow)
[![Coverage Status](https://coveralls.io/repos/github/igoramadas/anyhow/badge.svg?branch=master)](https://coveralls.io/github/igoramadas/anyhow?branch=master)
[![Build Status](https://github.com/igoramadas/anyhow/actions/workflows/build.yml/badge.svg)](https://github.com/igoramadas/anyhow/actions)

Drop-in (and slightly improved) logging wrapper for [Winston](https://www.npmjs.com/package/winston), [Bunyan](https://www.npmjs.com/package/bunyan), [pino](https://www.npmjs.com/package/pino), [Google Cloud Logging](https://github.com/googleapis/nodejs-logging) and [console](https://nodejs.org/api/console.html).

## Why?

The idea for Anyhow came after a conflict of interests regarding logging libraries in personal and work projects. Some of these projects were using winston. A few other bunyan. Some were simply streaming to the console.

By using Anyhow we can achieve a consistent logging mechanism regardless of what library is actually doing the logging. Install Anyhow, replace the log calls and let it delegate the actual logging to the correct library. It also has some handy features like compacting the messages, pre-processing arguments, extracting error details and stylizing the console output.

## Basic usage

```javascript
const logger = require("anyhow")

// Setup passing no arguments will default to the console.
logger.setup()

// To use a specific logging library (winston in this case):
logger.setup("winston")

// Setting the options.
logger.options = {
    compact: true,
    maxDepth: 6,
    appName: "Anyhow",
    levels: ["info", "warn", "error"],
    styles: {
        debug: ["gray"],
        info: ["white"],
        warn: ["yellow"],
        error: ["red", "bold"]
    },
    preprocessorOptions: {
        maskedFields: ["password", "token"],
        clone: true
    }
}

// Log some text.
logger.info("My app has started")

// Mix and match arguments.
logger.info({someJson: "hello world"}, "Some string", 123, new Date())

// Log exceptions.
try {
    oops.itFailed()
} catch (ex) {
    logger.error("MyApp.method", ex)
}

// By default "debug" level is disabled, so this won't log anything.
logger.debug("This will not be logged", myObject)

// Now it will.
logger.setOptions({levels: ["debug", "info", "warn", "error"]})
logger.debug("Now it's logged", anotherObject)

// Enable only warn and error logging, so info calls won't do anything.
logger.setOptions({levels: ["warn", "error"]})
logger.info("Won't log because we only enabled warn and error")
logger.warn("This warning will be logged")

// You can also call the log() method directly, passing level as the first argument.
// Useful when using custom loggers.
logger.log("warn", "This will be called as warn", someExtraObject, 123, true)
```

### Enforcing a specific library

```javascript
// Winston defaults.
logger.setup("winston")

// Or pass the winston logger directly.
const winstonLogger = require("winston").createLogger(options)
logger.setup({name: "winston", instance: winstonLogger})

// Same for bunyan.
logger.setup("bunyan")

// Or...
const bunyanLogger = require("bunyan").createLogger(options)
logger.setup({name: "winston", instance: bunyanLogger})

// Also pino.
logger.setup("pino")

// And Google Cloud Logging. Log name will default to the appName, lowercased and with no spaces.
logger.setup("gcloud")

// Please note that Google Cloud Logging expects the default credentials set up on the machine.
// If you haven't configured the Google Cloud SDK or credentials on the machine, you must
// provide the authentication options during setup.
const googleOptions = {
    logName: "anyhow-testing",
    projectId: env.GCP_PROJECT_ID,
    credentials: {
        client_email: env.GCP_CLIENT_EMAIL,
        private_key: env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n")
    }
}
logger.setup("gcloud", googleOptions)

// Disable logging entirely.
logger.setup("none")
```

### Changing settings

```javascript
// Separate logged arguments with a ", " comma instead of default " | " pipe.
logger.setOptions({separator: ", "})

// Outputs "This is, now separated, by comma".
logger.info("This is", "now separated", "by comma")

// Do not compact messages (default is compact = true).
logger.setOptions({compact: false})

// Logged output will contain JSON with spaces and line breaks.
logger.info(someComplexObject, somethingElse)

// Make warn messages red and italic instead of default yellow (depends on "chalk" module).
logger.setOptions({styles: {warn: ["red", "italic"]}})
logger.warn("Console output now shows yellow italic for this")
logger.info("Info is still default gray")

// Disable styling.
logger.setOptions({styles: null})
logger.warn("No console styles anymore, even if chalk is installed")

// Prepend log level on the console.
logger.setOptions({levelOnConsole: true})
logger.info("This will now have 'INFO:' on the beginning of the message")

// If you use the options setter, unpassed options will be reverted to the defaults.
logger.options = {timestamp: true}

// Now the separator that was set to ", " is reverted to " | ".
logger.info("This", "should be separated with a bar now")
```

### Preprocessors

```javascript
// Sample user object.
const user = {
    name: "John Doe",
    password: "mypass",
    token: "sometoken",
    registered: new Date(),
    foo: function Foo() {},
    team: {
        a: {
            b: {
                c: {

                }
            }
        }
    }
}

// No preprocessor by default, will log all user data.
logger.info(user)

// Enable the "cleanup" preprocessor to have proper classes identified, dates formatted, etc.
logger.setOptions({preprocessors: ["cleanup"]})

// Looks slightly better.
logger.info(user)

// Enable the "maskSecrets" preprocessor to mask the password and token.
logger.setOptions({preprocessors: ["maskSecrets"]})

// Now password and token gets replaced with [***].
logger.info(user)

// Enable the "friendlyErrors" preprocessor to extract error details.
logger.setOptions({preprocessors: ["friendlyErrors"]})

// This should log the status code and message.
try{
    axios.get("https://my.api.com/something-to-fail")
} catch (ex) {
    logger.error(ex)
}

// Add preprocessor to use toString() and prepend all values with @.
const numToString = (args) => args.map(a => `@ ${a.toString()}`)
logger.setOptions({preprocessors: [numToString]})

// Will output @ 1 | @ 2 | @ Sat Jan 01 2000 00:00:00 GMT+0100 (Central European Standard Time)
logger.info(1, 2, new Date("2000-01-01T00:00:00"))

// To enabled multiple preprocessors:
logger.setOptions({preprocessors: ["friendlyErrors", "maskSecrets", numToString]})
```

### Uncaught and unhandled errors

```javascript
// Enable the uncaught exceptions handled.
logger.setOptions({uncaughtExceptions: true})

// Throw some exception.
// Will log the "Not a function" exception to the current transport.
// Code will not execute from here, but exception was logged to the console.
let notFunction = true
notFunction()

// Also for unhandled rejections.
logger.setOptions({unhandledRejections: true})

// Here a sample of unhandled rejection.
let failFunction = async function() {
    throw new Error("Oh no!")
}
// Will log the unhandled rejection.
failFunction()

```

## Options

### appName: string, _"Anyhow"_

Optional, the name of your app / tool / service.

### compact: boolean, _true_

Defines if messages should be compacted (remove line breaks and extra spaces, minify the JSON output, flatten arrays, etc).

### levels: string[], _["info", "warn", "error"]_

Defines which logging levels are enabled. The standard logging levels
are ["debug", "info", "warn", "error"]. Debug should usually not be enabled in production.

### maxDepth: number, _6_

The maximum tree depth to follow when processing and logging arrays and objects.

### levelOnConsole: boolean, _false_

If true it will prepend the log level (INFO, WARN, ERROR etc...) to the message on the console.

### preprocessors: string / function[], _null_

Array of preprocessors to be enabled, passed as functions or strings. Preprocessor functions should accept a single
array containing the arguments to be parsed. The following built-in preprocessors strings are available:

#### cleanup

Cleanup the message output by removing non-relevant data from logged objects and replacing
functions / custom objects with [Function] / [object Type] strings.

#### friendlyErrors

Extract the exception code, status and message instead of logging the full exception object.
Supports axios and fetch exceptions out-of-the-box.

#### maskSecrets

Replace sensitive credentials with [***]. The actual field names to be masked are set
under the `preprocessorOptions`, see below.

### preprocessorOptions: object

Additional options to be passed to the preprocessors:

### clone: boolean, _true_

Boolean, if set to false then objects will not be cloned before running the preprocessors.
Only set to false if you are dealing exclusively with JSON data that can be mutated by the logger.

#### errorStack: boolean, _false_

Boolean, if set to true then exception stack traces will also be logged.

#### maskedFields: string[], _default below_

Array of strings, property names (case insensitive) that should be masked with the maskSecrets preprocessor. Defaults to:
`authorization, password, passcode, secret, token, accesstoken, access_token, refreshtoken, refresh_token, clientsecret, client_secret, apikey, api_key, apisecret, api_secret, privatekey, private_key`

#### uncaughtException: boolean, _false_

Boolean, if true it will log uncaught exceptions to the console (and will NOT quit execution).

#### unhandledRejections: boolean, _false_

Boolean, if true it will log uncaught exceptions to the console (and will NOT quit execution).

#### separator: string, _" | "_

String, defines the default separator between logged objects. For instance if you do a
`info(123, "ABC")`, output will be "123 | ABC".

#### styles: object

Object with keys defining the styles for each level on console output. This will only be effective
if you also have the [chalk](https://www.npmjs.com/package/chalk) module installed. By default
`debug` is gray, `info` white, `warn` yellow and `error` bold red. To disable, set it to null.

### timestamp: boolean, _false_

Boolean, if true it will prepend log messages with a timestamp.

## Methods

#### console(level, args) -> string

Log to console directly, regardless of which library is currently active. First argument is
the `level` string, and second is array of things to be logged.
Returns the final, parsed message that was logged.

#### log(level, args) -> string

Main logging method. First argument is the `level` string, and second is array of things to be logged.
Please note that only "info", "warn" and "error" levels are enabled by default.
Returns the final, parsed message that was logged.

#### debug(...args) -> string

Shortcut to log("debug", args). Please note that "debug" is not included on the default `levels`.

#### info(...args) -> string

Shortcut to log("info", args).

#### warn(...args) -> string

Shortcut to log("warn", args).

#### error(...args) -> string

Shortcut to log("error", args).

## Version 3 breaking changes

If you are using the default options, there's nothing to worry about - the logging methods have the same
signature and are backwards-compatible. Otherwise, please use the new `options` object:

### New options

```javascript
// Before
anyhow.appName = "My App"
anyhow.compact = true
anyhow.levels = ["debug", "info", "warn", "error"]
anyhow.preprocessor = someFunction

// Now: option 1, here the levels and preprocessors are replaced with the new values:
anyhow.options = {
    appName: "My App",
    compact: true,
    levels: ["debug", "info", "warn", "error"],
    preprocessors: [someFunction]
}

// And here levels and preprocessors are not passed, so they'll revert back to the defaults:
anyhow.options = {
    appName: "My App",
    compact: true
}

// Or option 2: set only specific options. Here the levels and preprocessors are left untouched.
anyhow.setOptions({appName: "MyApp", compact: true})
```

## API documentation

You can browse the full API documentation at https://anyhow.devv.com.

Or check these following projects that are using Anyhow for logging:

* [Expresser](https://github.com/igoramadas/expresser)
* [Monitorado](https://github.com/igoramadas/monitorado)
* [PandaGainz](https://github.com/igoramadas/pandagainz)
* [SetMeUp](https://github.com/igoramadas/setmeup)
* [Strautomator](https://github.com/strautomator/core)
