let currentStatus = null;

function updateStatus(tabId, status) {
  currentStatus = status;
  if (!status)
    return;
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
  chrome.tabs.sendMessage(options.tabId, { command: 'queryStatus' }, { frameId: 0 }, status => {
    updateStatus(options.tabId, status);
  });
}

function handleContentSwitch(options) {
  // update context menu rule.
  const url = new URL(options.url);
  const portString = url.port ? (':' + url.port) : '';
  const sameOriginPattern = url.protocol + '//' + url.host + portString + '/*';
  chrome.contextMenus.update('link', { targetUrlPatterns: [sameOriginPattern] });
}

// Hooks
chrome.tabs.onActivated.addListener(activeInfo => {
  checkPrerenderStatus({ reason: 'onActivated', tabId: activeInfo.tabId, windowId: activeInfo.windowId });
  chrome.tabs.get(activeInfo.tabId, tab => {
    handleContentSwitch({ reason: 'onActivated', url: tab.url });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    handleContentSwitch({ reason: 'onUpdated.loading', url: changeInfo.url });
  } else if (changeInfo.status === 'complete') {
    checkPrerenderStatus({ reason: 'onUpdated.complete', tabId: tabId, windowId: tab.windowId });
  }
});
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.message === 'update')
    updateStatus(sender.tab.id, message.status);
});

// Context menus.
chrome.contextMenus.create({
  id: 'link',
  contexts: ['link'],
  title: 'Prerender this link'
});
chrome.contextMenus.onClicked.addListener(
  (info, tab) => {
    chrome.tabs.sendMessage(tab.id, { command: 'insertRule', url: info.linkUrl }, { frameId: 0 });
  });