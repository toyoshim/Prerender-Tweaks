// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Holds prerender related page status.
let prerenderStatus = {
  prerendered: document.prerendering,
  url: location.href,
  activated: false,
  hasSpecrules: false,
  hasInjectedSpecrules: false,
  restoredFromBFCache: false,

  // for debug.
  readyStateOnStart: document.readyState,
};
let queried = false;
let settings = chrome.runtime.sendMessage(undefined, { message: 'settings' });
let prerenderedUrls = [];
let candidateUrls = {};

// Make the activated status up to date.
if (document.prerendering) {
  document.addEventListener('prerenderingchange', () => {
    prerenderStatus.prerendered = true;
    prerenderStatus.activated = true;
    chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
  });
}

// Make the restoredFromBFCache status up to date.
window.addEventListener('pageshow', e => {
  if (prerenderStatus.restoredFromBFCache || !e.persisted)
    return;
  prerenderStatus.restoredFromBFCache = true;
  chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
});

// Obtains Extensions settings delivered at the script start time.
async function getRemoteSetting(key) {
  return (await settings)[key];
}

// Check if the link that is potentially relative URL can be prerendered.
function isPrerenderableLink(href) {
  const url = new URL(href, document.baseURI);

  // Already prerendered.
  if (prerenderedUrls.indexOf(url.href) >= 0) {
    return false;
  }

  // Same-origin check.
  if (url.origin !== document.location.origin) {
    return false;
  }
  const baseUrl = document.location.href.substring(
      0, document.location.href.length - document.location.hash.length);
  if (url.href.startsWith(baseUrl)) {
    const urlLen = baseUrl.length;
    // Link to the current page.
    if (url.href.length == urlLen) {
      return false;
    }
    // Link to the segment or the current page with a query.
    if (url.href[urlLen] == '#' || url.href[urlLen] == '?') {
      return false;
    }
  }
  return true;
}

// Make the hasSpecrules status up to date, and notify the main.js on changes.
function checkSpecrules() {
  if (prerenderStatus.hasSpecrules)
    return;
  prerenderStatus.hasSpecrules = false;
  for (let script of document.getElementsByTagName('script')) {
    if (script.type != 'speculationrules')
      continue;
    prerenderStatus.hasSpecrules = true;
    break;
  }
  // Make sure that prerendering is actually not used.
  // Content script may overlook if activation happens before the inejction.
  if (performance.getEntriesByType('navigation')[0].activationStart > 0) {
    prerenderStatus.prerendered = true;
    prerenderStatus.activated = true;
  }
  if (!queried || (prerenderStatus.prerendered && !prerenderStatus.activated))
    return;
  chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
}

// Monitor anchor tags.
async function monitorAnchors() {
  if (!await getRemoteSetting('anchorHoverInjection')) {
    return;
  }
  const monitorMarkName = 'prerender-tweaks-monitoring';
  for (let anchor of document.getElementsByTagName('a')) {
    if (anchor.hasAttribute(monitorMarkName)) {
      continue;
    }
    anchor.setAttribute(monitorMarkName, 'yes');
    if (!isPrerenderableLink(anchor.href)) {
      continue;
    }
    anchor.addEventListener('mouseenter', e => {
      if (candidateUrls[e.target.href]) {
        return;
      }
      candidateUrls[e.target.href] = true;
      setTimeout(() => {
        if (candidateUrls[e.target.href]) {
          const url = new URL(e.target.href, document.baseURI);
          injectSpecrules([url.href]);
          // TODO: remove it after a certain time period.
        }
      }, 0);
    });
    anchor.addEventListener('mouseleave', e => {
      delete candidateUrls[e.target.href];
    });
  }
}

function scanContent() {
  checkSpecrules();
  monitorAnchors();
}

function reportMetrics() {
  const observer = new PerformanceObserver(list=> {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    // Follow up the case activation happens before the script injection.
    prerenderStatus.prerendered = navigationEntry.activationStart > 0;
    prerenderStatus.activated = navigationEntry.activationStart > 0;

    // send metrics to the background Extension service.
    chrome.runtime.sendMessage(undefined, {
       message: 'metrics',
       prerendered: prerenderStatus.prerendered,
       restoredFromBFCache: prerenderStatus.restoredFromBFCache,
       activationStart: navigationEntry.activationStart,
       largestContentfulPaint: lastEntry.startTime,
       effectiveLargestContentfulPaint: lastEntry.startTime - navigationEntry.activationStart,
       url: document.location.href,
       origin: document.location.origin
     });
  });
  observer.observe({ type: 'largest-contentful-paint', buffered: true });
}

// Inject speculationrules for specified URLs.
async function injectSpecrules(urls) {
  console.log('injecting speculationrules:');
  let rules = [];
  for (let url of urls) {
    // Ignore if the url is already in the prerendered page list.
    if (prerenderedUrls.indexOf(url) >= 0) {
      continue;
    }
    prerenderedUrls.push(url);
    rules.push(`{ "source": "list", "urls": [ "${url}" ] }`);
    console.log(' * ' + url);
  }
  if (rules.length == 0) {
    return null;
  }
  const rule = document.createElement('script');
  rule.type = 'speculationrules';
  rule.innerText = '{ "prerender": [ ' + rules.join(',') + ' ] }';
  document.head.appendChild(rule);
  prerenderStatus.hasInjectedSpecrules = true;
  return rule;
}

// Inject a speculationrules for the first N anchor tag on the load completion.
async function tryInjectingSpecrules() {
  if (prerenderStatus.hasSpecrules || prerenderStatus.hasInjectedSpecrules)
    return;

  if (!await getRemoteSetting('autoInjection')) {
    return;
  }

  let urls = [];
  const maxRules = await getRemoteSetting('maxRulesByAnchors');
  for (let a of document.getElementsByTagName('a')) {
    if (!isPrerenderableLink(a.href)) {
      continue;
    }
    const url = new URL(a.href, document.baseURI);
    urls.push(url.href);
    if (urls.length == maxRules) {
      break;
    }
  }
  if (urls.length == 0)
    return;
  injectSpecrules(urls);
}

// Content checks on load, and DOM modifications.
let mutationChecking = false;
const mutationObserver = new MutationObserver(o => {
  if (mutationChecking)
    return;
  mutationChecking = true;
  setTimeout(e => {
    mutationChecking = false;
    scanContent();
  }, 100);
});
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', e => {
    scanContent();
    mutationObserver.observe(document, { childList: true, subtree: true });
  });
} else {
  scanContent();
  mutationObserver.observe(document, { childList: true, subtree: true });
}

// Auto injection on page load completion.
if (document.readyState === 'complete') {
  tryInjectingSpecrules();
  reportMetrics();
} else {
  window.addEventListener('load', e => {
    scanContent();
    tryInjectingSpecrules();
    reportMetrics();
  });
}

// Communication with the main.js running in the background service worker.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'queryStatus') {
    queried = true;
    sendResponse(prerenderStatus);
  } else if (message.command === 'insertRule') {
    injectSpecrules([message.url]);
  }
});