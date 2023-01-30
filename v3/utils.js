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