// Copyright 2023 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Settings } from "./settings.js"
import { Metrics } from "./metrics.js"
import { NetRequest } from "./net_request.js"
import { getChromiumVersion } from "./utils.js"

const chromiumVersion = getChromiumVersion();
const settings = new Settings(chromiumVersion);
const metrics = new Metrics();
const netRequest = new NetRequest();

let fields = {
  'autoInjection': {
    type: 'boolean',
    isDisabled: () => chromiumVersion < 110
  },
  'maxRulesByAnchors': {
    type: 'number'
  },
  'anchorHoverInjection': {
    type: 'boolean',
    isDisabled: () => chromiumVersion < 110
  },
  'lastVisitInjection': {
    type: 'boolean',
    isDisabled: () => chromiumVersion < 110
  },
  'crossOriginSameSiteSupport': {
    type: 'boolean',
    onChanged: checked => {
      if (checked) {
        netRequest.enableLoadingMode();
      } else {
        netRequest.disableLoadingMode();
      }
    }
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
      if (fields[key].onChanged) {
        fields[key].onChanged(e.target.checked);
      }
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
  labels.push(((i * 0.1).toString() + '.0').substring(0, 3));
}
const tab = await chrome.tabs.query({ active: true, lastFocusedWindow: true});
const url = new URL(tab[0].url);
const lcp = await metrics.getLcp(url.origin);

function getAverage(data) {
  if (!data) {
    return '-';
  }
  return (data.total / data.count / 1000).toString().substring(0, 5) + ' [sec]';
}

const scaleOption = {
  x: {
    title: {
      display: true,
      text: '[second]',
      align: 'end'
    }
  },
  y: {
    ticks: {
      callback: value => { return value + '%'; }
    }
  }
};

const lcp_origin_chart = new Chart(document.getElementById('lcp_origin'), {
  type: 'bar',
  data: {
    labels: labels,
    datasets: [{
      label: 'Prerendered LCP (avg: ' + getAverage(lcp.lcp_origin_p) + ')',
      data: lcp.lcp_origin_p ? lcp.lcp_origin_p.bucket.map(d => d * 100 / lcp.lcp_origin_p.count) : [],
      borderWidth: 1,
      xAxisID: 'x',
      yAxisID: 'y'
    }, {
      label: 'Non-Prerendered LCP (avg: ' + getAverage(lcp.lcp_origin_n) + ')',
      data: lcp.lcp_origin_n ? lcp.lcp_origin_n.bucket.map(d => d * 100 / lcp.lcp_origin_n.count) : [],
      borderWidth: 1,
      xAxisID: 'x',
      yAxisID: 'y'
    }]
  },
  options: {
    scales: scaleOption,
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
      data: lcp.lcp_all_p.bucket.map(d => d * 100 / lcp.lcp_all_p.count),
      borderWidth: 1,
      xAxisID: 'x',
      yAxisID: 'y'
    }, {
      label: 'Non-Prerendered LCP (avg: ' + getAverage(lcp.lcp_all_n) + ')',
      data: lcp.lcp_all_n.bucket.map(d => d * 100 / lcp.lcp_all_n.count),
      borderWidth: 1,
      xAxisID: 'x',
      yAxisID: 'y'
    }]
  },
  options: {
    scales: scaleOption,
    plugins: {
      title: {
        display: true,
        text: 'Largest-Contentful-Paint for All Sites'
      }
    }
  }
});