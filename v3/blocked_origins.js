// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const name = 'blockedOrigins';

export class BlockedOrigins {
  #set = null;

  constructor() {
    chrome.storage.sync.onChanged.addListener(changes => {
      console.log(changes);
      if (changes[name] && changes[name].newValue) {
        this.#set = changes[name].newValue;
        console.log(this.#set);
      }
    });
  }

  async isBlocked(origin) {
    await this.#initialize();
    return !!this.#set[origin];
  }

  async block(origin) {
    await this.#initialize();
    this.#set[origin] = true;
    const dict = {};
    dict[name] = this.#set;
    await chrome.storage.sync.set(dict);
  }

  async allow(origin) {
    await this.#initialize();
    if (!this.#set[origin]) {
      return;
    }
    delete this.#set[origin];
    const dict = {};
    dict[name] = this.#set;
    await chrome.storage.sync.set(dict);
  }

  async #initialize() {
    if (this.#set != null) {
      return;
    }
    const data = await chrome.storage.sync.get(name);
    this.#set = data.blockedOrigins || {};
  }
}