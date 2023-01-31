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

// Make the activated status up to date.
if (document.prerendering) {
  document.addEventListener('prerenderingchange', () => {
    prerenderStatus.activated = true;
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
  if (!queried || (prerenderStatus.prerendered && !prerenderStatus.activated))
    return;
  chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
}

function scanContent() {
  checkSpecrules();
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
    return;
  }
  const rule = document.createElement('script');
  rule.type = 'speculationrules';
  rule.innerText = '{ "prerender": [ ' + rules.join(',') + ' ] }';
  document.head.appendChild(rule);
  prerenderStatus.hasInjectedSpecrules = true;
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
    const href = new URL(a.href, document.baseURI);
    if (href.origin !== document.location.origin)
      continue;
    if (href.href.startsWith(document.location.href)) {
      const urlLen = document.location.href.length;
      if (href.href.length == urlLen)
        continue;
      if (href.href[urlLen] == '#' || href.href[urlLen] == '?')
        continue;
    }
    if (urls.indexOf(href.href) >= 0) {
      // Same link is already in the list.
      continue;
    }
    urls.push(href.href);
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
} else {
  window.addEventListener('load', e => {
    scanContent();
    tryInjectingSpecrules();
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