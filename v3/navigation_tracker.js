// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings as NavigationTrackerSettings } from "./settings.js";
import { getChromiumVersion as NavigationTrackerGetChromiumVersion } from "./utils.js";

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
  #urlTracks = {};
  #selectorTracks = {};
  #observer = null;
  #settings = null;

  constructor() {
    this.#settings = new NavigationTrackerSettings(NavigationTrackerGetChromiumVersion());
    chrome.tabs.onUpdated.addListener(this.#onUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.#onRemoved.bind(this));
    chrome.runtime.onMessage.addListener(this.#onMessage.bind(this));
  }

  observe(observer) {
    this.#observer = observer;
  }

  async #onUpdated(tabId, tab) {
    if (!(await this.#settings.get('lastVisitInjection'))) {
      return;
    }

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
    const lastUrlTrack = this.#urlTracks[lastUrl];
    this.#urlTracks[lastUrl] = url;

    if (!this.#observer) {
      return;
    }

    // Notify the last URL transition.
    const isPrerenderable = lastUrlTrack ? isPrerenderableLink(url, lastUrlTrack) : false;
    const selectorTrack = this.#selectorTracks[url];
    if (isPrerenderable || selectorTrack) {
      const to = {};
      if (isPrerenderable) {
        to.url = lastUrlTrack;
      }
      if (selectorTrack) {
        to.selector = selectorTrack;
      }
      this.#observer({
        event: 'predict',
        to: to
      });
    }

    // Notify the prediction hit.
    if (lastUrlTrack == url && isPrerenderable) {
      this.#observer({
        event: 'hit',
        from: lastUrl,
        to: {
          url: lastTrack
        }
      });
    }
  }

  async #onRemoved(tabId) {
    if (!(await this.#settings.get('lastVisitInjection'))) {
      return;
    }

    delete this.#urls[tabId];
  }

  async #onClick(message) {
    if (!(await this.#settings.get('lastVisitInjection'))) {
      return;
    }

    // Drop fragment part.
    const url = getBaseUrl(message.initiator);

    // Check the selector for the last transition.
    const lastTrack = this.#selectorTracks[url];
    if (lastTrack && message.selector && this.#observer) {
      this.#observer({
        event: 'hit',
        from: url,
        to: {
          selector: lastTrack,
          url: message.target
        }
      });
    }

    // Remember the new track.
    this.#selectorTracks[url] = message.selector;
  }

  async #onMessage(message, sender, sendResponse) {
    if (message.message != 'click') {
      return;
    }

    if (await this.#settings.get('lastVisitInjection')) {
      this.#onClick(message);
    }
  }
}