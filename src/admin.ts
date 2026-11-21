// Cloudflare AllowMe: Admin dashboard

import {getBoolean, parseIP} from "./utils"
import settings from "./settings.js"
import * as cloudflare from "./cloudflare"
import logger from "anyhow"

// How long (ms) the Cloudflare IP list is cached for admin checks and status.
const itemsCacheTtl = 20000

let itemsCache: {at: number; items: any[]}

/**
 * Admin dashboard enabled? Requires the enabled flag and a password to be set.
 */
export const isEnabled = (): boolean => {
    return getBoolean(settings.admin.enabled) && settings.admin.password != ""
}

/**
 * Fetch the Cloudflare allowme list items, cached for a few seconds to avoid
 * hammering the API on consecutive admin requests.
 */
export const getAllowedItems = async (): Promise<any[]> => {
    const now = new Date().valueOf()

    if (!itemsCache || now - itemsCache.at > itemsCacheTtl) {
        const items = await cloudflare.getListItems()
        itemsCache = {at: now, items: items || []}
    }

    return itemsCache.items
}

/**
 * Clear the cached list items, called after actions that mutate the list.
 */
export const clearItemsCache = (): void => {
    itemsCache = null
}

/**
 * Check if the given IP is currently on the Cloudflare allowme list.
 * @param ip Client IP.
 */
export const isAllowedIP = async (ip: string): Promise<boolean> => {
    try {
        // Normalize IPv4-mapped IPv6 addresses (eg. ::ffff:1.2.3.4).
        const clean = ip.startsWith("::ffff:") ? ip.substring(7) : ip
        const parsed = parseIP(clean) || clean
        const items = await getAllowedItems()
        return items.some((i) => i.ip == parsed || matchIP(clean, i.ip))
    } catch (ex) {
        logger.error("Admin.isAllowedIP", ip, ex)
        return false
    }
}

/**
 * Check if an IP matches a list entry, either exact or a CIDR range.
 * @param ip Client IP.
 * @param entry List entry, an IP or CIDR range.
 */
const matchIP = (ip: string, entry: string): boolean => {
    if (!entry.includes("/")) {
        return entry == ip
    }

    const [base, bitsStr] = entry.split("/")
    const bits = parseInt(bitsStr)
    if (isNaN(bits)) return false

    // IPv4 CIDR.
    if (!entry.includes(":") && !ip.includes(":")) {
        if (bits < 0 || bits > 32) return false
        const mask = bits == 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
        const a = ipToLong(ip)
        const b = ipToLong(base)
        return a != null && b != null && (a & mask) == (b & mask)
    }

    // IPv6 CIDR.
    if (entry.includes(":") && ip.includes(":")) {
        if (bits < 0 || bits > 128) return false
        const a = expandIPv6(ip)
        const b = expandIPv6(base)
        for (let i = 0; i < 8; i++) {
            const rem = bits - i * 16
            if (rem <= 0) break
            const mask = rem >= 16 ? 0xffff : (0xffff << (16 - rem)) & 0xffff
            if ((a[i] & mask) != (b[i] & mask)) return false
        }
        return true
    }

    return false
}

/**
 * Convert a dotted IPv4 string to a number, null if invalid.
 */
const ipToLong = (ip: string): number => {
    const parts = ip.split(".")
    if (parts.length != 4) return null
    return parts.reduce((a, o) => (a << 8) + (parseInt(o) || 0), 0) >>> 0
}

/**
 * Expand an IPv6 string (including compressed forms) to its 8 groups.
 */
const expandIPv6 = (ip: string): number[] => {
    const [head, tail] = ip.split("::")
    const h = head ? head.split(":") : []
    const t = tail === undefined ? [] : tail.split(":")
    const mid = tail === undefined ? 8 - h.length : Math.max(8 - h.length - t.length, 0)
    const groups = [...h, ...new Array(mid).fill("0"), ...t].slice(0, 8)

    while (groups.length < 8) groups.push("0")

    return groups.map((g) => parseInt(g || "0", 16) || 0)
}

