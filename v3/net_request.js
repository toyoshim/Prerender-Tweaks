// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const ruleId = 'loading_mode_rules';

export class NetRequest {

  async enableLoadingMode() {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [ruleId]
    });
  }

  async disableLoadingMode() {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: [ruleId]
    });
  }

  async isLoadingModeEnabled() {
    const list = await chrome.declarativeNetRequest.getEnabledRulesets();
    return !!list[ruleId];
  }
}