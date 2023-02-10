// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function getBaseUrl(href) {
  const url = new URL(href);
  return url.href.substring(0, url.href.length - url.hash.length);
}

function isPrerenderableLink(initiator, target) {
  if (!initiator.startsWith('http')) {
    return false;
  }
  const initiatorUrl = new URL(initiator);
  const targetUrl = new URL(target);
  return initiatorUrl.origin == targetUrl.origin;
}

export class NavigationTracker {
  #urls = {};
  #tracks = {};
  #observer = null;

  constructor() {
    chrome.tabs.onUpdated.addListener(this.#onUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.#onRemoved.bind(this));
  }

  observe(observer) {
    this.#observer = observer;
  }

  #onUpdated(tabId, tab) {
    if (!tab.url) {
      return;
    }

    // Drop fragment part.
    const url = getBaseUrl(tab.url);

    // Skip the first navigation in a tab as we don't have any information on URL transition.
    const lastUrl = this.#urls[tabId];
    this.#urls[tabId] = url;
    if (!lastUrl) {
      return;
    }

    // Check the last URL transition.
    const lastTrack = this.#tracks[lastUrl];
    if (!lastTrack) {
      // Record the navigation initiator and target pair.
      this.#tracks[lastUrl] = url;
      return;
    }

    if (!this.#observer) {
      return;
    }

    // Notify the last URL transition.
    if (isPrerenderableLink(url, lastTrack)) {
      this.#observer({
        event: 'predict',
        to: lastTrack,
        tab: tabId
      });
    }

    // Notify the prediction hit.
    if (lastTrack == url && isPrerenderableLink(lastUrl, lastTrack)) {
      this.#observer({
        event: 'hit',
        from: lastUrl,
        to: lastTrack
      });
    }
  }

  #onRemoved(tabId) {
    delete this.#urls[tabId];
  }
}