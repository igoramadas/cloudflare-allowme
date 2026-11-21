// Cloudflare AllowMe: Server

import {getBoolean, getDevice} from "./utils"
import settings from "./settings.js"
import * as admin from "./admin"
import * as cloudflare from "./cloudflare"
import logger from "anyhow"
import crypto from "crypto"
import express from "express"
import http from "http"

let app: express.Application
let server: http.Server
let timer: NodeJS.Timeout

// Service start time, used by the admin dashboard.
const startedAt = new Date()

// List of failed and banned IPs due to failed authentication.
// Please note that this is related to the AllowMe service
// itself, and NOT the Cloudflare IP list.
const failedIps: {[ip: string]: number} = {}
const bannedIps: {[ip: string]: Date} = {}

/**
 * Prepare the Express app and server.
 */
export const prepare = (): void => {
    app = express()
    app.disable("x-powered-by")

    // Accept the X-Forwarded-For header?
    if (getBoolean(settings.server.trustProxy)) {
        app.set("trust proxy", true)
    }

    // Auth validation.
    const authValidator = async (req: express.Request, res: express.Response, next) => {
        const ip = getClientIP(req)

        // IP currently banned?
        if (bannedIps[ip]) {
            logger.error("Server.authValidator", ip, `IP banned since ${bannedIps[ip].toLocaleString()}`)
            res.status(401).send("Access denied")
            return
        }

        const authHeader = req.headers.authorization || ""
        const authToken = authHeader.includes(" ") ? authHeader.split(" ")[1] : ""

        // Token passed as a bearer?
        if (authHeader.includes("Bearer")) {
            if (authToken !== settings.server.secret) {
                authFailed(req)
                res.status(401).send("Unauthorized")
                return
            }

            next()
            return
        }

        // Token passed as a query parameter?
        if (req.query.secret) {
            if (req.query.secret !== settings.server.secret) {
                authFailed(req)
                res.status(401).send("Unauthorized")
                return
            }

            next()
            return
        }

        // User can also input the secret via a basic auth prompt.
        if (getBoolean(settings.server.prompt)) {
            const login = {user: settings.server.user, password: settings.server.secret}
            const [user, password] = Buffer.from(authToken, "base64").toString().split(":")
            if (user && password && user === login.user && password === login.password) {
                next()
                return
            }

            // Ask the browser to prompt for a user / password.
            res.set("WWW-Authenticate", 'Basic realm="allowme"')
        }

        authFailed(req)
        res.status(401).send("Authentication required")
    }

    // Home route.
    app.get("/", async (req, res) => {
        logger.info("Server.home", getClientIP(req))

        // Cloudflare health probes can't follow redirects, so they get a plain 200.
        const probeHost = req.hostname == "ping" || req.hostname == "containerstarthealthcheck"
        const probeIp = req.socket.remoteAddress == "::ffff:10.1.0.0" && !req.headers["cf-connecting-ip"]
        if (probeHost || probeIp) {
            res.status(200).send("OK")
            return
        }

        if (settings.server.home.substring(0, 8) == "https://") {
            res.redirect(settings.server.home)
        } else {
            const html = `<html><head><title>AllowMe</title></head><body><center>${settings.server.home}</center></body></html>`
            res.status(200).send(html)
        }
    })

    // Allow (add IP) route.
    app.get("/allow", authValidator, async (req, res) => {
        const ip = (req.headers["x-device-ip"] as string) || getClientIP(req)
        const device = req.headers["x-device-name"] || getDevice(req.headers["user-agent"])

        try {
            const ok = await cloudflare.ipAllow(ip, device as string)
            res.status(200).send(`Add ${ip}: ${ok}`)

            delete failedIps[ip]
            delete bannedIps[ip]
        } catch (ex) {
            res.status(500).send(`Failed to add: ${ip}`)
        }
    })

    // Block (remove IP) route.
    app.get("/block", authValidator, async (req, res) => {
        const ip = (req.headers["x-device-ip"] as string) || getClientIP(req)
        const device = req.headers["x-device-name"] || getDevice(req.headers["user-agent"])

        try {
            const ok = await cloudflare.ipBlock(ip, device as string)
            res.status(200).send(`Remove ${ip}: ${ok}`)
        } catch (ex) {
            res.status(500).send(`Failed to remove: ${ip}`)
        }
    })

    // Return list of banned IPs due to failed authentication.
    app.get("/banned", authValidator, async (req, res) => {
        const ip = getClientIP(req)

        try {
            res.status(200).send(JSON.stringify(bannedIps, null, 2))
        } catch (ex) {
            res.status(500).send(`Failed to list banned IPs, from ${ip}`)
        }
    })

    // Admin dashboard routes, only registered when enabled with a password.
    if (admin.isEnabled()) {
        // Check if the client IP is currently on the Cloudflare allowme list.
        const adminIpCheck = async (req: express.Request, res: express.Response, next) => {
            const ip = getClientIP(req)

            if (!(await admin.isAllowedIP(ip))) {
                logger.warn("Server.adminIpCheck", ip, "IP not on the allowed list")
                res.status(403).send("Access denied")
                return
            }

            next()
        }

        // IP check plus admin password validation (Bearer, Basic or ?password=).
        const adminValidator = async (req: express.Request, res: express.Response, next) => {
            const ip = getClientIP(req)

            if (bannedIps[ip]) {
                logger.error("Server.adminValidator", ip, `IP banned since ${bannedIps[ip].toLocaleString()}`)
                res.status(401).send("Access denied")
                return
            }

            if (!(await admin.isAllowedIP(ip))) {
                logger.warn("Server.adminValidator", ip, "IP not on the allowed list")
                res.status(403).send("Access denied")
                return
            }

            const authHeader = req.headers.authorization || ""
            let token = authHeader.includes(" ") ? authHeader.split(" ")[1] : ""

            // Basic auth: decode and keep the password part only.
            if (authHeader.startsWith("Basic") && token) {
                token = Buffer.from(token, "base64").toString().split(":")[1] || ""
            }

            const candidate = token || (req.query.password as string) || ""
            const a = Buffer.from(candidate)
            const b = Buffer.from(settings.admin.password)
            const valid = a.length == b.length && crypto.timingSafeEqual(a, b)

            if (!valid) {
                authFailed(req)
                res.status(401).send("Unauthorized")
                return
            }

            next()
        }

        // The dashboard page itself, reachable by allowed IPs.
        app.get("/admin", adminIpCheck, (_req, res) => {
            res.status(200).send(admin.page)
        })

        app.use("/admin/api", adminValidator, express.json())

        // Service status: config, allowed IPs, banned and failed IPs.
        app.get("/admin/api/status", async (req, res) => {
            try {
                const items = await admin.getAllowedItems()
                const allowed = items.map((i) => {
                    const hasPrefix = i.comment?.substring(0, cloudflare.commentPrefix.length) == cloudflare.commentPrefix
                    return {ip: i.ip, device: hasPrefix ? i.comment.substring(cloudflare.commentPrefix.length).trim() : i.comment, added: i.created_on}
                })

                res.json({
                    uptime: Math.round(process.uptime()),
                    startedAt: startedAt,
                    clientIp: getClientIP(req),
                    cloudflare: {
                        zone: settings.cloudflare.zone,
                        zoneId: settings.cloudflare.zoneId,
                        listId: settings.cloudflare.listId,
                        listName: settings.cloudflare.listName
                    },
                    config: {
                        port: settings.server.port,
                        trustProxy: getBoolean(settings.server.trustProxy),
                        maxAge: parseInt(settings.ip.maxAge),
                        blockInterval: parseInt(settings.ip.blockInterval),
                        denyCount: parseInt(settings.ip.denyCount)
                    },
                    allowed: allowed,
                    banned: Object.entries(bannedIps).map(([ip, since]) => ({ip: ip, since: since})),
                    failed: Object.entries(failedIps).map(([ip, count]) => ({ip: ip, count: count}))
                })
            } catch (ex) {
                res.status(500).json({error: "Failed to fetch the status"})
            }
        })

        // Allow an IP (defaults to the client IP).
        app.post("/admin/api/allow", async (req, res) => {
            const ip = req.body?.ip || getClientIP(req)
            const device = req.body?.device || "Admin dashboard"

            try {
                const ok = await cloudflare.ipAllow(ip, device)
                admin.clearItemsCache()
                res.json({ok: ok, ip: ip})
            } catch (ex) {
                res.status(500).json({error: `Failed to add: ${ip}`})
            }
        })

        // Remove an IP from the allowed list.
        app.post("/admin/api/block", async (req, res) => {
            const ip = req.body?.ip

            if (!ip) {
                res.status(400).json({error: "Missing ip"})
                return
            }

            try {
                const ok = await cloudflare.ipBlock(ip, "Admin dashboard")
                admin.clearItemsCache()
                res.json({ok: ok, ip: ip})
            } catch (ex) {
                res.status(500).json({error: `Failed to remove: ${ip}`})
            }
        })

        // Remove an IP from the local auth-failure ban list.
        app.post("/admin/api/unban", (req, res) => {
            const ip = req.body?.ip

            if (!ip) {
                res.status(400).json({error: "Missing ip"})
                return
            }

            delete bannedIps[ip]
            delete failedIps[ip]
            logger.info("Server.adminUnban", ip)
            res.json({ok: true, ip: ip})
        })

        // Trigger the expired IP cleanup now.
        app.post("/admin/api/cleanup", async (_req, res) => {
            try {
                await cloudflare.cleanup()
                admin.clearItemsCache()
                res.json({ok: true})
            } catch (ex) {
                res.status(500).json({error: "Cleanup failed"})
            }
        })

        logger.info("Server.prepare", "Admin dashboard enabled at /admin")
    }
}

