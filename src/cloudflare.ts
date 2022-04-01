// Cloudflare AllowMe: API client

import {parseIP} from "./utils"
import logger = require("anyhow")
import settings = require("./settings")
import axios, {AxiosRequestConfig} from "axios"

// IP items comments are prefixed with an AllowMe.
const commentPrefix: string = "AllowMe: "

// IPs will be removed from the allowme list only if they haven't been
// pinged for a certain amount of time.
const ipTimestamp: {[ip: string]: number} = {}

/**
 * Get account ID from Cloudflare.
 */
export const getAccountId = async (): Promise<string> => {
    try {
        const res: any[] = await makeRequest("accounts")

        if (res.length > 0) {
            logger.info("Cloudflare.getAccountId", res[0].id)
            return res[0].id
        } else {
            throw new Error("No accounts allowed for the current token")
        }
    } catch (ex) {
        logger.error("Cloudflare.getAccountId", ex)
    }
}

/**
 * Get zone ID from Cloudflare.
 */
export const getZoneId = async (): Promise<string> => {
    try {
        const res: any[] = await makeRequest(`zones?name=${settings.cloudflare.zone}`)

        if (res.length > 0) {
            logger.info("Cloudflare.getZoneId", res[0].id)
            return res[0].id
        } else {
            throw new Error(`Invalid zone: ${settings.cloudflare.zone}`)
        }
    } catch (ex) {
        logger.error("Cloudflare.getZoneId", ex)
    }
}

/**
 * Get list ID from Cloudflare.
 */
export const getListId = async (): Promise<string> => {
    try {
        const res: any[] = await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists`)
        const list = res.find((i) => i.name == "allowme" && i.kind == "ip")

        if (list) {
            logger.info("Cloudflare.getListId", list.id)
            return list.id
        } else if (res.length == 0) {
            const listId = await createList()
            logger.info("Cloudflare.getListId", listId)
            return listId
        } else {
            throw new Error(`No "allowme" IP list was found`)
        }
    } catch (ex) {
        logger.error("Cloudflare.getListId", ex)
    }
}

/**
 * Get list name from Cloudflare, in case a list ID was directly set.
 */
export const getListName = async (): Promise<string> => {
    try {
        const res: any = await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}`)

        if (res) {
            logger.info("Cloudflare.getListName", res.name)
            return res.name
        } else {
            throw new Error(`Invalid list ID: ${settings.cloudflare.listId}`)
        }
    } catch (ex) {
        logger.error("Cloudflare.getListName", ex)
    }
}

/**
 * Get the IPs from the list on Cloudflare.
 */
export const getListItems = async (): Promise<any[]> => {
    try {
        const res: any[] = await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`)

        if (res) {
            return res
        } else {
            throw new Error(`No list IPs were returned`)
        }
    } catch (ex) {
        logger.error("Cloudflare.getListItems", ex)
    }
}

/**
 * Create an "allowme" IP list on Cloudflare.
 */
export const createList = async (): Promise<string> => {
    try {
        const data = {name: "allowme", kind: "ip", description: "Generated by AllowMe"}
        const res = await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists`, "POST", data)

        logger.info("Cloudflare.createList", res.id)
        return res.id
    } catch (ex) {
        logger.error("Cloudflare.createList", ex)
    }
}

/**
 * Get firewall rule ID from Cloudflare.
 */
export const getFirewallId = async (): Promise<string> => {
    try {
        const res: any[] = await makeRequest(`zones/${settings.cloudflare.zoneId}/firewall/rules`)
        const rule = res.find((i) => i.action == "allow" && i.filter.expression.includes("ip.src in $allowme"))

        if (rule) {
            logger.info("Cloudflare.getFirewallId", rule.id)
            return rule.id
        } else {
            const ruleId = await createFirewall()
            logger.info("Cloudflare.getFirewallId", ruleId)
            return ruleId
        }
    } catch (ex) {
        logger.error("Cloudflare.getFirewallId", ex)
    }
}

/**
 * Create an "AllowMe" firewall rule on Cloudflare.
 */
export const createFirewall = async (): Promise<string> => {
    try {
        const filter = {expression: `ip.src in $${settings.cloudflare.listName}`}
        const data = [{priority: 1, action: "allow", filter: filter, description: "Generated by AllowMe"}]
        const res = await makeRequest(`zones/${settings.cloudflare.zoneId}/firewall/rules`, "POST", data)
        const id = res[0].id

        logger.info("Cloudflare.createFirewall", id)
        return id
    } catch (ex) {
        logger.error("Cloudflare.createFirewall", ex)
    }
}

