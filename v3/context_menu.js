// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const menuId = 'prerenderLink';

export class ContextMenu {
  #observer = null;

  register() {
    // Monitor tab switches.
    chrome.tabs.onActivated.addListener(activeInfo => {
      chrome.tabs.get(activeInfo.tabId, tab => {
        this.#handleContentSwitch(tab.url);
      });
    });

    // Monitor navigation to change the url.
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading' && changeInfo.url) {
        this.#handleContentSwitch(changeInfo.url);
      }
    });
  }

  observe(observer) {
    this.#observer = observer;
  }

  #handleContentSwitch(urlString) {
    chrome.contextMenus.removeAll();
    if (!urlString.startsWith('http')) {
      return;
    }

    const url = new URL(urlString);
    const portString = url.port ? (':' + url.port) : '';
    const sameOriginPattern = url.protocol + '//' + url.host + portString + '/*';
 
    chrome.contextMenus.create({
      id: menuId,
      contexts: ['link'],
      title: 'Prerender this link',
      targetUrlPatterns: [sameOriginPattern]
    });
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (this.#observer && info.menuItemId == menuId) {
        this.#observer(tab.id, info.linkUrl);
      }
    });
  }
}