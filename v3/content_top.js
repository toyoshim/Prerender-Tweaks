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

// Make the activated status up to date.
if (document.prerendering) {
  document.addEventListener('prerenderingchange', () => {
    prerenderStatus.activated = true;
  });
}

async function getRemoteSetting(key) {
  // TODO
  return true;
}

// Make the hasSpecrules status up to date, and notify the main.js on changes.
function checkSpecrules(notify) {
  if (prerenderStatus.hasSpecrules)
    return;
  prerenderStatus.hasSpecrules = false;
  for (let script of document.getElementsByTagName('script')) {
    if (script.type != 'speculationrules')
      continue;
    prerenderStatus.hasSpecrules = true;
    break;
  }
  if (!notify || !queried || (prerenderStatus.prerendered && !prerenderStatus.activated))
    return;
  chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
}
let mutationChecking = false;
const mutationObserver = new MutationObserver(o => {
  if (mutationChecking)
    return;
  mutationChecking = true;
  setTimeout(e => {
    mutationChecking = false;
    checkSpecrules(true);
  }, 100);
});
checkSpecrules(true);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', e => {
    checkSpecrules(true);
    mutationObserver.observe(document, { childList: true, subtree: true });
  });
} else {
  mutationObserver.observe(document, { childList: true, subtree: true });
}

// Make the restoredFromBFCache status up to date.
window.addEventListener('pageshow', e => {
  if (prerenderStatus.restoredFromBFCache || !e.persisted)
    return;
  prerenderStatus.restoredFromBFCache = true;
  chrome.runtime.sendMessage(undefined, { message: 'update', status: prerenderStatus });
});

async function injectSpecrules(url) {
  if (!await getRemoteSetting('autoInjection')) {
    return;
  }
  const rule = document.createElement('script');
  rule.type = 'speculationrules';
  rule.innerText = `{ "prerender": [ { "source": "list", "urls": [ "${url}" ] } ] }`;
  document.head.appendChild(rule);
  console.log('injecting speculationrules for ' + url);

  prerenderStatus.hasInjectedSpecrules = true;
}

// Inject a speculationrules for the first anchor tag on the load completion.
function tryInjectingSpecrules() {
  if (prerenderStatus.hasSpecrules || prerenderStatus.hasInjectedSpecrules)
    return;

  let url = undefined;
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
    url = href.href;
    break;
  }
  if (!url)
    return;
  injectSpecrules(url);
}
if (document.readyState === 'complete') {
  tryInjectingSpecrules();
}
window.addEventListener('load', e => {
  checkSpecrules(false);
  tryInjectingSpecrules();
});

// Communication with the main.js running in the background service worker.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'queryStatus') {
    queried = true;
    sendResponse(prerenderStatus);
  } else if (message.command === 'insertRule') {
    injectSpecrules(message.url);
  }
});
