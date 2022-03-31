// Cloudflare AllowMe

import logger = require("anyhow")
import settings = require("./settings")

// Set the correct logging level.
if (settings.log.level == "none") {
    logger.setup("none")
} else {
    logger.setup("console")
    logger.setOptions({levelOnConsole: true, preprocessors: ["friendlyErrors"]})

    if (settings.log.level == "error") {
        logger.setOptions({levels: ["warn", "error"]})
    }
}

import * as cloudflare from "./cloudflare"
import * as server from "./server"

/**
 * Main execution.
 */
const run = async () => {
    try {
        logger.info("Index.run", "Starting the service")

        if (!settings.server.secret) throw new Error("Missing server token (ALLOWME_SERVER_SECRET)")
        if (!settings.cloudflare.token) throw new Error("Missing Cloudflare token (ALLOWME_CF_TOKEN)")
        if (!settings.cloudflare.zone && !settings.cloudflare.zoneId) throw new Error("Missing Cloudflare zone (ALLOWME_CF_ZONE or ALLOWME_CF_ZONEID, at least one is needed)")

        // Set defaults.
        if (settings.server.port == "") settings.server.port = "8080"
        if (settings.server.path == "") settings.server.path = "/allowme"
        if (settings.server.user == "") settings.server.user = "allowme"
        if (settings.server.home == "") settings.server.home = "https://github.com/igoramadas/cloudflare-allowme"
        if (settings.server.trustProxy == "") settings.server.trustProxy = "true"
        if (settings.ip.maxAge == "") settings.ip.maxAge = "1440"
        if (settings.ip.blockInterval == "") settings.ip.blockInterval = "60"
        if (settings.ip.denyCount == "") settings.ip.denyCount = "5"

        // Get account ID if none was set.
        if (!settings.cloudflare.accountId) {
            settings.cloudflare.accountId = await cloudflare.getAccountId()
            if (!settings.cloudflare.accountId) throw new Error("Failed to get the CLoudflare account ID")
        }

        // Get zone ID in case only a zone was specified.
        if (!settings.cloudflare.zoneId) {
            settings.cloudflare.zoneId = await cloudflare.getZoneId()
            if (!settings.cloudflare.zoneId) throw new Error("Failed to get the CLoudflare zone ID")
        }

        // If no list ID was specified, check if there's an "allowme" list instead.
        if (!settings.cloudflare.listId) {
            settings.cloudflare.listId = await cloudflare.getListId()
            if (!settings.cloudflare.listId) throw new Error("Failed to get the CLoudflare list ID")
        }

        server.prepare()
        server.start()
    } catch (ex) {
        logger.error("Index.run", ex)
    }
}

run()
