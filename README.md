# Domain Tab Grouper

A Chrome extension that puts tabs into groups by website on its own. There are no
URL patterns to set up: once two tabs in a window are on the same site, they get
a group named after that site, and new tabs from that site join the group.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder (the one containing `manifest.json`).
3. Pin the extension to change settings from the toolbar.

## Behaviour

- **Group by site or by exact host.** By default `mail.google.com` and
  `docs.google.com` share a `google.com` group; switch to *Exact host* to keep
  them apart. Common two-part suffixes (`bbc.co.uk`) and shared hosts
  (`*.github.io`, `*.vercel.app`) are handled.
- **Threshold.** A group is created once a site has *N* tabs in a window
  (default 2). Set it to 1 to group every tab. When a group drops below the
  threshold, its remaining tab is ungrouped.
- **Navigation.** A tab that moves to another site leaves its group and joins
  the right one.
- **Your own groups are left alone.** Tabs in groups you made by hand, and
  pinned tabs, are never touched.
- **Manual overrides stick.** Drag a tab out of a group (or into another) and
  the extension leaves it there until the tab moves to a different site.
  *Regroup all tabs* in the popup clears these overrides.
- **Colours** are chosen from the domain, so a site gets the same colour every time.
- **Excluded domains** (popup text box) are never grouped; `example.com` also
  covers its subdomains.
- After a browser restart, restored groups whose title matches their site are
  picked up again.

## Development

```sh
npm test            # unit tests + a run of background.js against a fake chrome API
npm run package     # dist/domain-tab-grouper.zip for the Chrome Web Store
python3 scripts/make_icons.py icons   # regenerate the icons
```

`src/domain.js` and `src/planner.js` hold the logic and have no `chrome.*` calls;
`src/background.js` applies the plan through the Chrome APIs.
