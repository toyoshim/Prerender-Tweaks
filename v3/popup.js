// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings } from "./settings.js"
import { Metrics } from "./metrics.js"
import { getChromiumVersion } from "./utils.js"

const chromiumVersion = getChromiumVersion();
const settings = new Settings(chromiumVersion);
const metrics = new Metrics();

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

const labels = [];
for (let i = 0; i <= 30; ++i) {
  labels.push((i * 100).toString() + '-');
}
const tab = await chrome.tabs.query({ active: true, lastFocusedWindow: true});
const url = new URL(tab[0].url);
const lcp = await metrics.getLcp(url.origin);

function getAverage(data) {
  if (!data) {
    return '-';
  }
  return (data.total / data.count / 1000).toString().substring(0, 5) + ' [ms]';
}

const lcp_origin_chart = new Chart(document.getElementById('lcp_origin'), {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Prerendered LCP (avg: ' + getAverage(lcp.lcp_origin_p) + ')',
      data: lcp.lcp_origin_p ? lcp.lcp_origin_p.bucket.map(d => d / lcp.lcp_origin_p.count) : [],
      borderWidth: 1
    }, {
      label: 'Non-Prerendered LCP (avg: ' + getAverage(lcp.lcp_origin_n) + ')',
      data: lcp.lcp_origin_n ? lcp.lcp_origin_n.bucket.map(d => d / lcp.lcp_origin_n.count) : [],
      borderWidth: 1
    }]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Largest-Contentful-Paint for ' + url.origin
      }
    }
  }
});

const lcp_all_chart = new Chart(document.getElementById('lcp_all'), {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Prerendered LCP (avg: ' + getAverage(lcp.lcp_all_p) + ')',
      data: lcp.lcp_all_p.bucket.map(d => d / lcp.lcp_all_p.count),
      borderWidth: 1
    }, {
      label: 'Non-Prerendered LCP (avg: ' + getAverage(lcp.lcp_all_n) + ')',
      data: lcp.lcp_all_n.bucket.map(d => d / lcp.lcp_all_n.count),
      borderWidth: 1
    }]
  },
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Largest-Contentful-Paint for All Sites'
      }
    }
  }
});