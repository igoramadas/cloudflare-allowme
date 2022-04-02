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

        if (!settings.cloudflare.token) throw new Error("Missing Cloudflare token ($ALLOWME_CF_TOKEN)")
        if (!settings.cloudflare.zone) throw new Error("Missing Cloudflare zone ($ALLOWME_CF_ZONE)")
        if (!settings.server.secret) throw new Error("Missing server token ($ALLOWME_SERVER_SECRET)")

        // Set defaults.
        if (settings.server.port == "") settings.server.port = "8080"
        if (settings.server.user == "") settings.server.user = "allowme"
        if (settings.server.prompt == "") settings.server.prompt = "true"
        if (settings.server.home == "") settings.server.home = "https://devv.com"
        if (settings.server.trustProxy == "") settings.server.trustProxy = "true"
        if (settings.ip.maxAge == "") settings.ip.maxAge = "1440"
        if (settings.ip.blockInterval == "") settings.ip.blockInterval = "60"
        if (settings.ip.denyCount == "") settings.ip.denyCount = "5"

        // Get the account ID if none was set.
        if (!settings.cloudflare.accountId) {
            settings.cloudflare.accountId = await cloudflare.getAccountId()
            if (!settings.cloudflare.accountId) throw new Error("Failed to get the Cloudflare account ID")
        }

        // Get the zone ID.
        settings.cloudflare.zoneId = await cloudflare.getZoneId()
        if (!settings.cloudflare.zoneId) throw new Error("Failed to get the Cloudflare zone ID")

        // If no list ID was specified, check if there's an "allowme" list instead.
        if (!settings.cloudflare.listId) {
            settings.cloudflare.listId = await cloudflare.getListId()
            if (!settings.cloudflare.listId) throw new Error("Failed to get the Cloudflare list ID")

            // Get the correct list name.
            settings.cloudflare.listName = await cloudflare.getListName()
            if (!settings.cloudflare.listName) throw new Error("Failed to get the Cloudflare list name")

            // Make sure a firewall rule is present for the IP list.
            settings.cloudflare.firewallId = await cloudflare.getFirewallId()
            if (!settings.cloudflare.firewallId) throw new Error("Failed to get the Cloudflare firewall rule ID")
        }

        server.prepare()
        server.start()
    } catch (ex) {
        logger.error("Index.run", ex)
    }
}

run()
