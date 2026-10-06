# Cloudflare AllowMe

Small REST service (Bun + Express + TypeScript) that adds and removes client IPs on a Cloudflare account IP list. A WAF custom rule on that list (action "skip") lets allowed IPs bypass the other firewall rules. Supports IPv4 and IPv6.

Further details can be found in the repo's `README.md` file.

## Notes and constraints

- No unit tests ready and also not planned.
- Preferred deployment method is to Cloudflare Workers.
