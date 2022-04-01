// Cloudflare AllowMe: Settings

if (!process.env.CF_ALLOWME_TOKEN) {
    require("dotenv").config()
}

/**
 * Service settings.
 */
const settings = {
    cloudflare: {
        // Clodflare API token.
        token: process.env.ALLOWME_CF_TOKEN || "",
        // Cloudflare zone name (not needed if zoneId below is specified).
        zone: process.env.ALLOWME_CF_ZONE || "",
        // Cloudflare account ID (optional).
        accountId: process.env.ALLOWME_CF_ACCOUNTID || "",
        // Cloudflare zone ID (fetched automatically).
        zoneId: null,
        // Cloudflare firewall rule ID (fetched automatically).
        firewallId: null,
        // Cloudflare list ID (optional, if missing it will try creating and fetching the list and firewall ID automatically).
        listId: process.env.ALLOWME_CF_LISTID || "",
        // Cloudflare list name (fetched automatically).
        listName: null
    },
    server: {
        // Server port (defaults to 8080).
        port: process.env.ALLOWME_SERVER_PORT || "",
        // Server auth secret / password / token.
        secret: process.env.ALLOWME_SERVER_SECRET || "",
        // Server auth user (for auth prompts, defaults to "/allowme").
        user: process.env.ALLOWME_SERVER_USER || "",
        // Activate the token prompt if no Authorization header was passed (enabled by default).
        prompt: process.env.ALLOWME_SERVER_PROMPT || "",
        // Trust X-Forwarded-For headers (enabled by default).
        trustProxy: process.env.ALLOWME_SERVER_TRUSTPROXY || "",
        // Home redirection (defaults to the GitHub repo), if missing the https:// will display that message instead.
        home: process.env.ALLOWME_SERVER_HOME || ""
    },
    ip: {
        // Maximum IP age in minutes (defaults is 1440 = 2 days)
        maxAge: process.env.ALLOWME_IP_MAXAGE || "",
        // Block interval in minutes (defaults to 60 = 1 hour).
        blockInterval: process.env.ALLOWME_IP_BLOCKINTERVAL || "",
        // How many times can a single IP fail to authenticate before getting blocked (defaults to 5).
        denyCount: process.env.ALLOWME_IP_DENYCOUNT || ""
    },
    log: {
        // Logging level: none, error, info (defaults to info).
        level: process.env.ALLOWME_LOG_LEVEL || ""
    }
}

export = settings