/**
 * Start the HTTP server.
 */
export const start = (): void => {
    if (server) {
        logger.warn("Server.start", "Already running")
        return
    }

    try {
        server = http.createServer(app)

        const logConfig = []
        const listenOk = () => logger.info("Server.start", `Listening on port ${settings.server.port}`)
        const listenError = (err) => logger.error("Server.error", err)

        server.listen(parseInt(settings.server.port), listenOk).on("error", listenError)

        if (parseInt(settings.ip.maxAge) > 0) {
            timer = setInterval(() => cloudflare.cleanup().catch(() => {}), 1000 * 60 * 60)
            logConfig.push(`IP max age: ${settings.ip.maxAge}m`)
        } else {
            logConfig.push(`IP max age disabled`)
        }

        if (parseInt(settings.ip.blockInterval) > 0) {
            logConfig.push(`IP block: ${settings.ip.blockInterval}m after ${settings.ip.denyCount} failed auths`)
        } else {
            logConfig.push(`IP block disabled`)
        }

        // Cleanup blocked IPs every 5 minutes.
        const authCleanup = () => {
            const minDate = new Date().valueOf() - parseInt(settings.ip.blockInterval) * 1000 * 60
            const entries = Object.entries(bannedIps)

            for (let [ip, blockDate] of entries) {
                if (blockDate.valueOf() < minDate) {
                    logger.warn("Server.authCleanup", ip, "Unblocked")
                    delete bannedIps[ip]
                }
            }
        }

        logger.info("Server.start", logConfig.join(" | "))

        setInterval(authCleanup, 1000 * 60 * 5)
    } catch (ex) {
        logger.error("Server.start", ex)
    }
}

