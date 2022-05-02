// Cloudflare AllowMe: Utils

import logger = require("anyhow")
import uaParser = require("ua-parser-js")

/**
 * Helper to parse a string as boolean.
 */
export const getBoolean = (value: string): boolean => {
    switch (value) {
        case "false":
        case "off":
        case "no":
        case "0":
        case "":
            return false
        default:
            return true
    }
}

/**
 * Get a friendly device name baased on the passed user agent.
 * @param useragent Client user agent string.
 */
export const getDevice = (useragent: string): string => {
    const ua = uaParser(useragent)
    const result = []

    if (ua.device && ua.device.vendor) result.push(ua.device.vendor)
    if (ua.device && ua.device.model) result.push(ua.device.model)
    if (ua.os && ua.os.name && result.length == 0) result.push(ua.os.name)
    if (ua.browser && ua.browser.name) result.push(ua.browser.name)
    if (result.length == 0) result.push(useragent.split[" "][0])

    return result.join(" ")
}

/**
 * Parse and return only IP / ranges that are valid in Cloudflare.
 * IPv6 will be converted to a /64 CIDR range.
 */
export const parseIP = (ip: string): string => {
    try {
        if (!ip || ip == "::1" || ip == "127.0.0.1") {
            return null
        }

        // Convert and decompress IPv6 to /64.
        if (ip.includes(":")) {
            const ipv6 = ip.split(":")
            if (ipv6.length > 4) {
                for (let i = 0; i < 4; i++) {
                    if (ipv6[i] == "") ipv6[i] = "0"
                }
                return `${ipv6.slice(0, 4).join(":")}::/64`
            }
        }

        return ip
    } catch (ex) {
        logger.error("Utils.parseIP", ip, ex)
        return null
    }
}
