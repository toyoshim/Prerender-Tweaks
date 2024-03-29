// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { BlockedOrigins } from './blocked_origins.js'
import { ContextMenu } from './context_menu.js'
import { Settings } from './settings.js'
import { StatusManager } from './status_manager.js'
import { Metrics } from './metrics.js'
import { NavigationTracker } from './navigation_tracker.js'
import { NetRequest } from './net_request.js'
import { getChromiumVersion } from './utils.js'
import { getSite } from './third_party/psl.min.js'

let synchedSettings = null;
let lastPrediction = {};

const blockedOrigins = new BlockedOrigins();
const chromiumVersion = getChromiumVersion();
const contextMenu = new ContextMenu();
const settings = new Settings(chromiumVersion);
const status = new StatusManager();
const metrics = new Metrics();
const tracker = new NavigationTracker();
const netRequest = new NetRequest();

function checkPrerenderStatus(options) {
  chrome.tabs.sendMessage(options.tabId, { command: 'queryStatus' }, { frameId: 0 }, contentStatus => {
    status.update(options.tabId, contentStatus);
  });
}

// Hooks
async function registerHooks() {
  synchedSettings = await settings.getSettings();

  // Activate declarativeNetRequest rulesets to inject Supports-Loading-Mode: credentialed-prerender`
  // to permit cross-origin same-site prerendering.
  if (await settings.get('crossOriginSameSiteSupport')) {
    netRequest.enableLoadingMode();
  }

  // Tab switch.
  chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
      if (tab.url.startsWith('http')) {
        checkPrerenderStatus({ tabId: activeInfo.tabId, windowId: activeInfo.windowId });
      }
    });
  });

  // Page load completion.
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      if (tab.url && tab.url.startsWith('http')) {
        const url = new URL(tab.url);
        if (await settings.get('autoInjection') && !await blockedOrigins.isBlocked(url.origin)) {
          chrome.tabs.sendMessage(tabId, {
            command: 'insertRule',
            site: await settings.get('crossOriginSameSiteSupport') ? getSite(url.host) : undefined,
            to: (tabId == lastPrediction.tab) ? lastPrediction.to : {},
            limit: await settings.get('maxRulesByAnchors')
          }, { frameId: 0 });
        }
        checkPrerenderStatus({ tabId: tabId, windowId: tab.windowId });
      } else {
        status.update(tab.id, { unsupportedPage: true });
      }
    }
  });

  // Request from content script and popup page.
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message == 'update') {
      if (message.status.prerendered && message.status.effectiveLargestContentfulPaint > 0.0) {
        const score = await metrics.evaluateScore(
            message.origin,
            message.status.effectiveLargestContentfulPaint);
        if (score > 0.0) {
          message.status.score = score;
        }
      }
      status.update(sender.tab.id, message.status);
    } else if (message.message == 'settings') {
      sendResponse(synchedSettings);
    } else if (message.message == 'metrics') {
      if (await settings.get('recordMetrics')) {
        if (message.status.restoredFromBFCache) {
          return;
        }
        metrics.reportEffectiveLcp(
            message.origin,
            message.status.prerendered,
            message.status.effectiveLargestContentfulPaint);
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
    if (e.event == 'predict') {
      lastPrediction = e;
    }
  });

  // Context menus.
  contextMenu.register();
  contextMenu.observe((tab, url) => {
    chrome.tabs.sendMessage(tab, { command: 'insertRule', to: { url: url } }, { frameId: 0 });
  });
}

if (chromiumVersion >= 110) {
  registerHooks();
}