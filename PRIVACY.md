# Privacy

Domain Tab Grouper does not collect, store or send any personal data.

- **Tab URLs** are read in the browser only to work out which website each tab
  belongs to. They are not saved or sent anywhere.
- **Settings** are saved with `chrome.storage.sync`, so Chrome syncs them
  between your own browsers if you have Chrome sync turned on.
- **Group bookkeeping** (which groups the extension created) is kept in
  `chrome.storage.session`, which Chrome clears when the browser closes.
- The extension makes **no network requests**, has no analytics and loads no
  remote code.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | To read tab URLs and move tabs into groups |
| `tabGroups` | To create, name and colour tab groups |
| `storage` | To save your settings |
