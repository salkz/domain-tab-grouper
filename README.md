# Domain Tab Grouper

[![CI](https://github.com/salkz/domain-tab-grouper/actions/workflows/ci.yml/badge.svg)](https://github.com/salkz/domain-tab-grouper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Chrome extension that groups your tabs by website, with nothing to set up.

Other tab-grouping extensions make you write a URL pattern for every group.
This one doesn't: once two tabs in a window are on the same site, they get a
group named after that site, and later tabs from that site join it.

## Install

The extension isn't on the Chrome Web Store yet. To install it from a release:

1. Download `domain-tab-grouper-<version>.zip` from the
   [latest release](https://github.com/salkz/domain-tab-grouper/releases/latest)
   and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.
4. Optional: pin the extension to the toolbar to get to its settings quickly.

To run it from source instead, clone this repository and choose the clone in
step 3. Chrome loads the folder directly, with no build step.

It works in any Chromium browser that supports tab groups (Chrome 102+, Edge,
Brave, Opera, Vivaldi).

## How it works

- **Grouping by site.** By default `mail.google.com` and `docs.google.com` share
  a `google.com` group. Switch to *Exact host* to keep them apart. Suffixes
  like `bbc.co.uk` and shared hosting such as `*.github.io` and `*.vercel.app`
  are recognised, so different owners don't end up in one group.
- **When a group appears.** A site gets a group once it has *N* tabs open in a
  window (2 by default). Set *N* to 1 to group every tab. When a group drops
  below *N*, its last tab is ungrouped.
- **Moving between sites.** A tab that navigates to another site leaves its
  group and joins the right one.
- **Your own groups are safe.** Groups you made yourself and pinned tabs are
  never touched.
- **Manual moves stick.** Drag a tab out of a group, or into another one, and
  it stays where you put it until it goes to a different site. *Regroup all
  tabs* in the popup clears these.
- **Stable colours.** The colour comes from the domain name, so a site always
  gets the same one.
- **Exclusions.** Domains listed under *Never group these domains* are left
  alone. `example.com` also covers its subdomains.
- **After a restart.** Restored groups whose title matches their site are
  managed again.

## Settings

Click the toolbar icon to change these:

| Setting | Default | What it does |
|---|---|---|
| On | on | Turns automatic grouping on and off |
| Group by | Site | *Site* (`google.com`) or *Exact host* (`mail.google.com`) |
| Make a group once a site has *N* tabs | 2 | How many tabs a site needs before it gets a group |
| Short titles | off | Shows `github` instead of `github.com` |
| Collapse new groups in the background | off | Collapses a new group unless it holds the active tab |
| Never group these domains | none | Comma- or line-separated list of domains |

*Ungroup all & turn off* removes every group the extension made and stops it.
Groups you made yourself stay as they are.

Settings sync across your Chrome profiles through Chrome sync.

## Privacy

The extension reads tab URLs only to work out which site each tab is on. It
stores nothing but your settings and makes no network requests. See
[PRIVACY.md](PRIVACY.md).

## Development

You need Node.js 20 or later for the tests. There are no dependencies to install.

```sh
npm test          # unit tests, plus background.js run against a fake chrome API
npm run package   # builds dist/domain-tab-grouper.zip
python3 scripts/make_icons.py icons   # redraws the icons
```

| File | Role |
|---|---|
| `src/domain.js` | Turns a URL into a group key, label and colour |
| `src/planner.js` | Decides how one window's tabs should be grouped |
| `src/background.js` | Service worker: listens to tab events and applies the plan |
| `src/settings.js` | Settings defaults and loading |
| `src/popup.*` | Toolbar popup, also used as the options page |

`domain.js` and `planner.js` make no `chrome.*` calls, so most behaviour can be
tested in plain Node. To try a change, reload the extension on
`chrome://extensions`.

Pushing a tag like `v1.0.1` makes GitHub Actions run the tests and attach the
zip to a release. Bump `version` in `manifest.json` and `package.json` first.

## Contributing

Issues and pull requests are welcome. Please run `npm test` before opening a
pull request, and add a test to `test/` when you change grouping behaviour.

## License

[MIT](LICENSE)
