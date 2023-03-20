// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings as NavigationTrackerSettings, Settings } from "./settings.js";
import { getChromiumVersion as NavigationTrackerGetChromiumVersion } from "./utils.js";
import { getSite } from './third_party/psl.min.js'

function getBaseUrl(href) {
  const url = new URL(href);
  return url.href.substring(0, url.href.length - url.hash.length);
}

async function isPrerenderableLink(initiator, target, settings) {
  if (!initiator.startsWith('http')) {
    return false;
  }
  const initiatorUrl = new URL(initiator);
  const targetUrl = new URL(target);
  if (initiatorUrl.origin == targetUrl.origin) {
    return true;
  }
  if (await settings.get('crossOriginSameSiteSupport')) {
    if (initiatorUrl.protocol != targetUrl.protocol) {
      return false;
    }
    const initiatorSite = getSite(initiatorUrl.host);
    const targetSite = getSite(targetUrl.host);
    return initiatorSite == targetSite;
  }
  return false;
}

export class NavigationTracker {
  #urls = {};  // Tracks the last visited URL on each tab.
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

    // Predicts the next navigation.
    const urlTrack = this.#urlTracks[url];
    const isPrerenderable = lastUrlTrack && await isPrerenderableLink(url, urlTrack, this.#settings);
    const selectorTrack = this.#selectorTracks[url];
    if (isPrerenderable || selectorTrack) {
      const to = {};
      if (isPrerenderable) {
        to.url = urlTrack;
      }
      if (selectorTrack) {
        to.selector = selectorTrack;
      }
      this.#observer({
        event: 'predict',
        tab: tabId,
        to: to
      });
    }

    // Notify the prediction hit.
    if (lastUrlTrack == url && isPrerenderable) {
      this.#observer({
        event: 'hit',
        tab: tabId,
        from: lastUrl,
        to: {
          url: lastUrlTrack
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