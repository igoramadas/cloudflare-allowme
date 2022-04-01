// Cloudflare AllowMe: Utils

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
