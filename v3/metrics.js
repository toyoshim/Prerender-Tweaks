// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Storage layout: {
//   index: {
//     '.version': 1,
//     '.nextId': 2,
//     'example.com': 1
//     ...
//   },
//   lcp_n_0: {                     // non-prerendered data for all origins
//     count: <integer>,            // lcp non-prerendered report count
//     total: <real>,               // lcp non-prerenderd total time length in ms
//     bucket: array<integer>[31]   // report count for each bucket
//   },                             //  index N: [N * 100, N * 100 + 100) ms
//                                  //  index 30: over 3000 ms
//   lcp_p_0: { ... }     // prerendered data for all origins
//   lcp_n_1: { ... }     // non-prerendered data for origin index 1 (e.g., example.com)
//   lcp_p_1: { ... }     // prerendered data for origin index 1 (e.g., example.com)
//   ...
// }
export class Metrics {
  #index = null;  // index in the storage layout
  #lcp_n = {};    // lcp_n_N in the storage is stored with the key N
  #lcp_p = {};    // lcp_p_N in the storage is stored with the key N

  async clearAll() {
    await this.#initialize();
    const nextId = this.#index['.nextId'];
    const keys = ['index'];
    for (let id = 0; id < nextId; ++id) {
      keys.push('lcp_n_' + id);
      keys.push('lcp_p_' + id);
    }
    await chrome.storage.local.remove(keys);
    this.#index = null;
    this.#lcp_n = {};
    this.#lcp_p = {};
    await this.#initialize();
  }

  async clearFor(origin) {
    await this.#initialize();
    const index = this.#index[origin];
    if (!index) {
      return;
    }
    const keys = [
      'lcp_p_' + index,
      'lcp_n_' + index
    ];
    delete this.#lcp_n[index];
    delete this.#lcp_p[index];
    await chrome.storage.local.remove(keys);
  }

  async dumpToLog() {
    console.log('index', this.#index);
    console.log('lcp_n', this.#lcp_n);
    console.log('lcp_p', this.#lcp_p);
  }

  async reportEffectiveLcp(origin, prerendered, lcp) {
    const bucket = this.#calculateBucket(lcp);
    await this.#initialize();
    const index = await this.#warmupFor(origin);
    if (prerendered) {
      this.#lcp_p[0].count += 1;
      this.#lcp_p[0].total += lcp;
      this.#lcp_p[0].bucket[bucket] += 1;
      this.#lcp_p[index].count += 1;
      this.#lcp_p[index].total += lcp;
      this.#lcp_p[index].bucket[bucket] += 1;
      const data = { lcp_p_0: this.#lcp_p[0] };
      data['lcp_p_' + index] = this.#lcp_p[index];
      await chrome.storage.local.set(data);
    } else {
      this.#lcp_n[0].count += 1;
      this.#lcp_n[0].total += lcp;
      this.#lcp_n[0].bucket[bucket] += 1;
      this.#lcp_n[index].count += 1;
      this.#lcp_n[index].total += lcp;
      this.#lcp_n[index].bucket[bucket] += 1;
      const data = { lcp_n_0: this.#lcp_n[0] };
      data['lcp_n_' + index] = this.#lcp_n[index];
      await chrome.storage.local.set(data);
    }
    // TODO: update per-origin variants
  }

  async getLcp(origin) {
    await this.#initialize();
    const lcp = {
      lcp_all_n: this.#lcp_n[0],
      lcp_all_p: this.#lcp_p[0]
    };
    if (this.#index[origin]) {
      const index = await this.#warmupFor(origin);
      lcp.lcp_origin_n = this.#lcp_n[index];
      lcp.lcp_origin_p = this.#lcp_p[index];
    }
    return lcp;
  }

  async #initialize() {
    if (this.#index != null) {
      return;
    }
    const result = await chrome.storage.local.get(['index', 'lcp_n_0', 'lcp_p_0']);
    this.#index = result.index || {
        '.version': 1,
        '.nextId': 1,
        // origin index follows as below.
        // 'example.com': 1
        // 'example.test': 2
    };
    this.#lcp_n[0] = result.lcp_n_0 || this.#createLcpStorage();
    this.#lcp_p[0] = result.lcp_p_0 || this.#createLcpStorage();
  }

  async #warmupFor(origin) {
    await this.#initialize();

    let id = 0;
    if (this.#index[origin]) {
      id = this.#index[origin]
    } else {
      id = this.#index['.nextId'];
      this.#index[origin] = id;
      this.#index['.nextId'] = id + 1;
      await chrome.storage.local.set({index: this.#index});
    }
    const keys = ['lcp_n_' + id, 'lcp_p_' + id];
    const result = await chrome.storage.local.get(keys);
    this.#lcp_n[id] = result[keys[0]] || this.#createLcpStorage();
    this.#lcp_p[id] = result[keys[1]] || this.#createLcpStorage();
    return id;
  }

  #calculateBucket(value) {
    const bucket = (value / 100) | 0;
    return (bucket < 30) ? bucket : 30;
  }

  #createLcpStorage() {
    let storage = {
      count: 0,
      total: 0.0,
      bucket: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0
      ]
    }
    return storage;
  }
}