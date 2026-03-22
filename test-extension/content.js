// Minimal content script - injects a visible marker into every page
(function() {
  const marker = document.createElement('div');
  marker.id = 'innomapcad-test-extension';
  marker.textContent = 'InnoMapCAD Extension Active';
  marker.style.cssText = 'position:fixed;top:8px;right:8px;z-index:999999;background:#4A90D9;color:white;padding:8px 16px;border-radius:6px;font:14px/1 sans-serif;pointer-events:none;';
  document.body.appendChild(marker);

  // Also set a flag on window for evaluate_script detection
  window.__innomapcadExtensionLoaded = true;

  console.log('[InnoMapCAD] Test extension content script loaded');
})();
