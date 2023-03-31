# Chrome Extensions: Prerender Tweaks

## Install (requires Chrome 110+)
1. Download the extension from the [latest release](https://github.com/toyoshim/Prerender-Tweaks/releases/latest), and unpack it.
2. Open chrome://extensions/, and enable Developer mode in the top-right corner.
3. Press the "Load unpacked" button, and select the "v3" subdirectory from the directory you unpacked in step 1.
4. Pin the `Prerender Tweaks` from the Extensions menu.

![Pin](img/pin.png)

## Indicators
### Speculationrules
![Speculationrules](img/S.png)
The page contains a &lt;script type="speculationrules"&gt;.

### Prerendered(Activated)
![Prerendered](img/P.png)
The page wass prerendered and successfully activated.

### Injected
![Injected](img/I.png)
The page contains a &lt;script type="speculationrules"&gt; that is injected
by the Prerender Tweaks.

### Restored from the back-forward cache
![Restoed](img/$.png)
The page was restored from the back-forward cache.

## Features
### Auto speculationrules injection
Prerender Tweaks inject a speculationrules if it doesn't exist in the page.
It will point the first appeared same-origin, different document anchor link.

### Manual injection from anchor-popup
Popup menu over an anchor tag for a same-origin link will show 'Prerender this link' menu item.
It will inject a speculationrules for the link so that you can try activating the prerendered link manually.
