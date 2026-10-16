/*
 * Attribution carry for clean internal links.
 *
 * Internal links used to carry attribution in their query string
 * (/request-assistance/?src=...&intent=...&button=...). Every distinct query is
 * a distinct crawlable URL: Ahrefs crawled 1,306 uscisexam URLs a week against
 * a 228-URL sitemap, and the canonical next-steps pages had no clean inbound
 * link at all. The build now emits each internal <a> with a clean href and the
 * attribution in data-attr-qs (scripts/build_city_sites.js, moveInternalQueryToData).
 *
 * This file keeps analytics and the lead forms working unchanged:
 *  1. On click of an <a data-attr-qs>, it stores {path, query} for this tab.
 *  2. On the next page, if the URL has no query and the stored path matches,
 *     it restores the query with history.replaceState BEFORE the page's own
 *     scripts run (it is loaded synchronously in <head>), so every reader of
 *     location.search / location.href (request-assistance form, senior intake,
 *     Clarity) sees exactly what the old tracked href delivered.
 * Same-origin file, not inline, so a strict CSP (script-src 'self') never blocks it.
 */
(function () {
  var KEY = 'lkg_attr_carry';
  var MAX_AGE_MS = 10 * 60 * 1000;
  try {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[data-attr-qs]') : null;
      if (!a) return;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ p: a.pathname, q: a.getAttribute('data-attr-qs') || '', t: Date.now() }));
      } catch (_) {}
    }, true);
    if (window.location.search) return;
    var s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!s || !s.q || s.p !== window.location.pathname || Date.now() - s.t > MAX_AGE_MS) return;
    sessionStorage.removeItem(KEY);
    window.history.replaceState(window.history.state, '', window.location.pathname + '?' + s.q + window.location.hash);
  } catch (_) {}
})();