// Self-contained admin dashboard page, served at /admin.
export const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AllowMe Admin</title>
<style>
:root {
    --bg: #0b0e14;
    --panel: #131722;
    --panel-2: #171d2b;
    --border: #232b3d;
    --text: #e8ebf2;
    --muted: #8b93a7;
    --accent: #f6821f;
    --accent-soft: rgba(246, 130, 31, 0.12);
    --green: #3fb68b;
    --red: #e5484d;
    --radius: 12px;
}
* { box-sizing: border-box; margin: 0; }
body {
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
}
.wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
header h1 { font-size: 18px; font-weight: 650; letter-spacing: -0.01em; }
header h1 span { color: var(--accent); }
header .spacer { flex: 1; }
.badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 3px 10px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent); border: 1px solid rgba(246, 130, 31, 0.3);
}
.badge.green { background: rgba(63, 182, 139, 0.12); color: var(--green); border-color: rgba(63, 182, 139, 0.3); }
.badge.red { background: rgba(229, 72, 77, 0.12); color: var(--red); border-color: rgba(229, 72, 77, 0.3); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 10px; }
.card {
    background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px;
}
.card .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 4px; }
.card .value { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; word-break: break-all; }
.card .value.small { font-size: 14px; }
.panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; margin-top: 10px;
}
.panel h2 { font-size: 13px; font-weight: 650; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.panel h2 .count { color: var(--muted); font-weight: 500; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
td.ip { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
td.muted, .muted { color: var(--muted); }
.row-actions { text-align: right; white-space: nowrap; }
button {
    font: inherit; font-size: 12px; font-weight: 600;
    color: var(--text); background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 12px; cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
}
button:hover { border-color: var(--accent); }
button:disabled { opacity: 0.5; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: #131313; }
button.primary:hover { filter: brightness(1.08); }
button.danger:hover { border-color: var(--red); color: var(--red); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
input[type=text], input[type=password] {
    font: inherit; color: var(--text); background: var(--panel-2);
    border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; outline: none;
    min-width: 0;
}
input:focus { border-color: var(--accent); }
input[type=text] { flex: 1 1 140px; min-width: 140px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
.empty { color: var(--muted); font-size: 13px; padding: 8px; }
#toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(80px);
    background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 18px; font-size: 13px; font-weight: 600; opacity: 0;
    transition: transform 0.2s, opacity 0.2s; pointer-events: none; z-index: 10;
}
#toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
#toast.ok { border-color: var(--green); color: var(--green); }
#toast.err { border-color: var(--red); color: var(--red); }
#overlay {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 5;
}
#overlay .card { width: 100%; max-width: 340px; text-align: center; padding: 28px 24px; }
#overlay h1 { font-size: 17px; font-weight: 650; margin-bottom: 4px; }
#overlay h1 span { color: var(--accent); }
#overlay p { color: var(--muted); font-size: 13px; margin-bottom: 18px; }
#overlay form { display: flex; flex-direction: column; gap: 10px; }
#overlay input { width: 100%; text-align: center; }
#overlay .err { color: var(--red); font-size: 12px; min-height: 16px; }
.meta { color: var(--muted); font-size: 12px; }
.updated { font-size: 11px; color: var(--muted); }
.skel { height: 14px; border-radius: 6px; background: var(--panel-2); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }
@media (max-width: 560px) {
    .card .value { font-size: 17px; }
    td.hide-s, th.hide-s { display: none; }
    input[type=text], input[type=password] { font-size: 16px; max-width: none; }
}
</style>
</head>
<body>
<div id="overlay">
    <div class="card">
        <h1>AllowMe <span>Admin</span></h1>
        <p id="overlay-msg">Enter the admin password to continue.</p>
        <form id="login-form">
            <input type="password" id="pw" autocomplete="current-password" placeholder="Password" aria-label="Admin password">
            <div class="err" id="login-err"></div>
            <button type="submit" class="primary">Sign in</button>
        </form>
    </div>
</div>
<div class="wrap" id="main" hidden>
    <header>
        <h1>AllowMe <span>Admin</span></h1>
        <span class="badge green" id="status-badge"><span class="dot"></span>Online</span>
        <span class="spacer"></span>
        <span class="updated" id="updated"></span>
        <button id="btn-refresh" type="button">Refresh</button>
        <button id="btn-logout" type="button">Log out</button>
    </header>

    <div class="cards" id="cards"></div>

    <div class="panel">
        <h2>Actions</h2>
        <div class="actions">
            <button type="button" class="primary" id="btn-allow-me">Allow my IP</button>
            <button type="button" id="btn-cleanup">Run cleanup</button>
            <input type="text" id="new-ip" placeholder="IP to allow" aria-label="IP to allow" style="max-width: 220px">
            <button type="button" id="btn-allow-ip">Add</button>
        </div>
    </div>

    <div class="panel">
        <h2>Allowed IPs <span class="count" id="allowed-count"></span></h2>
        <div style="overflow-x: auto">
        <table>
            <thead><tr><th>IP</th><th>Device</th><th class="hide-s">Added</th><th></th></tr></thead>
            <tbody id="allowed-body"><tr><td colspan="4"><div class="skel"></div></td></tr></tbody>
        </table>
        </div>
    </div>

    <div class="panel">
        <h2>Banned IPs <span class="count" id="banned-count"></span></h2>
        <div id="banned-list"></div>
    </div>

    <div class="panel">
        <h2>Service</h2>
        <table><tbody id="config-body"></tbody></table>
    </div>
</div>
<div id="toast"></div>
<script>
"use strict"
var overlay = document.getElementById("overlay")
var overlayMsg = document.getElementById("overlay-msg")
var main = document.getElementById("main")
var toastEl = document.getElementById("toast")
var toastTimer = null
var clientIp = ""

function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function toast(msg, ok) {
    toastEl.textContent = msg
    toastEl.className = "show " + (ok === false ? "err" : "ok")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function() { toastEl.className = "" }, 3000)
}
function fmtUptime(sec) {
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60)
    if (d > 0) return d + "d " + h + "h"
    if (h > 0) return h + "h " + m + "m"
    return m + "m " + Math.floor(sec % 60) + "s"
}
function fmtDate(s) {
    if (!s) return "—"
    var d = new Date(s)
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})
}
function api(path, method, body) {
    var opts = {method: method || "GET", headers: {"Authorization": "Bearer " + (sessionStorage.adminKey || "")}}
    if (body) {
        opts.headers["Content-Type"] = "application/json"
        opts.body = JSON.stringify(body)
    }
    return fetch("/admin/api" + path, opts).then(function(r) {
        if (r.status == 401) { showLogin(sessionStorage.adminKey ? "Invalid password." : ""); sessionStorage.removeItem("adminKey"); throw new Error("unauthorized") }
        if (r.status == 403) { showDenied(); throw new Error("forbidden") }
        if (!r.ok) { throw new Error("HTTP " + r.status) }
        return r.json ? r.json() : null
    })
}
function showLogin(msg) {
    main.hidden = true
    overlay.style.display = "flex"
    overlayMsg.textContent = "Enter the admin password to continue."
    document.getElementById("login-err").textContent = msg || ""
    document.getElementById("pw").focus()
}
function showDenied() {
    main.hidden = true
    overlay.style.display = "flex"
    overlayMsg.textContent = "Your current IP is not on the allowed list."
    document.getElementById("login-form").style.display = "none"
}
function card(label, value, small) {
    return '<div class="card"><div class="label">' + esc(label) + '</div><div class="value' + (small ? " small" : "") + '">' + esc(value) + '</div></div>'
}
function render(d) {
    clientIp = d.clientIp
    document.getElementById("cards").innerHTML =
        card("Uptime", fmtUptime(d.uptime)) +
        card("Zone", d.cloudflare.zone, true) +
        card("List", d.cloudflare.listName || "—", true) +
        card("Allowed IPs", d.allowed.length) +
        card("Banned IPs", d.banned.length)

    document.getElementById("allowed-count").textContent = "(" + d.allowed.length + ")"
    var tbody = document.getElementById("allowed-body")
    if (d.allowed.length == 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">No IPs on the list.</td></tr>'
    } else {
        tbody.innerHTML = d.allowed.map(function(i) {
            return "<tr><td class=\\"ip\\">" + esc(i.ip) + "</td><td class=\\"muted\\">" + esc(i.device || "—") + '</td><td class=\\"muted hide-s\\">' + esc(fmtDate(i.added)) + '</td><td class=\\"row-actions\\"><button type=\\"button\\" class=\\"danger\\" data-ip=\\"' + esc(i.ip) + '\\" onclick=\\"blockIp(this.dataset.ip)\\">Remove</button></td></tr>'
        }).join("")
    }

    document.getElementById("banned-count").textContent = "(" + d.banned.length + ")"
    var bl = document.getElementById("banned-list")
    if (d.banned.length == 0) {
        bl.innerHTML = '<div class="empty">No banned IPs.</div>'
    } else {
        bl.innerHTML = "<table><tbody>" + d.banned.map(function(i) {
            return "<tr><td class=\\"ip\\">" + esc(i.ip) + '</td><td class=\\"muted\\">since ' + esc(fmtDate(i.since)) + '</td><td class=\\"row-actions\\"><button type=\\"button\\" data-ip=\\"' + esc(i.ip) + '\\" onclick=\\"unbanIp(this.dataset.ip)\\">Unban</button></td></tr>'
        }).join("") + "</tbody></table>"
    }
    if (d.failed && d.failed.length > 0) {
        bl.innerHTML += '<div class="empty" style="padding-top:10px">Recent failures: ' + d.failed.map(function(i) { return esc(i.ip) + " (" + i.count + ")" }).join(", ") + "</div>"
    }

    var rows = [
        ["Your IP", d.clientIp],
        ["Started", fmtDate(d.startedAt)],
        ["Port", d.config.port],
        ["Trust proxy", d.config.trustProxy ? "yes" : "no"],
        ["IP max age", d.config.maxAge > 0 ? d.config.maxAge + " min" : "disabled"],
        ["IP block", d.config.blockInterval > 0 ? d.config.blockInterval + " min after " + d.config.denyCount + " failures" : "disabled"],
        ["List ID", d.cloudflare.listId]
    ]
    document.getElementById("config-body").innerHTML = rows.map(function(r) {
        return '<tr><td class="muted" style="width:40%">' + esc(r[0]) + '</td><td class="ip">' + esc(r[1]) + "</td></tr>"
    }).join("")

    document.getElementById("updated").textContent = "Updated " + new Date().toLocaleTimeString()
}
function load() {
    return api("/status").then(function(d) {
        overlay.style.display = "none"
        document.getElementById("login-form").style.display = ""
        main.hidden = false
        render(d)
    }).catch(function(e) {
        if (e.message != "unauthorized" && e.message != "forbidden") {
            toast("Failed to load status", false)
        }
    })
}
function act(path, body, msg) {
    api(path, "POST", body || {}).then(function(r) {
        toast(r && r.ok === false ? "Nothing changed" : msg)
        load()
    }).catch(function(e) {
        if (e.message != "unauthorized" && e.message != "forbidden") toast("Action failed", false)
    })
}
window.blockIp = function(ip) { act("/block", {ip: ip}, "Removed " + ip) }
window.unbanIp = function(ip) { act("/unban", {ip: ip}, "Unbanned " + ip) }
document.getElementById("btn-allow-me").onclick = function() { act("/allow", {device: "Admin dashboard"}, "Allowed " + clientIp) }
document.getElementById("btn-allow-ip").onclick = function() {
    var el = document.getElementById("new-ip")
    var ip = el.value.trim()
    if (ip) {
        el.value = ""
        act("/allow", {ip: ip, device: "Admin dashboard"}, "Allowed " + ip)
    }
}
document.getElementById("btn-cleanup").onclick = function() { act("/cleanup", {}, "Cleanup done") }
document.getElementById("btn-refresh").onclick = load
document.getElementById("btn-logout").onclick = function() {
    sessionStorage.removeItem("adminKey")
    location.reload()
}
document.getElementById("login-form").onsubmit = function(e) {
    e.preventDefault()
    var pw = document.getElementById("pw").value
    if (!pw) return
    sessionStorage.adminKey = pw
    document.getElementById("pw").value = ""
    load()
}
load()
</script>
</body>
</html>`
