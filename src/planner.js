// Decides how the tabs in one window should be grouped. Pure: it takes a
// snapshot of the window and the extension's memory, and returns what to change.
// background.js applies the result through the chrome.tabs / chrome.tabGroups APIs.

import { groupKeyFor, labelFor, colorFor } from './domain.js';

const NO_GROUP = -1;

/**
 * @param {object} input
 * @param {Array<{id:number,url?:string,pendingUrl?:string,pinned:boolean,groupId:number}>} input.tabs
 * @param {Array<{id:number,title?:string}>} input.groups   tab groups in this window
 * @param {object} input.state  { managed: {groupId: key}, assigned: {tabId: groupId},
 *                                detached: {tabId: key} } from the previous pass
 * @param {object} input.settings
 * @returns {{ ungroup: number[], moves: Array<{key:string,title:string,color:string,
 *            groupId:number|null,tabIds:number[]}>, retitle: Array<{groupId:number,title:string}>,
 *            state: object }}
 */
export function planWindow({ tabs, groups, state, settings }) {
  const keyOpts = { mode: settings.mode, excluded: settings.excluded };
  const labelOpts = { stripTld: settings.stripTld };
  const tabKey = new Map(tabs.map((t) => [t.id, groupKeyFor(t.url || t.pendingUrl, keyOpts)]));

  // Groups we created earlier.
  const managed = {};
  for (const g of groups) {
    if (state.managed[g.id] !== undefined) managed[g.id] = state.managed[g.id];
  }

  // Groups we created before a browser restart come back with new ids. Adopt a
  // group again when its title is a domain label and every tab in it is on that domain.
  for (const g of groups) {
    if (managed[g.id] !== undefined || !g.title) continue;
    const members = tabs.filter((t) => t.groupId === g.id);
    const keys = new Set(members.map((t) => tabKey.get(t.id)));
    if (keys.size !== 1) continue;
    const [key] = keys;
    if (key && labelFor(key, labelOpts) === g.title) managed[g.id] = key;
  }

  // We are the only ones who change groups between passes, so a tab that is no
  // longer where we put it was moved by the user. Leave it alone until it
  // navigates to a different domain.
  const detached = {};
  for (const t of tabs) {
    const key = tabKey.get(t.id);
    const before = state.detached[t.id];
    if (before !== undefined && before === key) {
      detached[t.id] = key;
      continue;
    }
    const wasAssigned = state.assigned[t.id];
    if (wasAssigned !== undefined && wasAssigned !== t.groupId && state.assignedKey?.[t.id] === key) {
      detached[t.id] = key;
    }
  }

  // Bucket the tabs we are allowed to touch by domain.
  const buckets = new Map();
  const ungroup = [];
  for (const t of tabs) {
    const inManaged = t.groupId !== NO_GROUP && managed[t.groupId] !== undefined;
    const inUserGroup = t.groupId !== NO_GROUP && !inManaged;
    if (t.pinned || inUserGroup || detached[t.id] !== undefined) continue;
    const key = tabKey.get(t.id);
    if (!key) {
      if (inManaged) ungroup.push(t.id);
      continue;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  const moves = [];
  const retitle = [];
  for (const [key, members] of buckets) {
    const title = labelFor(key, labelOpts);
    // Too few tabs for a group: release any that are still in one of ours.
    if (members.length < settings.minTabs) {
      for (const t of members) if (t.groupId !== NO_GROUP) ungroup.push(t.id);
      continue;
    }
    // Prefer the managed group that already holds the most tabs of this domain.
    const counts = new Map();
    for (const t of members) {
      if (managed[t.groupId] === key) counts.set(t.groupId, (counts.get(t.groupId) || 0) + 1);
    }
    let groupId = null;
    let best = 0;
    for (const [id, n] of counts) if (n > best) [groupId, best] = [id, n];
    if (groupId === null) {
      const empty = Object.keys(managed).map(Number).find((id) => managed[id] === key);
      if (empty !== undefined) groupId = empty;
    }
    const toMove = members.filter((t) => t.groupId !== groupId).map((t) => t.id);
    if (toMove.length) moves.push({ key, title, color: colorFor(key), groupId, tabIds: toMove });
    if (groupId !== null) {
      const g = groups.find((x) => x.id === groupId);
      if (g && g.title !== title) retitle.push({ groupId, title });
    }
  }

  return { ungroup, moves, retitle, managed, detached };
}

/**
 * Where each tab ends up after the plan is applied, so the next pass can tell
 * our moves apart from the user's.
 */
export function expectedAssignment({ tabs, plan, newGroupIds, settings }) {
  const keyOpts = { mode: settings.mode, excluded: settings.excluded };
  const assigned = {};
  const assignedKey = {};
  const ungrouped = new Set(plan.ungroup);
  const moved = new Map();
  plan.moves.forEach((m, i) => {
    const gid = m.groupId ?? newGroupIds[i];
    for (const id of m.tabIds) moved.set(id, gid);
  });
  for (const t of tabs) {
    let gid = t.groupId;
    if (ungrouped.has(t.id)) gid = NO_GROUP;
    if (moved.has(t.id)) gid = moved.get(t.id);
    assigned[t.id] = gid;
    assignedKey[t.id] = groupKeyFor(t.url || t.pendingUrl, keyOpts);
  }
  return { assigned, assignedKey };
}
