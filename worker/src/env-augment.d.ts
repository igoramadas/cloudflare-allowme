// Wrangler secrets (set via `wrangler secret put`); not listed in wrangler.jsonc vars.

declare namespace Cloudflare {
    interface Env {
        ALLOWME_CF_TOKEN: string
        ALLOWME_SERVER_SECRET: string
    }
}
