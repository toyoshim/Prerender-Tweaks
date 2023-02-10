// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings } from "./settings.js"
import { StatusManager } from "./status_manager.js"
import { Metrics } from "./metrics.js"
import { NavigationTracker } from "./navigation_tracker.js"
import { getChromiumVersion } from "./utils.js"

let synchedSettings = null;
let lastPrediction = {};

const chromiumVersion = getChromiumVersion();
const menuId = 'prerenderLink';
const settings = new Settings(chromiumVersion);
const status = new StatusManager();
const metrics = new Metrics();
const tracker = new NavigationTracker();

function checkPrerenderStatus(options) {
  chrome.tabs.sendMessage(options.tabId, { command: 'queryStatus' }, { frameId: 0 }, contentStatus => {
    status.update(options.tabId, contentStatus);
  });
}

function handleContentSwitch(options) {
  // update context menu rule.
  if (options || !options.url || !options.url.startsWith('http')) {
    chrome.contextMenus.update(menuId, {});
    return;
  }
  const url = new URL(options.url);
  const portString = url.port ? (':' + url.port) : '';
  const sameOriginPattern = url.protocol + '//' + url.host + portString + '/*';
  chrome.contextMenus.update(menuId, { targetUrlPatterns: [sameOriginPattern] });
}

// Hooks
async function registerHooks() {
  synchedSettings = await settings.getSettings();

  // Tab switch.
  chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
      if (tab.url.startsWith('http')) {
        checkPrerenderStatus({ reason: 'onActivated', tabId: activeInfo.tabId, windowId: activeInfo.windowId });
      }
      handleContentSwitch({ reason: 'onActivated', url: tab.url });
    });
  });

  // Page load completion.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
      handleContentSwitch({ reason: 'onUpdated.loading', url: changeInfo.url });
    } else if (changeInfo.status === 'complete') {
      if (tab.url && tab.url.startsWith('http')) {
        if (tabId == lastPrediction.tab) {
          chrome.tabs.sendMessage(tabId, { command: 'insertRule', url: lastPrediction.to }, { frameId: 0 });
        }
        checkPrerenderStatus({ reason: 'onUpdated.complete', tabId: tabId, windowId: tab.windowId });
      } else {
        status.update(tab.id, { unsupportedPage: true });
      }
    }
  });

  // Request from content script.
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'update') {
      status.update(sender.tab.id, message.status);
    } else if (message.message === 'settings') {
      sendResponse(synchedSettings);
    } else if (message.message === 'metrics') {
      if (await settings.get('recordMetrics')) {
        metrics.reportEffectiveLcp(
            message.origin,
            message.prerendered,
            message.effectiveLargestContentfulPaint);
      }
    } else if (message.message == 'clearAllMetrics')  {
      metrics.clearAll();
    } else if (message.message == 'clearOriginMetrics')  {
      chrome.tabs.query({ active: true, lastFocusedWindow: true}, tab => {
        const url = new URL(tab[0].url);
        metrics.clearFor(url.origin);
      });
    } else if (message.message == 'debug')  {
      metrics.dumpToLog();
    }
  });

  // Dispatch tracking prediction events.
  tracker.observe(e => {
    console.log(e);
    if (e.event == 'predict') {
      lastPrediction = e;
    }
  });

  // Context menus.
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: menuId,
    contexts: ['link'],
    title: 'Prerender this link'
  });
  chrome.contextMenus.onClicked.addListener(
    (info, tab) => {
      if (info.menuItemId == menuId) {
        chrome.tabs.sendMessage(tab.id, { command: 'insertRule', url: info.linkUrl }, { frameId: 0 });
      }
    });
}

if (chromiumVersion >= 110) {
  registerHooks();
}