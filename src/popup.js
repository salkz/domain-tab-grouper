import { DEFAULTS } from './settings.js';

const fields = ['enabled', 'mode', 'minTabs', 'stripTld', 'collapseNew', 'excludedText'];
const el = Object.fromEntries(fields.map((f) => [f, document.getElementById(f)]));

function read(f) {
  const input = el[f];
  if (input.type === 'checkbox') return input.checked;
  if (input.type === 'number') return Math.max(1, Number(input.value) || DEFAULTS.minTabs);
  return input.value;
}

function write(f, value) {
  if (el[f].type === 'checkbox') el[f].checked = value;
  else el[f].value = value;
}

const stored = await chrome.storage.sync.get(DEFAULTS);
for (const f of fields) write(f, stored[f]);

for (const f of fields) {
  // The textarea saves when it loses focus so every keystroke doesn't regroup.
  const event = f === 'excludedText' ? 'change' : 'input';
  el[f].addEventListener(event, () => chrome.storage.sync.set({ [f]: read(f) }));
}

document.getElementById('regroup').addEventListener('click', async () => {
  await chrome.storage.sync.set({ enabled: true });
  write('enabled', true);
  await chrome.runtime.sendMessage({ type: 'regroup-all' });
});

document.getElementById('ungroup').addEventListener('click', async () => {
  write('enabled', false);
  await chrome.runtime.sendMessage({ type: 'ungroup-all' });
});
