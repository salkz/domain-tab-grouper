// Runs background.js against an in-memory fake of the chrome.* APIs it uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const on = (name) => ({ addListener: (fn) => ((listeners[name] ||= []).push(fn)) });
let tabs = [];
let groups = [];
let nextGroup = 100;
const store = { sync: {}, session: {} };
const area = (name) => ({
  get: async (keys) => {
    if (typeof keys === 'string') return { [keys]: store[name][keys] };
    return { ...keys, ...store[name] };
  },
  set: async (obj) => Object.assign(store[name], obj),
  remove: async (k) => delete store[name][k],
});
const pruneGroups = () => (groups = groups.filter((g) => tabs.some((t) => t.groupId === g.id)));

globalThis.chrome = {
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
    query: async ({ windowId }) => groups.filter((g) => g.windowId === windowId),
    update: async (id, props) => Object.assign(groups.find((g) => g.id === id), props),
  },
  windows: {
    WINDOW_ID_NONE: -1,
    get: async (id) => ({ id, type: 'normal' }),
    getAll: async () => [{ id: 1, type: 'normal' }],
    onRemoved: on('winRemoved'),
  },
  tabs: {
    query: async ({ windowId }) => tabs.filter((t) => t.windowId === windowId),
    group: async ({ tabIds, groupId, createProperties }) => {
      if (groupId === undefined) {
        groupId = nextGroup++;
        groups.push({ id: groupId, windowId: createProperties.windowId, title: '' });
      }
      for (const t of tabs) if (tabIds.includes(t.id)) t.groupId = groupId;
      pruneGroups();
      return groupId;
    },
    ungroup: async (ids) => {
      for (const t of tabs) if (ids.includes(t.id)) t.groupId = -1;
      pruneGroups();
    },
    onCreated: on('created'), onUpdated: on('updated'), onRemoved: on('removed'),
    onAttached: on('attached'), onDetached: on('detached'),
  },
  storage: { sync: area('sync'), session: area('session'), onChanged: on('storage') },
  runtime: { onInstalled: on('installed'), onStartup: on('startup'), onMessage: on('message') },
};

const settle = () => new Promise((r) => setTimeout(r, 400));
const open = (id, url) => {
  const t = { id, url, windowId: 1, groupId: -1, pinned: false, active: false };
  tabs.push(t);
  listeners.created.forEach((fn) => fn(t));
};
const navigate = (id, url) => {
  const t = tabs.find((x) => x.id === id);
  t.url = url;
  listeners.updated.forEach((fn) => fn(id, { url }, t));
};

await import('../src/background.js');

test('end to end: groups form, grow, and dissolve as tabs move between sites', async () => {
  open(1, 'https://github.com/a');
  open(2, 'https://news.ycombinator.com');
  await settle();
  assert.equal(groups.length, 0);

  open(3, 'https://github.com/b');
  await settle();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'github.com');
  assert.deepEqual(tabs.filter((t) => t.groupId === groups[0].id).map((t) => t.id), [1, 3]);

  open(4, 'https://gist.github.com/x');
  await settle();
  assert.equal(tabs.find((t) => t.id === 4).groupId, groups[0].id);

  // User drags tab 4 out; it must stay out.
  tabs.find((t) => t.id === 4).groupId = -1;
  open(5, 'https://example.org');
  await settle();
  assert.equal(tabs.find((t) => t.id === 4).groupId, -1);

  navigate(3, 'https://example.org/2');
  await settle();
  const titles = groups.map((g) => g.title).sort();
  assert.deepEqual(titles, ['example.org']);
  assert.equal(tabs.find((t) => t.id === 1).groupId, -1);
});
