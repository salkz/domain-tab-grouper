// Pure helpers for turning a tab URL into a group key. No chrome.* calls here,
// so the logic can be unit-tested with plain Node.

// Second-level suffixes under which the registrable domain has three labels
// (bbc.co.uk, not co.uk). Not the full Public Suffix List, but it covers the
// suffixes most people meet day to day.
const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'me.uk', 'net.uk', 'nhs.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.kr', 'or.kr', 'go.kr', 'ac.kr',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.hk', 'org.hk', 'com.tw', 'org.tw', 'com.sg', 'edu.sg', 'gov.sg',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
  'co.za', 'org.za', 'gov.za', 'ac.za',
  'com.mx', 'org.mx', 'gob.mx', 'com.ar', 'gob.ar', 'com.tr', 'gov.tr',
  'co.il', 'org.il', 'ac.il', 'co.id', 'or.id', 'go.id', 'ac.id',
  'com.my', 'com.ph', 'com.vn', 'com.ua', 'com.pl', 'com.es', 'com.pt',
  // Shared hosting platforms where each subdomain is a different owner.
  'github.io', 'gitlab.io', 'pages.dev', 'vercel.app', 'netlify.app',
  'herokuapp.com', 'web.app', 'firebaseapp.com', 'blogspot.com',
  'azurewebsites.net', 'cloudfront.net', 'appspot.com', 'workers.dev',
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Returns the hostname of a groupable http(s) URL, or null. */
export function hostnameOf(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return host || null;
}

/** example.co.uk for www.news.example.co.uk; IPs and single labels unchanged. */
export function baseDomain(host) {
  if (IPV4.test(host) || host.startsWith('[') || !host.includes('.')) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  const take = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/**
 * The key tabs are grouped under, or null when the tab should not be grouped.
 * mode: 'base' groups mail.google.com with docs.google.com; 'host' keeps them apart.
 */
export function groupKeyFor(url, { mode = 'base', excluded = [] } = {}) {
  const host = hostnameOf(url);
  if (!host) return null;
  const key = mode === 'host' ? host.replace(/^www\./, '') : baseDomain(host);
  if (excluded.some((d) => key === d || host === d || host.endsWith('.' + d))) return null;
  return key;
}

/** Turns "github.com" into "github" for the group label when asked to. */
export function labelFor(key, { stripTld = false } = {}) {
  if (!stripTld || IPV4.test(key) || !key.includes('.')) return key;
  const labels = key.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const suffixLabels = MULTI_PART_SUFFIXES.has(lastTwo) && labels.length > 2 ? 2 : 1;
  return labels.slice(0, -suffixLabels).join('.');
}

export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

/** The same domain always gets the same colour. */
export function colorFor(key) {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

/** Normalises the user's excluded-domains text box into a list. */
export function parseExcluded(text) {
  return (text || '')
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^\*\./, '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}
