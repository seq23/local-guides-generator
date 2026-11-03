/**
 * Lead gate, browser side (security sweep, 3 Nov 2026). Loaded on every page by the
 * build (scripts/build_city_sites.js, LEAD_GUARD_TAG). Every same-origin POST to
 * /api/request-assistance or /api/senior-lead gets a fresh Cloudflare Turnstile token in
 * the x-turnstile-token header; lib/lead_guard.mjs refuses a post without one. The forms
 * themselves are unchanged: this wraps window.fetch, so the request page, the homepage
 * callback form and the senior intake wizard are all covered by one file.
 *
 * Turnstile runs "interaction-only": most people never see it; when Cloudflare wants a
 * click, the box appears just under the form. If Turnstile cannot load (blocked script,
 * offline), the post goes out without a token and the page shows its own "email us"
 * message, so nobody is left without a way to reach us.
 *
 * The site key is public by design (Turnstile widget "local-guides-leads"; hostnames:
 * the six guide domains, memphisseniorcarehomes.com, theindustryguides.com).
 */
(function () {
  'use strict';
  var SITEKEY = '0x4AAAAAAFx6PYhiV4u_BR22';
  var GUARDED = /^\/api\/(request-assistance|senior-lead)\/?$/;
  var FORMS = 'form[action="/api/request-assistance"], #senior-intake';
  var TIMEOUT_MS = 60000;
  var orig = window.fetch;
  if (!orig || window.__leadGuard) return;
  window.__leadGuard = true;

  var loading = null;
  var box = null;
  var widgetId = null;
  var waiting = [];

  function load() {
    if (window.turnstile) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      window.__leadGuardOnload = function () { resolve(); };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__leadGuardOnload';
      s.async = true;
      s.onerror = function () { loading = null; reject(new Error('turnstile_load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function mount() {
    if (box && document.body.contains(box)) return;
    box = document.createElement('div');
    box.className = 'lead-guard';
    box.setAttribute('data-lead-guard-box', 'true');
    box.style.margin = '12px 0';
    var anchor = document.querySelector(FORMS);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else document.body.appendChild(box);
    widgetId = null;
  }

  function settle(err, token) {
    var w = waiting;
    waiting = [];
    w.forEach(function (p) { if (err) p.reject(err); else p.resolve(token); });
  }

  function challenge() {
    return load().then(function () {
      return new Promise(function (resolve, reject) {
        waiting.push({ resolve: resolve, reject: reject });
        if (waiting.length > 1) return; // one challenge in flight serves every waiting post
        mount();
        if (widgetId === null) {
          widgetId = window.turnstile.render(box, {
            sitekey: SITEKEY,
            execution: 'execute',
            appearance: 'interaction-only',
            callback: function (t) { settle(null, t); },
            'error-callback': function () { settle(new Error('turnstile_error')); return true; },
            'timeout-callback': function () { settle(new Error('turnstile_timeout')); }
          });
        } else {
          window.turnstile.reset(widgetId);
        }
        window.turnstile.execute(widgetId);
      });
    });
  }

  function token() {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(''); }, TIMEOUT_MS);
      challenge().then(function (v) { clearTimeout(t); resolve(v || ''); }, function () { clearTimeout(t); resolve(''); });
    });
  }

  function guardedPath(input) {
    try {
      var u = new URL(typeof input === 'string' ? input : (input && input.url) || '', window.location.href);
      return u.origin === window.location.origin && GUARDED.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  window.fetch = function (input, init) {
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'POST' || !guardedPath(input)) return orig.apply(this, arguments);
    var self = this;
    return token().then(function (t) {
      var opts = {};
      Object.keys(init || {}).forEach(function (k) { opts[k] = init[k]; });
      var h = new Headers((init && init.headers) || (input && input.headers) || {});
      if (t) h.set('x-turnstile-token', t);
      opts.headers = h;
      return orig.call(self, input, opts);
    });
  };

  function warm() {
    if (document.querySelector(FORMS)) load().catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', warm);
  else warm();
})();
