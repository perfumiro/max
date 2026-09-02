(function () {
  'use strict';

  var brandLabelPattern = /^Explore\s+(.+?)\s+fragrances$/i;
  var navigationPending = false;

  function getBrand(button) {
    var label = button.getAttribute('aria-label') || '';
    var match = label.match(brandLabelPattern);
    return match ? match[1].trim() : '';
  }

  function enhance(button) {
    var brand = getBrand(button);
    if (!brand || button.dataset.ipoBrandLink === 'true') return;

    button.dataset.ipoBrandLink = 'true';
    button.dataset.ipoBrand = brand;
    button.setAttribute('title', 'Voir tous les parfums ' + brand);
    button.setAttribute('aria-description', 'Ouvre la maison ' + brand + ' dans la boutique IPORDISE');
  }

  function scan(root) {
    if (root instanceof HTMLElement && root.matches('[aria-label]')) enhance(root);
    if (root.querySelectorAll) root.querySelectorAll('[aria-label]').forEach(enhance);
  }

  function openBrand(button) {
    var brand = button.dataset.ipoBrand || getBrand(button);
    if (!brand || navigationPending) return;
    navigationPending = true;

    var url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('store', '1');
    url.searchParams.set('brand', brand);

    // Let the app's native handler run first. If it does not expose the brand
    // in the URL immediately, the fallback reloads the same app route with the
    // selected house preserved for refresh and browser back navigation.
    window.setTimeout(function () {
      var currentBrand = new URL(window.location.href).searchParams.get('brand');
      if (currentBrand !== brand) window.location.assign(url.toString());
      navigationPending = false;
    }, 80);
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-ipo-brand-link="true"]');
    if (button) openBrand(button);
  });

  scan(document);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
