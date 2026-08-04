(function () {
"use strict";

var HOST_ID = "dccfmt-host";
var D = document;

// ---------------------------------------------------------------- scraping

function scrapeTicket() {
var debug = [];

function clean(v) {
return String(v == null ? "" : v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function norm(v) {
return clean(v).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function blank(v) {
var s = clean(v);
return !s || s === "-" || s === "--" || s === "---" || s.toLowerCase() === "n/a";
}
function val(v) {
return blank(v) ? "" : clean(v);
}

// The ticket renders inside open shadow roots, which normal queries miss.
function collectRoots() {
var roots = [D];
var stack = [D];
var guard = 0;
while (stack.length && guard++ < 5000) {
var node = stack.pop();
var els;
try { els = node.querySelectorAll("*"); } catch (e) { continue; }
for (var i = 0; i < els.length; i++) {
if (els[i].id === HOST_ID) continue;
var sr = els[i].shadowRoot;
if (sr) { roots.push(sr); stack.push(sr); }
}
}
return roots;
}
var ROOTS = collectRoots();

function deepAll(sel) {
var out = [];
for (var i = 0; i < ROOTS.length; i++) {
var found;
try { found = ROOTS[i].querySelectorAll(sel); } catch (e) { continue; }
for (var j = 0; j < found.length; j++) out.push(found[j]);
}
return out;
}
function deepOne(sel) {
var a = deepAll(sel);
return a.length ? a[0] : null;
}

debug.push("url: " + location.href);
debug.push("shadow roots: " + (ROOTS.length - 1));

// ticket id and name
var ticket = "";
var name = "";

var header = deepOne('[id="TasksDetailsHeader"]');
if (header) {
debug.push("header: TasksDetailsHeader (new layout)");
var mh = clean(header.textContent).match(/Task\s*ID\s*:?\s*(\d{8,14})/i);
if (mh) ticket = mh[1];
var th = header.querySelector("span[title]");
if (th) name = clean(th.getAttribute("title"));
}
if (!ticket) {
var oldHdr = deepOne('[id="tasks-details-header"]');
if (oldHdr) {
debug.push("header: tasks-details-header (old layout)");
var mo = oldHdr.textContent.match(/(\d{8,14})/);
if (mo) ticket = mo[1];
}
}
if (!name) {
var h1 = deepOne("h1.title, h1[title]");
if (h1) name = clean(h1.getAttribute("title") || h1.textContent);
}
if (!ticket) {
var mt = (D.title || "").match(/Task\s*(\d{8,14})/i);
if (mt) ticket = mt[1];
}
if (!ticket) {
var mu = location.pathname.match(/(\d{8,14})/);
if (mu) ticket = mu[1];
}
name = clean(name).replace(/^\(\s*\d+\s*\)\s*/, "");

debug.push("ticket: " + (ticket || "(none)"));
debug.push("name: " + (name || "(none)"));

// panels
var panels = [];
deepAll('[id="tasks-details-panel"]').forEach(function (p) {
var l = p.querySelector('[id="tasks-details-panel-label"]');
panels.push({ el: p, label: l ? clean(l.textContent).replace(/:\s*$/, "") : "" });
});
deepAll("tasks-details-panel[label]").forEach(function (p) {
panels.push({ el: p, label: clean(p.getAttribute("label")) });
});

debug.push("panels (" + panels.length + "): " +
(panels.map(function (p) { return p.label; }).filter(Boolean).join(" | ") || "(none)"));

function panelBy(names) {
for (var i = 0; i < names.length; i++) {
for (var j = 0; j < panels.length; j++) {
if (norm(panels[j].label) === norm(names[i])) return panels[j];
}
}
return null;
}

// Field pairs: new layout uses two sibling spans, old layout uses <strong>.
function pairsIn(panel) {
var out = [];
if (!panel) return out;
var el = panel.el;

el.querySelectorAll("div").forEach(function (d) {
var k = d.children;
if (k.length !== 2) return;
if (k[0].tagName !== "SPAN" || k[1].tagName !== "SPAN") return;
var key = clean(k[0].textContent);
if (key) out.push({ key: key, value: clean(k[1].textContent) });
});

el.querySelectorAll("strong").forEach(function (s) {
var parent = s.parentElement;
if (!parent) return;
var key = clean(s.textContent).replace(/:\s*$/, "");
if (!key) return;
var copy = parent.cloneNode(true);
copy.querySelectorAll("strong").forEach(function (x) { x.remove(); });
out.push({ key: key, value: clean(copy.textContent) });
});

return out;
}

function pick(pairs, names) {
for (var i = 0; i < names.length; i++) {
for (var j = 0; j < pairs.length; j++) {
if (norm(pairs[j].key) === norm(names[i])) return val(pairs[j].value);
}
}
return "";
}

// tables: real <table>, ARIA grid, or nested flex divs
function fromRealTable(t) {
var headers = [];
t.querySelectorAll("thead th").forEach(function (th) { headers.push(clean(th.textContent)); });
if (!headers.length) {
var first = t.querySelector("tr");
if (first) first.querySelectorAll("th,td").forEach(function (c) { headers.push(clean(c.textContent)); });
}
var rows = [];
var trs = t.querySelectorAll("tbody tr");
if (!trs.length) trs = t.querySelectorAll("tr");
trs.forEach(function (tr) {
var tds = tr.querySelectorAll("td");
if (tds.length) rows.push(Array.prototype.map.call(tds, function (c) { return clean(c.textContent); }));
});
return headers.length && rows.length ? { headers: headers, rows: rows } : null;
}

function fromAriaGrid(g) {
var headers = [];
g.querySelectorAll('[role="columnheader"]').forEach(function (h) { headers.push(clean(h.textContent)); });
var rows = [];
g.querySelectorAll('[role="row"]').forEach(function (r) {
var cells = r.querySelectorAll('[role="gridcell"], [role="cell"]');
if (cells.length) rows.push(Array.prototype.map.call(cells, function (c) { return clean(c.textContent); }));
});
return headers.length && rows.length ? { headers: headers, rows: rows } : null;
}

// Newer layout builds tables from nested flex divs with uniform child counts.
function fromFlexDivs(scope) {
var divs = scope.querySelectorAll("div");
for (var i = 0; i < divs.length; i++) {
var kids = Array.prototype.filter.call(divs[i].children, function (r) {
return r.children && r.children.length >= 2;
});
if (kids.length < 2) continue;

var width = kids[0].children.length;
var uniform = true;
for (var j = 1; j < kids.length; j++) {
if (kids[j].children.length !== width) { uniform = false; break; }
}
if (!uniform) continue;

var headers = Array.prototype.map.call(kids[0].children, function (c) { return clean(c.textContent); });
if (!headers.filter(Boolean).length) continue;

var rows = [];
for (var k = 1; k < kids.length; k++) {
rows.push(Array.prototype.map.call(kids[k].children, function (c) { return clean(c.textContent); }));
}
if (rows.length) return { headers: headers, rows: rows };
}
return null;
}

function readTable(scope) {
var t = scope.querySelector("table");
if (t) { var r1 = fromRealTable(t); if (r1) return r1; }
var g = scope.querySelector('[role="grid"], [role="table"]');
if (g) { var r2 = fromAriaGrid(g); if (r2) return r2; }
return fromFlexDivs(scope);
}

function colAt(headers, names) {
for (var i = 0; i < names.length; i++) {
for (var j = 0; j < headers.length; j++) {
if (norm(headers[j]) === norm(names[i])) return j;
}
}
return -1;
}

// failed parts
var table = null;
var fpPanel = panelBy(["Failed part(s)", "Failed parts", "Failed part"]);
if (fpPanel) {
table = readTable(fpPanel.el);
debug.push("failed parts panel: found" + (table ? "" : " (but no table inside)"));
} else {
var labelled = deepOne('table[aria-label="Failed parts"]');
if (labelled) {
table = fromRealTable(labelled);
debug.push("failed parts: table[aria-label]");
}
}
if (table) {
debug.push("part columns: " + table.headers.join(" | "));
debug.push("part rows: " + table.rows.length);
} else {
debug.push("failed parts: NOT FOUND");
}

var parts = [];
if (table) {
var iAct = colAt(table.headers, ["Repair Action", "Action"]);
var iTyp = colAt(table.headers, ["Part Type", "Component Type", "Part"]);
var iLoc = colAt(table.headers, ["Location", "Slot", "Position"]);
var iSer = colAt(table.headers, ["Serial#", "Serial #", "Serial Number", "Serial"]);
var iMod = colAt(table.headers, ["Model", "Model Number"]);
var iMan = colAt(table.headers, ["Manufacturer", "Vendor"]);
var iMsf = colAt(table.headers, ["MSF", "MSF Number", "MSFID", "Part Number"]);

table.rows.forEach(function (r) {
function at(i) { return i >= 0 && r[i] != null ? val(r[i]) : ""; }
var p = {
action: at(iAct),
type: at(iTyp),
location: at(iLoc),
serial: at(iSer),
model: at(iMod),
manufacturer: at(iMan),
msf: at(iMsf)
};
if (p.action || p.type || p.location || p.serial || p.model) parts.push(p);
});
}

// asset, rack location, sku
function locationPath(pairs) {
return [
pick(pairs, ["Datacenter", "Data Center", "DC"]),
pick(pairs, ["Colocation", "Colo"]),
pick(pairs, ["Tile"]),
pick(pairs, ["Rack"])
].filter(Boolean).join("/");
}

var skuPairs = pairsIn(panelBy(["SKU Information", "SKU"]));
var msfid = pick(skuPairs, ["SKU", "Discrete SKU"]);

// Some fields live outside the Asset panel, so keep a page-wide pool too.
var allPairs = [];
panels.forEach(function (p) { allPairs = allPairs.concat(pairsIn(p)); });

// Last resort: a few layouts keep these fields outside any panel entirely.
var deepPairs = null;
function pairsEverywhere() {
if (deepPairs) return deepPairs;
deepPairs = [];
for (var i = 0; i < ROOTS.length; i++) {
var scope = ROOTS[i] === D ? D.body : ROOTS[i];
if (scope) deepPairs = deepPairs.concat(pairsIn({ el: scope }));
}
return deepPairs;
}

// network endpoints
var endpoints = [];
var srcPanel = panelBy(["Source Asset"]);
var dstPanel = panelBy(["Destination Asset"]);

if (srcPanel && dstPanel) {
debug.push("type: NETWORK (source + destination)");
[["Source", srcPanel, panelBy(["Source Location"])],
["Destination", dstPanel, panelBy(["Destination Location"])]].forEach(function (e) {
var a = pairsIn(e[1]);
var l = pairsIn(e[2]);
endpoints.push({
label: e[0],
device: pick(a, ["Name", "Device", "Device Name"]),
assetTag: pick(a, ["Tag", "Asset Tag"]),
assetSerial: pick(a, ["Serial", "Serial Number"]),
classification: pick(a, ["Security Classification", "Classification", "Security Class"]),
port: pick(a, ["Link Port Interface", "Port", "Interface"]),
rack: pick(l, ["Rack"]),
assetLocation: locationPath(l)
});
});
}

// hardware asset
var assetPairs = pairsIn(panelBy(["Asset"]));
var locPairs = pairsIn(panelBy(["Location"]));

var assetTag = pick(assetPairs, ["Tag", "Asset Tag"]);
var assetSerial = pick(assetPairs, ["Serial", "Serial Number"]);
var classification = pick(assetPairs, ["Security Classification", "Classification", "Security Class"]);
var rack = pick(locPairs, ["Rack"]);
// "Details" is the full path on the older layout; the newer one splits it up.
var assetLocation = pick(locPairs, ["Details", "Full Location", "Asset Location"]) || locationPath(locPairs);

if (!classification) {
classification = pick(allPairs, ["Security Classification", "Security Class", "Classification"]);
}
if (!classification) {
classification = pick(pairsEverywhere(), ["Security Classification", "Security Class", "Classification"]);
}
if (!rack) rack = pick(allPairs, ["Rack"]);

// The header strip carries the tag and serial on the newer layout.
if (!assetTag && header) {
var ma = clean(header.textContent).match(/Asset\s*tag\s*:?\s*([A-Za-z0-9\-]+)/i);
if (ma) assetTag = ma[1];
}
if (!assetSerial && header) {
var ms = clean(header.textContent).match(/Serial\s*:?\s*([A-Za-z0-9\-]+)/i);
if (ms) assetSerial = ms[1];
}
if (!assetTag && endpoints.length) assetTag = endpoints[0].assetTag;
if (!assetLocation && endpoints.length) assetLocation = endpoints[0].assetLocation;
if (!rack && endpoints.length) rack = endpoints[0].rack;
if (!classification && endpoints.length) classification = endpoints[0].classification;

debug.push("assetTag: " + (assetTag || "(none)"));
debug.push("rack: " + (rack || "(none)"));
debug.push("assetLocation: " + (assetLocation || "(none)"));
debug.push("classification: " + (classification || "(none)"));
debug.push("MSFID: " + (msfid || "(none)"));

return {
ok: !!(ticket && (panels.length || parts.length)),
ticket: ticket,
name: name,
assetTag: assetTag,
assetSerial: assetSerial,
classification: classification,
rack: rack,
assetLocation: assetLocation,
msfid: msfid,
parts: parts,
endpoints: endpoints,
debug: debug.join("\n")
};
}

// --------------------------------------------------------------- rendering

function sp(v) {
return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function render(d, opts) {
var head = d.ticket + (d.name ? " - " + d.name : "");
if (opts.legacy) return renderLegacy(d, opts, head);

var out = [head];

function bullet(label, value) {
if (opts.hideEmpty && !value) return null;
return "\u2022 " + label + ": " + (value || "");
}
function section(heading, rows) {
var lines = [heading];
rows.forEach(function (r) { if (r !== null) lines.push(r); });
out.push(lines.join("\n"));
}

// Asset and location details come first, one section per endpoint.
if (d.endpoints && d.endpoints.length) {
d.endpoints.forEach(function (e) {
section(e.label + " Details", [
bullet("Device", e.device),
bullet("Asset Location", e.assetLocation),
bullet("Asset Tag", e.assetTag),
bullet("Classification", e.classification),
bullet("Location", e.port),
bullet("Serial", e.assetSerial),
bullet("MSFID", d.msfid)
]);
});
} else {
section("Asset Details", [
bullet("Asset Location", d.assetLocation),
bullet("Asset Tag", d.assetTag),
bullet("Classification", d.classification),
bullet("Serial", d.assetSerial),
bullet("MSFID", d.msfid)
]);
}

var parts = d.parts || [];
if (parts.length) {
var many = parts.length > 1;
var lines = [many ? "Failed Parts (" + parts.length + ")" : "Failed Part"];
parts.forEach(function (p, i) {
var title = sp(p.action + " " + p.type) || "Part " + (i + 1);
lines.push(many ? (i + 1) + ". " + title : title);
[["Location", p.location], ["Serial", p.serial], ["Model", p.model]].forEach(function (f) {
if (opts.hideEmpty && !f[1]) return;
lines.push((many ? "   " : "") + "\u2022 " + f[0] + ": " + (f[1] || ""));
});
});
out.push(lines.join("\n"));
}

return out.join("\n\n");
}

// The original shape: one self-contained block per part, header repeated.
function renderLegacy(d, opts, head) {
var out = [];

function bullet(label, value) {
if (opts.hideEmpty && !value) return null;
return "\u2022 " + label + ": " + (value || "");
}
function block(heading, rows) {
var lines = [head];
if (heading) lines.push(heading);
rows.forEach(function (r) { if (r !== null) lines.push(r); });
out.push(lines.join("\n"));
}

if (d.endpoints && d.endpoints.length) {
var part = d.parts && d.parts.length ? d.parts[0] : null;
d.endpoints.forEach(function (e) {
block(e.label + " Details", [
bullet("Device", e.device),
bullet("Asset Location", e.assetLocation),
bullet("Asset Tag", e.assetTag),
bullet("Classification", e.classification),
bullet("Location", e.port),
bullet("Serial", part ? part.serial : e.assetSerial),
bullet("Model", part ? part.model : ""),
bullet("MSFID", d.msfid)
]);
});
return out.join("\n\n");
}

if (d.parts && d.parts.length) {
d.parts.forEach(function (p) {
var heading = sp(p.action + " " + p.type);
block(heading && heading !== d.name ? heading : "", [
bullet("Asset Location", d.assetLocation),
bullet("Asset Tag", d.assetTag),
bullet("Classification", d.classification),
bullet("Location", p.location),
bullet("Serial", p.serial),
bullet("Model", p.model),
bullet("MSFID", p.msf || d.msfid)
]);
});
return out.join("\n\n");
}

block("", [
bullet("Asset Location", d.assetLocation),
bullet("Asset Tag", d.assetTag),
bullet("Classification", d.classification),
bullet("Location", ""),
bullet("Serial", d.assetSerial),
bullet("Model", ""),
bullet("MSFID", d.msfid)
]);
return out.join("\n\n");
}

// ------------------------------------------------------------------ panel

function loadOpts() {
var o = { hideEmpty: false, legacy: false };
try {
var raw = localStorage.getItem("dccFmtOpts");
if (raw) {
var p = JSON.parse(raw);
o.hideEmpty = !!p.hideEmpty;
o.legacy = !!p.legacy;
}
} catch (e) {}
return o;
}
function saveOpts(o) {
try { localStorage.setItem("dccFmtOpts", JSON.stringify(o)); } catch (e) {}
}

// Styles go through CSSOM so a strict page CSP cannot block them.
function el(tag, css, text) {
var e = D.createElement(tag);
if (css) e.style.cssText = css;
if (text != null) e.textContent = text;
return e;
}

var BTN = "font:600 12px/1 'Segoe UI',system-ui,sans-serif;padding:7px 11px;border:1px solid #c8c8c8;" +
"border-radius:4px;background:#fff;color:#1b1b1b;cursor:pointer";
var PRE = "white-space:pre-wrap;word-break:break-word;margin:0;padding:9px;background:#faf9f8;" +
"border:1px solid #e3e3e3;border-radius:4px;font:12px/1.5 Consolas,'Cascadia Mono',monospace;" +
"user-select:text;overflow:auto";

function build() {
var host = el("div", "position:fixed;top:16px;right:16px;z-index:2147483647");
host.id = HOST_ID;
var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

var card = el("div",
"width:470px;max-width:calc(100vw - 32px);background:#fff;color:#1b1b1b;border:1px solid #d1d1d1;" +
"border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.3);overflow:hidden;" +
"font:13px/1.45 'Segoe UI',system-ui,sans-serif");

var bar = el("div",
"display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0f6cbd;color:#fff;" +
"cursor:move;user-select:none");
bar.appendChild(el("div", "font-weight:600", "DC Central \u2192 List"));
var close = el("button", "margin-left:auto;background:transparent;border:0;color:#fff;font-size:17px;" +
"line-height:1;cursor:pointer;padding:0 2px", "\u00d7");
bar.appendChild(close);

var body = el("div", "padding:10px;display:flex;flex-direction:column;gap:8px");
var status = el("div", "font-size:12px;color:#616161;min-height:16px", "Reading the page\u2026");
var out = el("pre", PRE + ";max-height:48vh", "");

var row = el("div", "display:flex;gap:6px;align-items:center;flex-wrap:wrap");
var bCopy = el("button", BTN, "Copy");
var bRerun = el("button", BTN, "Re-read");
var bDiag = el("button", BTN + ";margin-left:auto", "Diagnostics");
row.appendChild(bCopy);
row.appendChild(bRerun);
row.appendChild(bDiag);

var optRow = el("div", "display:flex;gap:14px;font-size:12px;color:#3b3b3b;flex-wrap:wrap");
function check(label, on) {
var w = el("label", "display:flex;align-items:center;gap:5px;cursor:pointer");
var c = D.createElement("input");
c.type = "checkbox";
c.checked = !!on;
c.style.cssText = "margin:0";
w.appendChild(c);
w.appendChild(el("span", null, label));
optRow.appendChild(w);
return c;
}

var diag = el("pre", PRE + ";max-height:32vh;display:none;font-size:11px;color:#444", "");

body.appendChild(status);
body.appendChild(out);
body.appendChild(row);
body.appendChild(optRow);
body.appendChild(diag);
card.appendChild(bar);
card.appendChild(body);
root.appendChild(card);
D.documentElement.appendChild(host);

bar.addEventListener("mousedown", function (ev) {
if (ev.target === close) return;
var r = host.getBoundingClientRect();
var dx = ev.clientX - r.left;
var dy = ev.clientY - r.top;
function move(e2) {
host.style.left = Math.max(0, e2.clientX - dx) + "px";
host.style.top = Math.max(0, e2.clientY - dy) + "px";
host.style.right = "auto";
}
function up() {
D.removeEventListener("mousemove", move);
D.removeEventListener("mouseup", up);
}
D.addEventListener("mousemove", move);
D.addEventListener("mouseup", up);
ev.preventDefault();
});

return { host: host, close: close, status: status, out: out, diag: diag,
bCopy: bCopy, bRerun: bRerun, bDiag: bDiag, check: check };
}

function legacyCopy(t) {
return new Promise(function (res, rej) {
var ta = D.createElement("textarea");
ta.value = t;
ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
D.body.appendChild(ta);
ta.focus();
ta.select();
var ok = false;
try { ok = D.execCommand("copy"); } catch (e) {}
ta.remove();
if (ok) { res(); } else { rej(new Error("copy blocked")); }
});
}
function copyText(t) {
if (!t) return Promise.reject(new Error("nothing to copy"));
if (navigator.clipboard && navigator.clipboard.writeText) {
return navigator.clipboard.writeText(t)["catch"](function () { return legacyCopy(t); });
}
return legacyCopy(t);
}

// ------------------------------------------------------------------- main

var existing = D.getElementById(HOST_ID);
if (existing) existing.remove();

var ui = build();
var o = loadOpts();
var cHide = ui.check("Hide empty fields", o.hideEmpty);
var cLegacy = ui.check("One block per part", o.legacy);
var last = null;
var timer = null;

function options() {
return { hideEmpty: cHide.checked, legacy: cLegacy.checked };
}
function say(msg, colour) {
ui.status.textContent = msg;
ui.status.style.color = colour || "#616161";
}
function paint() {
if (last && last.ok) ui.out.textContent = render(last, options());
}

function attempt(deadline) {
var d;
try {
d = scrapeTicket();
} catch (e) {
say("Error while reading: " + e.message, "#a80000");
return;
}
last = d;
ui.diag.textContent = d.debug || "(no diagnostics)";

if (!d.ok) {
if (Date.now() < deadline) {
say("Waiting for the ticket to finish loading\u2026");
timer = setTimeout(function () { attempt(deadline); }, 700);
return;
}
say("No ticket details found here. Open Diagnostics and send me that text.", "#a80000");
ui.out.textContent = "Nothing found on this page.";
ui.diag.style.display = "block";
return;
}

ui.out.textContent = render(d, options());
var bits = [];
if (d.endpoints.length) bits.push(d.endpoints.length + " endpoint" + (d.endpoints.length === 1 ? "" : "s"));
if (d.parts.length) bits.push(d.parts.length + " part" + (d.parts.length === 1 ? "" : "s"));
var label = "Formatted" + (bits.length ? " " + bits.join(" and ") : "") + ".";
say(label, "#0b6a0b");
copyText(ui.out.textContent).then(function () {
say(label + " Copied to clipboard.", "#0b6a0b");
}, function () {
say(label + " Press Copy to put it on the clipboard.", "#8a6d00");
});
}

function run() {
if (timer) clearTimeout(timer);
say("Reading the page\u2026");
attempt(Date.now() + 25000);
}

ui.close.addEventListener("click", function () {
if (timer) clearTimeout(timer);
ui.host.remove();
});
ui.bRerun.addEventListener("click", run);
ui.bCopy.addEventListener("click", function () {
copyText(ui.out.textContent).then(function () { say("Copied.", "#0b6a0b"); },
function (e) { say("Could not copy: " + e.message, "#a80000"); });
});
ui.bDiag.addEventListener("click", function () {
ui.diag.style.display = ui.diag.style.display === "none" ? "block" : "none";
});
cHide.addEventListener("change", function () { saveOpts(options()); paint(); });
cLegacy.addEventListener("change", function () { saveOpts(options()); paint(); });

try { window.__dccFmt = { scrape: scrapeTicket, render: render, run: run }; } catch (e) {}

run();
})();
