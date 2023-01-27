let chromiumVersion = 110;
for (let brand of navigator.userAgentData.brands) {
  if (brand.brand != 'Chromium' && brand.brand != 'Google Chrome')
    continue;
  console.log('detect ' + brand.brand + ' version ' + brand.version);
  chromiumVersion = brand.version;
}

document.getElementById('autoInjection').disabled = true;
document.getElementById('autoInjection').checked = true;