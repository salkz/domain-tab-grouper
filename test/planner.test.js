import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDomain, groupKeyFor, labelFor, parseExcluded } from '../src/domain.js';
import { planWindow, expectedAssignment } from '../src/planner.js';

const settings = { mode: 'base', minTabs: 2, stripTld: false, excluded: [] };
const empty = () => ({ managed: {}, assigned: {}, assignedKey: {}, detached: {} });
const tab = (id, url, groupId = -1, extra = {}) => ({ id, url, groupId, pinned: false, ...extra });

test('base domain handles subdomains and multi-part suffixes', () => {
  assert.equal(baseDomain('mail.google.com'), 'google.com');
  assert.equal(baseDomain('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(baseDomain('me.github.io'), 'me.github.io');
  assert.equal(baseDomain('192.168.1.10'), '192.168.1.10');
  assert.equal(baseDomain('localhost'), 'localhost');
});

test('group keys skip non-web pages and honour mode and exclusions', () => {
  assert.equal(groupKeyFor('chrome://newtab/'), null);
  assert.equal(groupKeyFor('file:///tmp/a.html'), null);
  assert.equal(groupKeyFor('https://docs.google.com/x', { mode: 'host' }), 'docs.google.com');
  assert.equal(groupKeyFor('https://www.github.com/', { mode: 'host' }), 'github.com');
  assert.equal(groupKeyFor('https://mail.google.com/', { excluded: ['mail.google.com'] }), null);
  assert.equal(groupKeyFor('https://docs.google.com/', { excluded: ['mail.google.com'] }), 'google.com');
  assert.equal(groupKeyFor('https://a.b.example.com/', { excluded: ['example.com'] }), null);
});

test('labels and exclusion parsing', () => {
  assert.equal(labelFor('github.com', { stripTld: true }), 'github');
  assert.equal(labelFor('bbc.co.uk', { stripTld: true }), 'bbc');
  assert.deepEqual(parseExcluded(' https://Foo.com/path, *.bar.org\nlocalhost'), ['foo.com', 'bar.org', 'localhost']);
});

test('a lone tab is not grouped; a second tab on the same site creates a group', () => {
  let plan = planWindow({ tabs: [tab(1, 'https://github.com/a')], groups: [], state: empty(), settings });
  assert.deepEqual(plan.moves, []);

  plan = planWindow({
    tabs: [tab(1, 'https://github.com/a'), tab(2, 'https://gist.github.com/b'), tab(3, 'https://example.org')],
    groups: [],
    state: empty(),
    settings,
  });
  assert.equal(plan.moves.length, 1);
  assert.deepEqual(plan.moves[0].tabIds, [1, 2]);
  assert.equal(plan.moves[0].groupId, null);
  assert.equal(plan.moves[0].title, 'github.com');
});

test('new tab joins the existing managed group', () => {
  const state = { ...empty(), managed: { 10: 'github.com' } };
  const plan = planWindow({
    tabs: [tab(1, 'https://github.com/a', 10), tab(2, 'https://github.com/b', 10), tab(3, 'https://github.com/c')],
    groups: [{ id: 10, title: 'github.com' }],
    state,
    settings,
  });
  assert.deepEqual(plan.moves, [{ key: 'github.com', title: 'github.com', color: plan.moves[0].color, groupId: 10, tabIds: [3] }]);
});

test('a tab that navigates away leaves the group, and a group of one is dissolved', () => {
  const state = { ...empty(), managed: { 10: 'github.com' } };
  const plan = planWindow({
    tabs: [tab(1, 'https://github.com/a', 10), tab(2, 'https://example.org', 10)],
    groups: [{ id: 10, title: 'github.com' }],
    state,
    settings,
  });
  assert.deepEqual(plan.ungroup.sort(), [1, 2]);
  assert.deepEqual(plan.moves, []);
});

test('groups the user made, pinned tabs and excluded sites are left alone', () => {
  const plan = planWindow({
    tabs: [
      tab(1, 'https://github.com/a', 20),
      tab(2, 'https://github.com/b', 20),
      tab(3, 'https://github.com/c', -1, { pinned: true }),
      tab(4, 'https://github.com/d'),
    ],
    groups: [{ id: 20, title: 'Work' }],
    state: empty(),
    settings,
  });
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.ungroup, []);
});

test('a tab the user dragged out of a group stays out until it changes site', () => {
  const tabs = [tab(1, 'https://github.com/a', 10), tab(2, 'https://github.com/b', 10), tab(3, 'https://github.com/c', 10)];
  const groups = [{ id: 10, title: 'github.com' }];
  const first = planWindow({ tabs, groups, state: { ...empty(), managed: { 10: 'github.com' } }, settings });
  const memo = expectedAssignment({ tabs, plan: first, newGroupIds: [], settings });
  const state = { managed: first.managed, detached: first.detached, ...memo };

  // User drags tab 3 out.
  const dragged = [tabs[0], tabs[1], tab(3, 'https://github.com/c')];
  const second = planWindow({ tabs: dragged, groups, state, settings });
  assert.deepEqual(second.moves, []);
  assert.equal(second.detached[3], 'github.com');

  // Later it navigates somewhere else and back: it is fair game again.
  const memo2 = expectedAssignment({ tabs: dragged, plan: second, newGroupIds: [], settings });
  const state2 = { managed: second.managed, detached: second.detached, ...memo2 };
  const third = planWindow({ tabs: [tabs[0], tabs[1], tab(3, 'https://example.org')], groups, state: state2, settings });
  assert.equal(third.detached[3], undefined);
});

test('groups from a previous session are adopted by title', () => {
  const plan = planWindow({
    tabs: [tab(1, 'https://github.com/a', 77), tab(2, 'https://github.com/b', 77), tab(3, 'https://github.com/c')],
    groups: [{ id: 77, title: 'github.com' }],
    state: empty(),
    settings,
  });
  assert.equal(plan.managed[77], 'github.com');
  assert.deepEqual(plan.moves[0].tabIds, [3]);
  assert.equal(plan.moves[0].groupId, 77);
});
