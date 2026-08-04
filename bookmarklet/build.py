"""Builds the DC Central bookmarklet from bookmarklet.src.js.

Produces:
  bookmarklet.txt    - the javascript: URL to paste into a bookmark
  ../docs/index.html - the install page, published via GitHub Pages
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(HERE, "bookmarklet.src.js")
OUT_TXT = os.path.join(HERE, "bookmarklet.txt")
DOCS = os.path.join(REPO, "docs")
OUT_DOCS = os.path.join(DOCS, "index.html")


def squeeze(source):
    """Drop comment-only lines and blank lines. Newlines are kept so that
    automatic semicolon insertion behaves exactly as in the source."""
    keep = []
    for line in source.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        keep.append(stripped)
    return "\n".join(keep)


def to_url(code):
    """Percent-encode only what would break a bookmark URL."""
    code = code.replace("%", "%25")
    code = code.replace("\r", "")
    code = code.replace("\n", "%0A")
    code = code.replace("\t", "%09")
    code = code.replace('"', "%22")
    code = code.replace("#", "%23")
    return "javascript:" + code


PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DC Central &rarr; List</title>
<meta name="description" content="A one-click bookmarklet that turns a DC Central ticket into a tidy, copy-ready list.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230f6cbd'/><g fill='white'><circle cx='9' cy='10' r='2'/><rect x='14' y='9' width='11' height='2' rx='1'/><circle cx='9' cy='16' r='2'/><rect x='14' y='15' width='11' height='2' rx='1'/><circle cx='9' cy='22' r='2'/><rect x='14' y='21' width='11' height='2' rx='1'/></g></svg>">
<style>
  :root { --ink: #1b1b1b; --dim: #616161; --line: #e3e3e3; --brand: #0f6cbd; }
  * { box-sizing: border-box; }
  body { font: 16px/1.65 "Segoe UI", system-ui, -apple-system, sans-serif;
         max-width: 780px; margin: 0 auto; padding: 44px 22px 80px; color: var(--ink); }
  header { border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 30px; }
  h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -.4px; }
  h2 { font-size: 19px; margin: 38px 0 10px; }
  p.sub { color: var(--dim); margin: 0; font-size: 17px; }
  a { color: var(--brand); }
  .hero { background: #f7fafd; border: 1px solid #dce9f5; border-radius: 10px;
          padding: 24px; text-align: center; margin: 26px 0 8px; }
  .drag { display: inline-block; padding: 13px 26px; background: var(--brand); color: #fff;
          border-radius: 7px; text-decoration: none; font-weight: 600; font-size: 17px;
          cursor: grab; box-shadow: 0 3px 10px rgba(15,108,189,.35); }
  .drag:active { cursor: grabbing; }
  .hero small { display: block; margin-top: 12px; color: var(--dim); }
  ol, ul { padding-left: 22px; }
  li { margin: 7px 0; }
  code, kbd { background: #f2f2f2; border-radius: 3px; padding: 2px 6px;
              font: 13px Consolas, "Cascadia Mono", monospace; }
  kbd { border: 1px solid #d5d5d5; border-bottom-width: 2px; }
  pre { background: #faf9f8; border: 1px solid var(--line); border-radius: 6px;
        padding: 14px 16px; overflow: auto;
        font: 13px/1.6 Consolas, "Cascadia Mono", monospace; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line);
           font-size: 15px; vertical-align: top; }
  th { color: var(--dim); font-weight: 600; width: 34%; }
  button { font: 600 14px "Segoe UI", sans-serif; padding: 9px 15px; border: 1px solid #c8c8c8;
           border-radius: 5px; background: #fff; cursor: pointer; }
  button:hover { background: #f3f3f3; }
  textarea { width: 100%; height: 84px; margin-top: 10px; padding: 8px;
             font: 11px Consolas, monospace; border: 1px solid var(--line); border-radius: 5px;
             color: var(--dim); resize: vertical; }
  .note { background: #fff8e6; border: 1px solid #f0d68a; padding: 12px 16px;
          border-radius: 7px; margin-top: 14px; }
  .liability { background: linear-gradient(180deg, #fff7f7, #fff0f1);
               border: 1px solid #f1c4c7; border-left: 5px solid #c4314b;
               border-radius: 9px; padding: 18px 22px 20px; margin: 28px 0 6px;
               box-shadow: 0 2px 8px rgba(196,49,75,.07); }
  .liability h2 { margin: 0; font-size: 18px; color: #a4262c;
                  display: flex; align-items: center; gap: 9px; }
  .liability h2 svg { flex: none; }
  .liability ul { margin: 12px 0 0; padding-left: 20px; }
  .liability li { margin: 7px 0; }
  .liability li strong { color: #a4262c; }
  .liability .fine { margin: 15px 0 0; padding-top: 13px; border-top: 1px solid #f2d3d5;
                     font-size: 14px; line-height: 1.6; color: #7b5c5f; }
  details { border: 1px solid var(--line); border-radius: 7px; padding: 10px 14px; margin: 10px 0; }
  summary { cursor: pointer; font-weight: 600; }
  footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line);
           color: var(--dim); font-size: 14px; }
</style>
</head>
<body>

<header>
  <h1>DC Central &rarr; List</h1>
  <p class="sub">Turn any DC Central ticket into a tidy, copy-ready list &mdash; in one click.</p>
</header>

<div class="hero">
  <a class="drag" id="bm" href="#">DC Central &rarr; List</a>
  <small>Drag this button up to your bookmarks bar</small>
</div>

<section class="liability">
  <h2><svg width="19" height="19" viewBox="0 0 16 16" fill="#c4314b" aria-hidden="true"><path d="M8 .3 2 2.6v5c0 3.6 2.5 6.9 6 7.8 3.5-.9 6-4.2 6-7.8v-5L8 .3Zm3.4 5.5-4 4.4a.8.8 0 0 1-1.2 0L4.6 8.5a.8.8 0 0 1 1.2-1l1.1 1.2 3.4-3.8a.8.8 0 0 1 1.1 1.1Z"/></svg>Privacy &amp; liability</h2>
  <ul>
    <li><strong>It runs entirely on your machine.</strong> The whole tool is the text stored
        inside your bookmark. Nothing is installed, and there is no server, account or
        sign-in behind it.</li>
    <li><strong>Nothing is ever sent anywhere.</strong> It makes no network requests of any
        kind &mdash; no telemetry, no analytics, no error reporting and no external scripts.
        This page has no tracking on it either.</li>
    <li><strong>No confidential information is extracted.</strong> It only reads the ticket
        already open in front of you, and it cannot see anything you don't already have
        access to.</li>
    <li><strong>The output goes to two places only:</strong> the panel on your screen and
        your clipboard. Nothing is saved, cached or logged. Closing the tab leaves no trace
        beyond your two checkbox preferences.</li>
    <li><strong>You can verify all of this.</strong> The complete, unminified source is
        published in the repository linked below &mdash; read it before you use it.</li>
  </ul>
  <p class="fine">Provided as-is, with no warranty, and not affiliated with or endorsed by any
  ticketing system it reads. Anything you copy remains subject to your organisation's data
  handling and classification policy &mdash; you are responsible for where you paste it.</p>
</section>

<h2>Setup</h2>
<ol>
  <li>Show the bookmarks bar with <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>.</li>
  <li>Drag the blue button above onto it.</li>
  <li>Open a DC Central ticket and click the bookmark.</li>
</ol>
<p>A panel opens in the top-right with the formatted list, <strong>already copied to your
clipboard</strong>. Drag its title bar to move it out of the way.</p>

<h2>What it produces</h2>
<p>Asset details come first, then every failed part under a single heading.
All values below are made-up placeholders:</p>
<pre>20000000000 - Replace Processor

Asset Details
&bull; Asset Location: ABC01/F01C01/AA1001/ABC01F01C01-AA1001
&bull; Asset Tag: 10000001
&bull; Classification: CLASS-A
&bull; Serial: UNKNOWN_SERIAL
&bull; MSFID: MSF-000000

Failed Parts (2)
1. Replace Processor
   &bull; Location: CPU0
   &bull; Serial: UNKNOWN_SERIAL
   &bull; Model: UNKNOWN_MODEL
2. Replace Processor
   &bull; Location: CPU1
   &bull; Serial: UNKNOWN_SERIAL
   &bull; Model: UNKNOWN_MODEL</pre>

<p>Network tickets get a source block and a destination block, then the same parts list:</p>
<pre>20000000001 - Replace Single Mode Fiber Cable

Source Details
&bull; Device: ABC01-0100-0100-01AAA
&bull; Asset Location: ABC01/F01C02/AA2001/ABC01F01C02-AA2001
&bull; Asset Tag: 10000002
&bull; Classification: CLASS-A
&bull; Location: ethernet5/15/1
&bull; Serial: UNKNOWN_SERIAL
&bull; MSFID: MSF-000000

Destination Details
&bull; Device: ABC02-0101-0300-07AA
&bull; Asset Location: ABC02/F01C01/AA3001/ABC02F01C01-AA3001
&bull; Asset Tag: 10000003
&bull; Classification: CLASS-A
&bull; Location: etp20b
&bull; Serial: UNKNOWN_SERIAL
&bull; MSFID: MSF-000000

Failed Parts (2)
1. Replace Single Mode Fiber Cable
   &bull; Location: abc01-0100-0100-01aaa:ethernet5/15/1
   &bull; Serial:
   &bull; Model:
2. Replace Single Mode Fiber Cable
   &bull; Location: abc02-0101-0300-07aa:etp20b
   &bull; Serial:
   &bull; Model:</pre>

<h2>Where the fields come from</h2>
<table>
  <tr><th>Asset Location</th><td>Datacenter / Colocation / Tile / Rack, joined with slashes</td></tr>
  <tr><th>Asset Tag</th><td>Tag on the Asset panel, or the header strip as a fallback</td></tr>
  <tr><th>Classification</th><td>Security Classification from the asset panel</td></tr>
  <tr><th>Location</th><td>The link port on network assets; the slot or port on each failed part</td></tr>
  <tr><th>Serial &amp; Model</th><td>The matching columns of the failed-parts table</td></tr>
  <tr><th>MSFID</th><td>SKU from the SKU Information panel</td></tr>
</table>

<h2>Options</h2>
<ul>
  <li><strong>Hide empty fields</strong> &mdash; leave out bullets that have no value.</li>
  <li><strong>One block per part</strong> &mdash; the original layout, where every part gets its
      own self-contained block with the ticket header repeated above it.</li>
</ul>
<p>Both are remembered for next time.</p>

<h2>Troubleshooting</h2>
<details>
  <summary>Nothing happens when I click the bookmark</summary>
  <p>Make sure you dragged the <em>button</em> and not the page link, and that the bookmark's
  URL starts with <code>javascript:</code>. Some browsers strip that if you paste it into the
  address bar &mdash; paste it into the bookmark's URL field instead.</p>
</details>
<details>
  <summary>It says it can't find ticket details</summary>
  <p>Give the ticket a moment to finish loading, then press <strong>Re-read</strong>. If it
  still fails, open <strong>Diagnostics</strong> in the panel and send that text to whoever
  maintains this page &mdash; it lists every panel and column the tool could see.</p>
</details>
<details>
  <summary>It didn't copy to my clipboard</summary>
  <p>The browser only allows automatic copying when the page has focus. Click anywhere on the
  ticket first, then press <strong>Copy</strong> in the panel.</p>
</details>
<details>
  <summary>Does it work on both the old and new ticket layouts?</summary>
  <p>Yes. It reads the older Angular pages and the newer React ones, including content rendered
  inside shadow DOM, and handles real tables, ARIA grids and flex-div tables alike.</p>
</details>

<h2>Prefer not to drag?</h2>
<p><button id="copy">Copy the bookmarklet code</button></p>
<textarea id="raw" readonly></textarea>
<div class="note">
  Right-click the bookmarks bar &rarr; <em>Add page</em>, give it any name, then paste the code
  above into the URL box.
</div>

<footer>
  Runs entirely in your browser and sends nothing anywhere.
  <a href="https://github.com/DCC-Toolbox/dcc-toolbox.github.io">Read the source on GitHub</a>.
</footer>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
  var url = JSON.parse(document.getElementById("payload").textContent);
  document.getElementById("bm").href = url;
  document.getElementById("raw").value = url;
  document.getElementById("copy").addEventListener("click", function () {
    var btn = document.getElementById("copy");
    var box = document.getElementById("raw");
    box.select();
    function done() { btn.textContent = "Copied!"; setTimeout(function () {
      btn.textContent = "Copy the bookmarklet code"; }, 2000); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {
        document.execCommand("copy"); done();
      });
    } else {
      document.execCommand("copy"); done();
    }
  });
</script>
</body>
</html>
"""


def main():
    source = open(SRC, encoding="utf-8").read()
    code = squeeze(source)
    url = to_url(code)

    open(OUT_TXT, "w", encoding="utf-8").write(url)

    payload = json.dumps(url).replace("</", "<\\/")
    page = PAGE.replace("__PAYLOAD__", payload)

    os.makedirs(DOCS, exist_ok=True)
    open(OUT_DOCS, "w", encoding="utf-8").write(page)
    open(os.path.join(DOCS, ".nojekyll"), "w", encoding="utf-8").write("")

    print("source   : %6d bytes" % len(source))
    print("squeezed : %6d bytes" % len(code))
    print("bookmark : %6d bytes" % len(url))
    for p in (OUT_TXT, OUT_DOCS):
        print("wrote", p)


if __name__ == "__main__":
    main()
