# DC Central &rarr; List

Turns a DC Central ticket into a tidy, copy-ready list.

```
20000000000 - Replace Processor

Asset Details
• Asset Location: ABC01/F01C01/AA1001/ABC01F01C01-AA1001
• Asset Tag: 10000001
• Classification: CLASS-A
• Serial: UNKNOWN_SERIAL
• MSFID: MSF-000000

Failed Parts (2)
1. Replace Processor
   • Location: CPU0
   • Serial: UNKNOWN_SERIAL
   • Model: UNKNOWN_MODEL
2. Replace Processor
   • Location: CPU1
   • Serial: UNKNOWN_SERIAL
   • Model: UNKNOWN_MODEL
```

Asset details come first, then every failed part under one heading. Network
tickets get a **Source Details** block and a **Destination Details** block in
place of **Asset Details**. Tick **One block per part** in the panel for the
original layout, where each part is a self-contained block with the ticket
header repeated.

## Install

Open the **[install page](https://dcc-toolbox.github.io/)** and drag the button onto your
bookmarks bar. Then open a ticket and click the bookmark — a panel appears in the top-right
with the list, already copied to your clipboard.

## Privacy &amp; liability

- **It runs entirely on your machine.** The whole tool is the text stored inside your
  bookmark. Nothing is installed, and there is no server, account or sign-in behind it.
- **Nothing is ever sent anywhere.** It makes no network requests of any kind — no
  telemetry, no analytics, no error reporting and no external scripts.
- **No confidential information is extracted.** It only reads the ticket already open in
  front of you, and it cannot see anything you don't already have access to.
- **The output goes to two places only:** the panel on your screen and your clipboard.
  Nothing is saved, cached or logged, beyond your two checkbox preferences.
- **You can verify all of this.** `bookmarklet/bookmarklet.src.js` is the complete,
  unminified source — read it before you use it.

Provided as-is, with no warranty, and not affiliated with or endorsed by any ticketing
system it reads. Anything you copy remains subject to your organisation's data handling
and classification policy — you are responsible for where you paste it.

## What's in here

| Path | Purpose |
| --- | --- |
| `bookmarklet/bookmarklet.src.js` | The whole tool, readable. **Edit this.** |
| `bookmarklet/build.py` | Rebuilds the bookmarklet and the install page |
| `bookmarklet/bookmarklet.txt` | Generated `javascript:` URL |
| `docs/index.html` | The install page, served by GitHub Pages |

## Building

```powershell
cd bookmarklet
python build.py
```

That regenerates `bookmarklet.txt` and `docs/index.html`. Commit both.

`build.py` strips comment-only lines, then percent-encodes just the characters
that would break a bookmark URL (`%`, newlines, tabs, `"`, `#`). Everything else
is left readable, which keeps the URL around 21 KB.

## How it reads the page

DC Central ships two layouts and the tool handles both.

**Older (Angular).** `#tasks-details-header` carries the task ID, panels are
`tasks-details-panel[label]`, field pairs are `<strong>` labels, and failed parts
live in a real `<table>`.

**Newer (React).** The task detail view renders inside **open shadow roots**, so
ordinary `querySelector` calls see nothing — the tool walks `.shadowRoot`
recursively to build its own root list. Panels are `div#tasks-details-panel` with
`span#tasks-details-panel-label`, a field pair is a `div` holding exactly two
`<span>`s, and the failed-parts table is nested flex `div`s with no table markup
at all. The parser therefore tries real tables, then ARIA grids, then uniform
flex rows.

Field mapping:

| Output | Source |
| --- | --- |
| Asset Location | `Datacenter` / `Colocation` / `Tile` / `Rack`, joined with `/`<br>(older layout uses the Location panel's `Details` field) |
| Asset Tag | `Tag` on the Asset panel, falling back to the header strip |
| Classification | `Security Classification` |
| Location | `Link Port Interface` on network assets; the failed part's `Location` in the parts list |
| Serial, Model | Matching failed-part columns |
| MSFID | `SKU` from the SKU Information panel |

## Notes

- Everything runs locally in the browser. It reads only the ticket page you are
  already looking at and sends nothing anywhere.
- The panel has a **Diagnostics** view listing every shadow root, panel and
  column it found — that's the fastest way to debug a layout change.
- The bookmarklet builds its UI inside its own shadow root with styles applied
  through CSSOM, so a strict page CSP can't block it and page CSS can't leak in.
- `Classification` falls back to a page-wide scan, which picks up the
  `Security class` field that older tickets keep outside the panels.

## Extension variant

The repo root is also a loadable MV3 extension. `edge://extensions` &rarr;
**Load unpacked** &rarr; pick the repo folder. It uses the same parser via
`chrome.scripting.executeScript` on the active tab. The bookmarklet is easier to
share, so prefer it unless you want a toolbar button.

For internal use.
