// Cloudflare AllowMe: Utils

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
