// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings } from "./settings.js"
import { getChromiumVersion } from "./utils.js"

const chromiumVersion = getChromiumVersion();
const settings = new Settings(chromiumVersion);

let fields = {
  'autoInjection': {
    type: 'boolean',
    isDisabled: () => chromiumVersion < 110,
  },
  'maxRulesByAnchors': {
    type: 'number',
  },
  'anchorHoverInjection': {
    type: 'boolean',
    isDisabled: () => chromiumVersion < 110,
  },
  'recordMetrics': {
    type: 'boolean'
  }
};

for (let key in fields) {
  let element = document.getElementById(key);
  if (fields[key].isDisabled) {
    element.disabled = fields[key].isDisabled();
  }
  if (fields[key].type == 'boolean') {
    element.checked = await settings.get(key);
    element.addEventListener('click', e => {
      settings.set(e.target.id, e.target.checked);
    });
  } else if (fields[key].type == 'number') {
    element.value = await settings.get(key);
    element.addEventListener('change', e => {
      settings.set(e.target.id, e.target.value);
    });
  }
}

document.getElementById('clearAll').addEventListener('click', e => {
  chrome.runtime.sendMessage(undefined, { message: 'clearAllMetrics' });
});

document.getElementById('clearFor').addEventListener('click', e => {
  chrome.runtime.sendMessage(undefined, { message: 'clearOriginMetrics' });
});

document.getElementById('debug').addEventListener('click', e => {
  chrome.runtime.sendMessage(undefined, { message: 'debug' });
});