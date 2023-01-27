let currentStatus = null;

const menuId = 'prerenderLink';

function updateIcon(tabId, title, badgeText, badgeBgColor) {
  chrome.action.setTitle({ tabId: tabId, title: title });
  if (badgeText === undefined)
    badgeText = '';
  chrome.action.setBadgeText({ tabId: tabId, text: badgeText });
  if (badgeBgColor) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: badgeBgColor });
  }
}

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
  updateIcon(tabId, title, text, color);
}

function checkPrerenderStatus(options) {
  chrome.tabs.sendMessage(options.tabId, { command: 'queryStatus' }, { frameId: 0 }, status => {
    updateStatus(options.tabId, status);
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
function registerHooks() {
  // Tab switch.
  chrome.tabs.onActivated.addListener(activeInfo => {
    checkPrerenderStatus({ reason: 'onActivated', tabId: activeInfo.tabId, windowId: activeInfo.windowId });
    chrome.tabs.get(activeInfo.tabId, tab => {
      handleContentSwitch({ reason: 'onActivated', url: tab.url });
    });
  });

  // Page load completion.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
      handleContentSwitch({ reason: 'onUpdated.loading', url: changeInfo.url });
    } else if (changeInfo.status === 'complete') {
      checkPrerenderStatus({ reason: 'onUpdated.complete', tabId: tabId, windowId: tab.windowId });
    }
  });

  // Request from content script.
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'update')
      updateStatus(sender.tab.id, message.status);
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

let chromiumVersion = 110;
for (let brand of navigator.userAgentData.brands) {
  if (brand.brand != 'Chromium' && brand.brand != 'Google Chrome')
    continue;
  console.log('detect ' + brand.brand + ' version ' + brand.version);
  chromiumVersion = brand.version;
}
if (chromiumVersion < 110) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true},
    tab => {
      updateIcon(tab.id, 'Prerender Tweaks requires Chrome 110+', 'X', '#f00');
    });
} else {
  registerHooks();
}