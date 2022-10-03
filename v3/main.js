let currentStatus = null;

function updateStatus(tabId, status) {
  currentStatus = status;
  if (!status)
    return;
  console.log(status);
  let text = '|';
  let color = undefined;
  let title = 'Prerender Tweaks';
  if (status.restoredFromBFCache) {
    text += '$|';
    color = '#f0f';
    title += '\nRestored from BFCache';
  } else {
    if (status.prerendered) {
      text += 'P|';
      color = '#00f';
      title += '\nPrerendered';
    }
    if (status.hasInjectedSpecrules) {
      text += 'I|';
      if (!color)
        color = '#ff0';
      title += '\nPage contains tweaked speculationrules';
    } else if (status.hasSpecrules) {
      text += 'S|';
      color = '#0f0';
      title += '\nPage contains speculationrules';
    }
  }
  if (text === '|')
    text = '';
  chrome.action.setBadgeText({ tabId: tabId, text: text });
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  chrome.action.setTitle({ tabId: tabId, title: title });
}

function checkPrerenderStatus(options) {
  chrome.tabs.sendMessage(options.tabId, 'queryStatus', { frameId: 0 }, status => {
    updateStatus(options.tabId, status);
  });
}

// Hooks
chrome.tabs.onActivated.addListener(obj => {
  checkPrerenderStatus({ reason: 'onActivated', tabId: obj.tabId, windowId: obj.windowId });
});

chrome.tabs.onUpdated.addListener((id, obj, tab) => {
  if (obj.status === 'complete') {
    checkPrerenderStatus({ reason: 'onUpdated.complete', tabId: tab.id, windowId: tab.windowId });
  }
});
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.message === 'update')
    updateStatus(sender.tab.id, message.status);
});