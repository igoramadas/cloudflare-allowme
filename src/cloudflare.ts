// Cloudflare AllowMe: API client

import logger = require("anyhow")
import settings = require("./settings")
import axios, {AxiosRequestConfig} from "axios"

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
        const data = {name: "allowme", kind: "ip", description: "Auto generated."}
        const res = await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists`, "POST", data)

        logger.info("Cloudflare.createList", res.id)
        return res.id
    } catch (ex) {
        logger.error("Cloudflare.createList", ex)
    }
}

/**
 * Add the specified IP to the allow list.
 */
export const ipAllow = async (ip: string): Promise<boolean> => {
    try {
        if (ip == "::1") {
            logger.warn("Cloudflare.ipAllow", ip, "Local IP, won't be added")
            return
        }

        const items = await getListItems()

        if (items.find((i) => i.ip == ip)) {
            logger.warn("Cloudflare.ipAllow", ip, "Already on the list")
            return
        }

        const data = [{ip: ip, comment: "AllowMe"}]
        await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`, "POST", data)

        logger.info("Cloudflare.ipAllow", ip)
    } catch (ex) {
        logger.error("Cloudflare.ipAllow", ip, ex)
    }
}

/**
 * Auto remove expired IPs from the list.
 */
export const cleanup = async (): Promise<void> => {
    try {
        const now = new Date().valueOf()
        const age = parseInt(settings.ip.maxAge) * 1000 * 60
        const data = []

        // Fetch and process list of IPs.
        const items = await getListItems()

        for (let item of items) {
            if (item.comment == "AllowMe") {
                const created = new Date(item.created_on).valueOf()

                // Too old? Mark the IP for removal.
                if (now - age > created) {
                    data.push({id: item.id})
                    logger.info("Cloudflare.cleanup", item.ip, "To be removed")
                }
            }
        }

        if (data.length > 0) {
            await makeRequest(`accounts/${settings.cloudflare.accountId}/rules/lists/${settings.cloudflare.listId}/items`, "DELETE", data)
            logger.info("Cloudflare.cleanup", `Removed ${data.length} IPs`)
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
