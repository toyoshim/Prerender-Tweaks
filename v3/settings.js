// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export class Settings {
    AUTO_INJECTION = 'autoInjection';

    #defaultValues = {
        'autoInjection': false,
    };

    constructor(chromiumVersion) {
        this.#defaultValues.autoInjection = chromiumVersion >= 110;
    }

    async get(key) {
        const result = await chrome.storage.local.get([key]);
        if (result[key] === undefined) {
            return this.#defaultValues[key];
        }
        return result[key];
    }

    async set(key, value) {
        const dict = {};
        dict[key] = value;
        chrome.storage.local.set(dict);
    }
}