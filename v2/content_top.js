function run() {
  for (let meta of document.getElementsByTagName('meta')) {
    if (meta.name !== 'PrerenderTweaks')
      continue;
    let found = false;
    for (let script of document.getElementsByTagName('script')) {
      if (script.type !== 'speculationrules')
        continue;
      if (script.innerText.indexOf(meta.content) >= 0) {
        found = true;
        break;
      }
    }
    if (found)
      continue;
    const rule = document.createElement('script');
    rule.type = 'speculationrules';
    rule.innerText = `{ "prerender": [ { "source": "list", "urls": [ "${meta.content}" ] } ] }`;
    document.head.appendChild(rule);
    console.log('injecting speculationrules for ' + meta.content);
  }
}

run();
const mutationObserver = new MutationObserver(o => {
  run();
});
mutationObserver.observe(document.head, { childList: true, subtree: true });