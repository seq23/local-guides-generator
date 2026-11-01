(function () {
  'use strict';
  // Attribution contains only a public site path; never query strings or form data.
  var from = new URLSearchParams(location.search).get('from');
  if (!from && document.referrer) {
    try { var ref = new URL(document.referrer); if (ref.origin === location.origin) from = ref.pathname; } catch (_) {}
  }
  if (!/^\/(?:[a-z][a-z0-9-]*\/){0,3}$/.test(from || '')) from = location.pathname;
  document.querySelectorAll('[data-binder-download]').forEach(function (a) {
    var url = new URL(a.href); url.searchParams.set('from', from); a.href = url.href;
  });
  var button = document.querySelector('[data-binder-print]');
  if (button) button.addEventListener('click', function () { window.print(); });
})();
