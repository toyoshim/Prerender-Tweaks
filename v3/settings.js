// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export class Settings {
  AUTO_INJECTION = 'autoInjection';

  #defaultValues = {
    autoInjection: false,
  };
  #settings = null;

  constructor(chromiumVersion) {
    this.#defaultValues.autoInjection = chromiumVersion >= 110;
  }

  async getSettings() {
    await this.#initialize();
    return this.#settings;
  }

  async get(key) {
    await this.#initialize();
    return this.#settings[key];
  }

  async set(key, value) {
    await this.#initialize();
    const dict = {};
    dict[key] = value;
    chrome.storage.local.set(dict);
  }

  async #initialize() {
    if (this.#settings != null) {
      return;
    }
    this.#settings = await chrome.storage.local.get(Object.keys(this.#defaultValues));
    for (let key in this.#defaultValues) {
      if (key && this.#settings[key] === undefined) {
        this.#settings[key] = this.#defaultValues[key];
      }
    }
    chrome.storage.local.onChanged.addListener(changes => {
      for (let key in changes) {
        this.#settings[key] = changes[key].newValue;
      }
    });
  }
}