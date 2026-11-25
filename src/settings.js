import { parseExcluded } from './domain.js';

export const DEFAULTS = {
  enabled: true,
  // 'base' puts mail.google.com and docs.google.com together; 'host' keeps them apart.
  mode: 'base',
  // A domain gets a group once this many tabs in a window are on it.
  minTabs: 2,
  // Show "github" instead of "github.com" as the group title.
  stripTld: false,
  // Collapse a newly created group (Chrome keeps the active tab's group open).
  collapseNew: false,
  excludedText: '',
};

export async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return {
    ...stored,
    minTabs: Math.max(1, Number(stored.minTabs) || DEFAULTS.minTabs),
    excluded: parseExcluded(stored.excludedText),
  };
}