/**
 * Add the specified IP to the allowme list.
 * Will throw an exception if it fails.
 * @param ip Client IP.
 * @param device Device name.
 */
export const ipAllow = async (ip: string, device: string): Promise<boolean> => {
    try {
        const validIP = parseIP(ip)
        if (!validIP) {
            logger.warn("Cloudflare.ipBlock", ip, "Invalid IP")
            return false
        }

        // Add IP to the timestamp cache.
        ipTimestamp[validIP] = new Date().valueOf()

        // Stop here if IP is already present on the allowme list.
        const items = await getListItems()
        if (items.find((i) => i.ip == validIP)) {
            logger.warn("Cloudflare.ipAllow", validIP, "Already on the list")
            return false
        }

        // Finally push the IP to the allowme list.
        const data = [{ip: validIP, comment: `${commentPrefix} ${device}`}]
        await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`, "POST", data)

        logger.info("Cloudflare.ipAllow", validIP, device)
        return true
    } catch (ex) {
        logger.error("Cloudflare.ipAllow", ip, device, ex)
        throw ex
    }
}

/**
 * Remove the specified IP from the allowme list.
 * Will throw an exception if it fails.
 * @param ip Client IP.
 * @param device Device name.
 */
export const ipBlock = async (ip: string, device: string): Promise<boolean> => {
    try {
        const validIP = parseIP(ip)
        if (!validIP) {
            logger.warn("Cloudflare.ipBlock", ip, "Invalid IP")
            return false
        }

        const items = await getListItems()
        const ipItem = items.find((i) => i.ip == validIP)

        // Stop here if the IP is not present.
        if (!ipItem) {
            logger.warn("Cloudflare.ipBlock", validIP, "Not on the list")
            return false
        }

        // Finally remove the IP from the allowme list.
        const data = {items: [{id: validIP}]}
        await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`, "DELETE", data)

        logger.info("Cloudflare.ipBlock", validIP, device, `Removed ${ipItem.id}`)
        return true
    } catch (ex) {
        logger.error("Cloudflare.ipBlock", ip, device, ex)
        throw ex
    }
}

/**
 * Auto remove expired IPs from the list.
 */
export const cleanup = async (): Promise<void> => {
    try {
        const now = new Date().valueOf()
        const age = parseInt(settings.ip.maxAge) * 1000 * 60
        const data = {items: []}

        // Fetch and process list of IPs.
        const items = await getListItems()

        for (let item of items) {
            if (item.comment && item.comment.substring(0, commentPrefix.length) == commentPrefix) {
                const created = new Date(item.created_on).valueOf()
                const timestamp = ipTimestamp[item.ip] || 0

                // Too old? Mark the IP for removal.
                if (now - age > created && now - age > timestamp) {
                    const device = item.comment.substring(commentPrefix.length + 1)
                    logger.info("Cloudflare.cleanup", item.ip, device, "Will be removed")
                    data.items.push({id: item.id})
                }
            }
        }

        if (data.items.length > 0) {
            await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`, "DELETE", data)
            logger.info("Cloudflare.cleanup", `Removed ${data.items.length} IP(s)`)
        }
    } catch (ex) {
        logger.error("Cloudflare.cleanup", ex)
    }
}

/**
 * Helper to make requests to the Cloudflare API.
 * @param path API path.
 * @param method Supported methods: GET, POST, DELETE.
 * @param body Request body to be posted.
 */
const makeRequest = async (path: string, method?: "GET" | "POST" | "DELETE", body?: any): Promise<any> => {
    try {
        const options: AxiosRequestConfig = {
            method: method || "GET",
            headers: {Authorization: `Bearer ${settings.cloudflare.token}`}
        }
        if (body) {
            options.data = body
        }

        const res = await axios(`https://api.cloudflare.com/client/v4/${path}`, options)

        if (res.data && res.data.result) {
            return res.data.result
        } else if (!body) {
            throw new Error(`Invalid data: ${path}`)
        }
    } catch (ex) {
        if (ex.response) {
            const details = ex.response.data && ex.response.data.errors ? ex.response.data.errors.map((e) => e.message).join(" | ") : ex.message
            throw new Error(`${ex.response.status} - ${details}`)
        } else {
            throw ex
        }
    }
}
