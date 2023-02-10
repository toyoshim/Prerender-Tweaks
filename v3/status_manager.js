// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export class StatusManager {
  #updateIcon(tabId, title, badgeText, badgeBgColor) {
    chrome.action.setTitle({ tabId: tabId, title: title });
    if (badgeText === undefined)
      badgeText = '';
    chrome.action.setBadgeText({ tabId: tabId, text: badgeText });
    if (badgeBgColor) {
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: badgeBgColor });
    }
  }

  update(tabId, status) {
    if (!status) {
      return;
    }
    let text = '|';
    let color = undefined;
    let title = 'Prerender Tweaks';
    if (status.restoredFromBFCache) {
      text += '$|';
      color = '#f0f';
      title += '\nRestored from BFCache';
    } else if (status.unsupportedPage) {
      text = 'X';
      color = '#f77';
      title += '\nUnsupported page';
    } else {
      if (status.prerendered) {
        text += 'P|';
        color = '#00f';
        title += '\nPrerendered';
      }
      if (status.hasInjectedSpecrules) {
        text += 'I|';
        if (!color) {
          color = '#ff0';
        }
        title += '\nPage contains tweaked speculationrules';
      } else if (status.hasSpecrules) {
        text += 'S|';
        color = '#0f0';
        title += '\nPage contains speculationrules';
      }
    }
    if (text === '|') {
      text = '';
    }
    this.#updateIcon(tabId, title, text, color);
  }
}