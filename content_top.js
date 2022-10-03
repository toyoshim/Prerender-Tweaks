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

// Inject a speculationrules for the first anchor tag on the load completion.
function injectSpecrules() {
  if (prerenderStatus.hasSpecrules || prerenderStatus.hasInjectedSpecrules)
    return;

  let url = undefined;
  for (let a of document.getElementsByTagName('a')) {
    const href = new URL(a.href, document.baseURI);
    if (href.origin != document.location.origin)
      continue;
    url = href.href;
  }
  console.log('injectSpecrules url', url);
  if (!url)
    return;
  const rule = document.createElement('script');
  rule.type = 'speculationrules';
  rule.textContent = `{
  "prerender": [
    {
     "source": "list",
     "urls": ["${url}"]
    }
  ]
}`;
  document.head.appendChild(rule);
  prerenderStatus.hasInjectedSpecrules = true;
}
if (document.readyState === 'complete') {
  injectSpecrules();
}
window.addEventListener('load', e => {
  checkSpecrules(false);
  injectSpecrules();
});

// Communication with the main.js running in the background service worker.
chrome.runtime.onMessage.addListener((message, snder, sendResponse) => {
  if (message === 'queryStatus') {
    queried = true;
    sendResponse(prerenderStatus);
  }
});