/**
 * Stop the HTTP server.
 */
export const stop = (): void => {
    if (!server) {
        logger.warn("Server.stop", "Server was not running")
        return
    }

    try {
        server.close()
        server = null

        clearInterval(timer)
        timer = null

        logger.info("Server.stop", "Stopped")
    } catch (ex) {
        logger.error("Server.stop", ex)
    }
}
/**
 * Gets the real IP of the client, depending on the trustProxy setting.
 * @param req Request object.
 */
const getClientIP = (req: express.Request): string => {
    if (!getBoolean(settings.server.trustProxy)) {
        return req.ip
    }

    return (req.headers["cf-connecting-ip"] || req.headers["true-client-ip"] || req.ip).toString()
}

/**
 * Helper to manage and block failed IPs.
 * @param req Request object.
 */
const authFailed = (req: express.Request): void => {
    const device = req.headers["x-device-name"] || getDevice(req.headers["user-agent"])
    const ip = getClientIP(req)

    if (!failedIps[ip]) {
        failedIps[ip] = 1
    } else {
        failedIps[ip]++
    }

    if (parseInt(settings.ip.blockInterval) > 0 && failedIps[ip] >= parseInt(settings.ip.denyCount)) {
        failedIps[ip]
        bannedIps[ip] = new Date()
        logger.warn("Server.authFailed", ip, device, "IP banned")
    } else {
        logger.warn("Server.authFailed", ip, device, `Count ${failedIps[ip]}`)
    }
}
