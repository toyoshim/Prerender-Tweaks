// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings } from "./settings.js"
import { getChromiumVersion } from "./utils.js"

const chromiumVersion = getChromiumVersion();
const settings = new Settings(chromiumVersion);

let element = document.getElementById('autoInjection');
element.disabled = chromiumVersion < 110;
element.checked = await settings.get(settings.AUTO_INJECTION);
element.addEventListener('click', e => {
  settings.set(e.target.id, e.target.checked);
});