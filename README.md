# Cloudflare AllowMe

A simple yet powerful tool to automatically manage a list of IPs allowed in Cloudflare zone firewall. If you have a specific server / service that needs to be accessible from the internet, and:

- Use Cloudflare as a DNS proxy / firewall
- Allow only IPs from Cloudflare to access your server from the outside
- Don't trust long-lived, static firewall rules

Then this tool might be a good fit for you!

## Pre requisites

You should already have a zone (domain) registered with Cloudflare. If you don't, please follow [these steps](https://support.cloudflare.com/hc/en-us/articles/201720164-Creating-a-Cloudflare-account-and-adding-a-website).

You'll need to have at least some basic Node.js or Docker knowledge, depending on how you want to run it.

## How to use

#### Cloudflare API token

First step is to create an API token for the service. If you already have a token with the necessary permissions and want to reuse it, you can skip these steps.

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click on the "Create token" button, then proceed to "Custom token" > "Get started"
3. Give the token a name (example: AllowMe), and the following permissions:
    - Account > Account Filter Lists > Edit
    - Account > Account Settings > Read
    - Zone > Zone > Read
4. Include the account and zone resources:
    - Include > _MY_ACCOUNT_NAME_
    - Include > Specific zone > _MY_ZONE.TLD_
5. Click "Continue to summary", then "Save token".
6. Copy the token value, it will be used as the `$ALLOWME_CF_TOKEN` variable.

### Cloudflare IP rule list

Next you'll have to define an IP rule list to manage the allowed IPs. By default, if you don't have any IP rule lists created on your Cloudflare account, the service will automatically create an "allowme" list for you, so you can skip these steps altogether. Otherwise if you want to do it manually:

1. Go to "Manage Account" > "Configurations" on the sidebar of your dashboard.
2. Select the "Lists" tab.
3. Click on "Create new list", give it the name "allowme", content type "IP Address".
4. Click "Create" to finish.

If you already have an IP list that you want to reuse, you can simply grab its ID.

1. Go to "Manage Account" > "Configurations" on the sidebar of your dashboard.
2. Select the "Lists" tab.
3. Click on "Edit" next to the list name.
4. Get the list ID from the URL, to be used as the `$ALLOWME_CF_LISTID` variable:
    - Example: https://dash.cloudflare.com/account123/configurations/lists/_LIST_ID_

### Service configuration

The service is fully configured via environment variables, either directly or via a `.env` file. The following variables are mandatory:

#### ALLOWME_CF_TOKEN (string)

Your Cloudflare API token. Mandatory.

#### ALLOWME_CF_ACCOUNTID (string)

If you have multiple accounts, you can set the ID of the correct account here. If unset, the service will use the main account. The account ID can be taken from your dashboard URL, for example: https://dash.cloudflare.com/_ACCOUNT_ID_.

#### ALLOWME_CF_ZONE (string)

The zone which should be updated, for example "mydomain.com". Not needed if you use the `ALLOWME_CF_ZONEID` (see below).

#### ALLOWME_CF_ZONEID (string)

You can also set the zone directly by ID. The zone ID can be found on the right side table of the "Overview" page of the zone in Cloudflare.

#### ALLOWME_CF_LISTID (string)

Optional. The IP list ID, in case you don't want to have a dedicated "allowme" list. Get the list ID from the URL of its edit page, for example: https://dash.cloudflare.com/account123/configurations/lists/_LIST_ID_.

#### ALLOWME_SERVER_PORT (number)

Web server HTTP port. Defaults to "8080".

#### ALLOWME_SERVER_PATH (string)

Path which the service should listen to IP updates. This is the page you should call from your device to allow its IP. Defaults to "/allowme".

#### ALLOWME_SERVER_SECRET (string)

The secret / token that you should pass to the service via the Authorization (Bearer) header, or as the password on the Basic Auth prompt. Mandatory.

#### ALLOWME_SERVER_USER (string)

Username to be used on the Basic Auth prompt (see below). Defaults to "allowme".

#### ALLOWME_SERVER_PROMPT (boolean)

Optional, set to false to disable the Basic Auth prompt so only an Authorization (Bearer) header is accepted.

#### ALLOWME_SERVER_TRUSTPROXY (boolean)

Optional, set to false to disable parsing the client IP from _X-Forwarded-For_ headers.

#### ALLOWME_SERVER_HOME (string)

Optional, full URL to where users should be redirect if they git the root / path of the service. If missing the https://, this will be treated as text and that text will be displayed instead. Defaults to https://github.com/igoramadas/cloudflare-allowme.

#### ALLOWME_IP_MAXAGE (number)

How long (in minutes) IPs should stay in the allowed list. Defaults to 1440 (1 day). Set to 0 to disable auto removing IPs.

#### ALLOWME_IP_BLOCKINTERVAL (number)

How long (in minutes) IPs should be blocked in case of repeated authentication failures. Defaults to 60 minutes (1 hour). Set to 0 to disable blocking.

#### ALLOWME_IP_DENYCOUNT (number)

How many times can an IP fail to authenticate before getting blocked. Defaults to 5. Setting to 0 will block IPs on their first failed auth.

#### ALLOWME_LOG_LEVEL (none, error, info)

Console logging level. Set to "none" to fully disable logging, or "error" to only log errors and warnings. Defaults to "info", which logs everything.

## Recommendations

### Running it with Docker

The easiest way to get this tool up and running is using the official Docker image:


```
$ docker pull igoramadas/cloudflare-allowme

$ docker run -it --name cloudflare-allowme \
             -p 80:8080 \
             -e ALLOWME_CF_TOKEN=MY_API_TOKEN \
             -e ALLOWME_CF_ZONE=MYDOMAIN.COM \
             -e ALLOWME_SERVER_SECRET=MY_SUPER_SECRET_KEY
             igoramadas/cloudflare-allowme
```

### Securing the endpoint with HTTPS

Use a reverse proxy to secure the service with SSL: [nginx](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/), [caddy](https://caddyserver.com/), [traefik](https://traefik.io/).

If you decide to go with Caddy, have a look on [this other project](https://github.com/igoramadas/docker-caddy-cloudflare) of mine.

### Automating requests on your mobile

If you have an Android device, you can use automation applications like [Tasker](https://tasker.joaoapps.com/) or [Automate](https://llamalab.com/automate/) to automatically call the service endpoint when your connection changes.

I don't have iOS devices so I can test it for myself, but I think [Shortcuts](https://support.apple.com/en-gb/guide/shortcuts/welcome/ios) is your best bet.
