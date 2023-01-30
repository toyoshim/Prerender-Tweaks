// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

export function getChromiumVersion() {
  let chromiumVersion = 110;
  for (let brand of navigator.userAgentData.brands) {
    if (brand.brand != 'Chromium' && brand.brand != 'Google Chrome') {
      continue;
    }
    console.log('detect ' + brand.brand + ' version ' + brand.version);
    chromiumVersion = brand.version;
  }
  return chromiumVersion;
}