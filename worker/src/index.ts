// Cloudflare AllowMe: Worker entrypoint (routes HTTP to the AllowMe container).

import {Container, getContainer, type StopParams} from "@cloudflare/containers"
import {env} from "cloudflare:workers"

// The lite instance has a fraction of a vCPU, so Node can take longer than the 20s default to listen.
const PORT_READY_TIMEOUT = 60000

/**
 * Durable Object that runs the AllowMe Docker image.
 */
export class AllowMeContainer extends Container {
    defaultPort = 8080
    sleepAfter = "1h"
    envVars = {
        ALLOWME_CF_TOKEN: env.ALLOWME_CF_TOKEN,
        ALLOWME_SERVER_SECRET: env.ALLOWME_SERVER_SECRET,
        ALLOWME_CF_ZONE: env.ALLOWME_CF_ZONE,
        ALLOWME_CF_ACCOUNTID: env.ALLOWME_CF_ACCOUNTID,
        ALLOWME_CF_LISTID: env.ALLOWME_CF_LISTID,
        ALLOWME_SERVER_PORT: env.ALLOWME_SERVER_PORT,
        ALLOWME_SERVER_USER: env.ALLOWME_SERVER_USER,
        ALLOWME_SERVER_PROMPT: env.ALLOWME_SERVER_PROMPT,
        ALLOWME_SERVER_TRUSTPROXY: env.ALLOWME_SERVER_TRUSTPROXY,
        ALLOWME_SERVER_HOME: env.ALLOWME_SERVER_HOME,
        ALLOWME_IP_MAXAGE: env.ALLOWME_IP_MAXAGE,
        ALLOWME_IP_BLOCKINTERVAL: env.ALLOWME_IP_BLOCKINTERVAL,
        ALLOWME_IP_DENYCOUNT: env.ALLOWME_IP_DENYCOUNT,
        ALLOWME_LOG_LEVEL: env.ALLOWME_LOG_LEVEL
    }

    // Surface container exits in the Worker logs (the container's own stdout is only in the dashboard).
    onStop(params: StopParams) {
        console.warn("AllowMeContainer stopped", JSON.stringify(params))
    }

    onError(error: unknown) {
        console.error("AllowMeContainer error", error)
        throw error
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const container = getContainer(env.ALLOWME_CONTAINER)
        await container.startAndWaitForPorts(8080, {portReadyTimeoutMS: PORT_READY_TIMEOUT})
        return container.fetch(request)
    },

    // Start (or keep) the singleton container so in-process hourly cleanup can run.
    async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
        const container = getContainer(env.ALLOWME_CONTAINER)
        await container.startAndWaitForPorts(8080, {portReadyTimeoutMS: PORT_READY_TIMEOUT})
    }
}
