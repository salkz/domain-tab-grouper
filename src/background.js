import { loadSettings } from './settings.js';
import { planWindow, expectedAssignment } from './planner.js';

const NO_GROUP = chrome.tabGroups.TAB_GROUP_ID_NONE;
const DEBOUNCE_MS = 250;
const RETRY_MS = 500;

// --- per-window memory, kept in session storage so it survives the service
// worker being stopped, and is cleared when the browser restarts.

const emptyState = () => ({ managed: {}, assigned: {}, assignedKey: {}, detached: {} });

async function loadState(windowId) {
  const k = `w${windowId}`;
  const { [k]: s } = await chrome.storage.session.get(k);
  return { ...emptyState(), ...s };
}

async function saveState(windowId, state) {
  await chrome.storage.session.set({ [`w${windowId}`]: state });
}

// --- scheduling: events arrive in bursts, so each window is regrouped once
// after things settle, and passes never overlap.

const timers = new Map();
let queue = Promise.resolve();

function schedule(windowId, delay = DEBOUNCE_MS) {
  if (windowId === undefined || windowId === chrome.windows.WINDOW_ID_NONE) return;
  clearTimeout(timers.get(windowId));
  timers.set(
    windowId,
    setTimeout(() => {
      timers.delete(windowId);
      queue = queue.then(() => regroupWindow(windowId)).catch((e) => console.warn('regroup failed', e));
    }, delay),
  );
}

async function scheduleAll() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  for (const w of windows) schedule(w.id, 0);
}

// --- the pass itself

async function regroupWindow(windowId) {
  const settings = await loadSettings();
  if (!settings.enabled) return;

  let tabs, groups;
  try {
    const win = await chrome.windows.get(windowId);
    if (win.type !== 'normal') return;
    [tabs, groups] = await Promise.all([chrome.tabs.query({ windowId }), chrome.tabGroups.query({ windowId })]);
  } catch {
    return; // window closed meanwhile
  }

  const state = await loadState(windowId);
  const plan = planWindow({ tabs, groups, state, settings });

  try {
    if (plan.ungroup.length) await chrome.tabs.ungroup(plan.ungroup);

    const newGroupIds = [];
    const activeTab = tabs.find((t) => t.active);
    for (const move of plan.moves) {
      if (move.groupId !== null) {
        await chrome.tabs.group({ groupId: move.groupId, tabIds: move.tabIds });
        newGroupIds.push(null);
        continue;
      }
      const groupId = await chrome.tabs.group({ tabIds: move.tabIds, createProperties: { windowId } });
      const collapsed = settings.collapseNew && !move.tabIds.includes(activeTab?.id);
      await chrome.tabGroups.update(groupId, { title: move.title, color: move.color, collapsed });
      plan.managed[groupId] = move.key;
      newGroupIds.push(groupId);
    }
    for (const r of plan.retitle) await chrome.tabGroups.update(r.groupId, { title: r.title });

    const { assigned, assignedKey } = expectedAssignment({ tabs, plan, newGroupIds, settings });
    await saveState(windowId, { managed: plan.managed, detached: plan.detached, assigned, assignedKey });
  } catch (e) {
    // Chrome refuses edits while the user is dragging a tab. Try again shortly;
    // the next pass starts from a fresh snapshot, so partial work is harmless.
    // Forget the old assignment so our partial moves are not mistaken for the user's.
    await saveState(windowId, { ...state, managed: { ...state.managed, ...plan.managed }, assigned: {}, assignedKey: {} });
    if (String(e?.message).includes('dragging')) schedule(windowId, RETRY_MS);
    else console.warn('regroup error', e);
  }
}

async function ungroupAll() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  for (const w of windows) {
    const state = await loadState(w.id);
    const tabs = await chrome.tabs.query({ windowId: w.id });
    const ids = tabs.filter((t) => state.managed[t.groupId] !== undefined).map((t) => t.id);
    if (ids.length) await chrome.tabs.ungroup(ids);
    await saveState(w.id, emptyState());
  }
}

// --- events

chrome.tabs.onCreated.addListener((tab) => schedule(tab.windowId));
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  // Group changes are either ours or the user's; both are picked up on the next
  // pass, and reacting to our own would loop.
  if (change.url !== undefined || change.pinned !== undefined) schedule(tab.windowId);
});
chrome.tabs.onRemoved.addListener((tabId, info) => {
  if (!info.isWindowClosing) schedule(info.windowId);
});
chrome.tabs.onAttached.addListener((tabId, info) => schedule(info.newWindowId));
chrome.tabs.onDetached.addListener((tabId, info) => schedule(info.oldWindowId));
chrome.windows.onRemoved.addListener((windowId) => chrome.storage.session.remove(`w${windowId}`));

chrome.runtime.onInstalled.addListener(scheduleAll);
chrome.runtime.onStartup.addListener(scheduleAll);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') scheduleAll();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'regroup-all') {
      // Also undo "the user moved this tab out" so everything gets sorted.
      const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
      for (const w of windows) {
        const s = await loadState(w.id);
        await saveState(w.id, { ...s, detached: {}, assigned: {}, assignedKey: {} });
      }
      await scheduleAll();
    } else if (msg?.type === 'ungroup-all') {
      await chrome.storage.sync.set({ enabled: false });
      queue = queue.then(ungroupAll);
      await queue;
    }
    sendResponse({ ok: true });
  })();
  return true;
});
