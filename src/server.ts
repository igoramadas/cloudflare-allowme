// Cloudflare AllowMe: Server

import {getBoolean} from "./utils"
import logger = require("anyhow")
import settings = require("./settings")
import * as cloudflare from "./cloudflare"
import express = require("express")
import http from "http"

let app: express.Application
let server: http.Server
let timer: NodeJS.Timer

// List of failed and blocked IPs due to failed authentication.
const failedIps: {[ip: string]: number} = {}
const blockedIps: {[ip: string]: Date} = {}

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
    const authValidator = async (req, res, next) => {
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
        logger.info("Server.home", req.ip)

        if (settings.server.home.substring(0, 8) == "https://") {
            res.redirect(settings.server.home)
        } else {
            const html = `<html><head><title>AllowMe</title></head><body><center>${settings.server.home}</center></body></html>`
            res.status(200).send(html)
        }
    })

    // Allow route.
    app.get(settings.server.path, authValidator, async (req, res) => {
        await cloudflare.ipAllow(req.ip)
        res.status(200).send(req.ip)

        delete failedIps[req.ip]
        delete blockedIps[req.ip]
    })
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
            cloudflare.cleanup()
            timer = setInterval(cloudflare.cleanup, 1000 * 60 * 60)
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
            const entries = Object.entries(blockedIps)

            for (let [ip, blockDate] of entries) {
                if (blockDate.valueOf() < minDate) {
                    logger.warn("Server.authCleanup", ip, "Unblocked")
                    delete blockedIps[ip]
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
 * Helper to manage and block failed IPs.
 * @param req Request object.
 */
const authFailed = (req: express.Request) => {
    if (!failedIps[req.ip]) {
        failedIps[req.ip] = 1
    } else {
        failedIps[req.ip]++
    }

    if (parseInt(settings.ip.blockInterval) > 0) {
        if (failedIps[req.ip] >= 5) {
            failedIps[req.ip]
            blockedIps[req.ip] = new Date()
            logger.warn("Server.authFailed", req.ip, "IP blocked")
        } else {
            logger.warn("Server.authFailed", req.ip, failedIps[req.ip])
        }
    } else {
        logger.warn("Server.authFailed", req.ip, failedIps[req.ip])
    }
}
