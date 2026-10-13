/**
 * Memphis Senior Care Homes - intake wizard.
 *
 * Mounts into <div id="senior-intake" data-vertical data-city data-zip> (rendered by the
 * page templates on home, city and /request-assistance/ pages). One <script
 * src="/assets/senior-intake.js" defer> is enough: this file loads its stylesheet,
 * /assets/senior-match.js (the one matcher, shared with the lead backend) and
 * /assets/senior-zips.json itself.
 *
 * Phone-first, one question per screen, back button, progress bar. The draft is kept in
 * localStorage (wrapped in try/catch: private windows and blocked storage still work).
 * Attribution query params (?pt=&src=&intent=&button=&vertical=&page_kind=&page_slug=&market=)
 * are carried into the lead under the same names functions/api/request-assistance.js uses.
 * Health answers are tiers and flags only; there is no free-text health field.
 */
(function () {
  'use strict';

  var ROOT_ID = 'senior-intake';
  var DRAFT_KEY = 'senior-intake-draft-v1';
  var FACILITIES_URL = '/data/facilities.json';
  var RESOURCES = [
    { name: 'Tennessee Long-Term Care Ombudsman', url: 'https://www.tn.gov/disability-and-aging/disability-aging-programs/long-term-care-ombudsman.html', note: 'Free, confidential help with questions about nursing homes and assisted living, and with residents’ rights.' },
    { name: 'TennCare CHOICES', url: 'https://www.tn.gov/tenncare/long-term-services-supports/choices.html', note: 'TennCare’s long-term care program: nursing-home care, or care at home and in the community, for people who qualify.' },
    { name: 'Area Agency on Aging and Disability for Shelby County (Aging Commission of the Mid-South)', url: 'https://www.tn.gov/disability-and-aging/resource-directory/aaad.html', note: 'The local office that helps families find care options, benefits counselling and caregiver support.' }
  ];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function scriptBase() {
    var s = document.currentScript || document.querySelector('script[src*="senior-intake.js"]');
    var src = s && s.getAttribute('src') ? s.getAttribute('src') : '/assets/senior-intake.js';
    return src.replace(/senior-intake\.js.*$/, '');
  }
  var BASE = scriptBase();

  function loadCss() {
    if (document.querySelector('link[data-senior-intake]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = BASE + 'senior-intake.css';
    l.setAttribute('data-senior-intake', '1');
    document.head.appendChild(l);
  }

  function loadMatch(cb) {
    if (window.SeniorMatch) return cb();
    var s = document.createElement('script');
    s.src = BASE + 'senior-match.js';
    s.onload = function () { cb(); }; // never pass the load Event on as an error
    s.onerror = function () { cb(new Error('match')); };
    document.head.appendChild(s);
  }

  function storeGet() {
    try { return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }
  function storeSet(v) {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked: the wizard still works */ }
  }
  function storeClear() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  /* tiny DOM helper: h('p', {class: 'x'}, 'text', child) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      if (k === 'on') Object.keys(a.on).forEach(function (ev) { el.addEventListener(ev, a.on[ev]); });
      else if (k === 'class') el.className = a[k];
      else if (a[k] === true) el.setAttribute(k, '');
      else if (a[k] !== false && a[k] != null) el.setAttribute(k, a[k]);
    });
    for (var i = 2; i < arguments.length; i += 1) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function attributionFromUrl(root) {
    var q = new URLSearchParams(window.location.search);
    var get = function (k) { return (q.get(k) || '').slice(0, 160); };
    return {
      src: get('src') || get('pt'),
      intent_type: get('intent'),
      button_source: get('button'),
      vertical_key: get('vertical') || root.getAttribute('data-vertical') || 'senior-living',
      page_kind: get('page_kind') || root.getAttribute('data-page-kind') || '',
      page_slug: get('page_slug') || root.getAttribute('data-page-slug') || window.location.pathname.replace(/^\/+|\/+$/g, ''),
      market_slug: get('market') || root.getAttribute('data-city') || ''
    };
  }

  function boot(root) {
    var M = window.SeniorMatch;
    var zips = {};
    var facilities = null;
    var facilitiesError = false;
    var draft = storeGet() || {};
    var s = {
      step: draft.step || 'who',
      history: draft.history || [],
      a: draft.a || {}
    };
    if (!s.a.zip && root.getAttribute('data-zip')) s.a.zip = root.getAttribute('data-zip');
    var attribution = attributionFromUrl(root);

    fetch(BASE + 'senior-zips.json').then(function (r) { return r.json(); }).then(function (d) { zips = d.zips || {}; if (s.step === 'results') render(); }).catch(function () {});
    fetch(FACILITIES_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { facilities = M.facilityList(d); if (s.step === 'results') render(); })
      .catch(function () { facilitiesError = true; if (s.step === 'results') render(); });

    var FAMILY = ['who', 'zip', 'adl', 'dementia', 'wanders', 'budget', 'payer', 'timeline', 'tags', 'results', 'contact'];
    var PRO = ['who', 'pro_tier', 'pro_memory', 'pro_payer', 'pro_discharge', 'pro_contact'];

    function flow() { return s.a.who_for === 'professional' ? PRO : FAMILY; }
    function save() { storeSet({ step: s.step, history: s.history, a: s.a }); }
    function go(next) { s.history.push(s.step); s.step = next; save(); render(); }
    function back() { if (s.history.length) { s.step = s.history.pop(); save(); render(); } }
    function set(k, v) { s.a[k] = v; save(); }
    function lead() {
      var a = s.a;
      var tier = a.who_for === 'professional' ? Number(a.care_tier || 1) : M.tierFromAdl(a.adl_tasks || []);
      return {
        zip: a.zip, radius: a.radius || 'anywhere', care_tier: tier,
        memory_care: a.who_for === 'professional' ? (a.memory_care === 'yes' ? 1 : 0) : (a.dementia === 'yes' && a.wanders === 'yes' ? 1 : 0),
        budget_band: a.budget_band, payers: a.who_for === 'professional' ? [a.payer] : (a.payers || [])
      };
    }
    function afterTags() {
      return M.offRampReason(lead()) ? 'offramp' : 'results';
    }

    function shell(title, help, body, opts) {
      var o = opts || {};
      var f = flow();
      var idx = Math.max(0, f.indexOf(s.step));
      var pct = Math.round(((idx + 1) / f.length) * 100);
      root.innerHTML = '';
      var card = h('div', { class: 'si-card' },
        o.noProgress ? null : h('div', { class: 'si-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, h('span', { style: 'width:' + pct + '%' })),
        s.history.length && !o.noBack ? h('button', { type: 'button', class: 'si-back', on: { click: back } }, '← Back') : null,
        h('h2', { class: 'si-title', tabindex: '-1' }, title),
        help ? h('p', { class: 'si-help' }, help) : null,
        body
      );
      root.appendChild(card);
      var t = card.querySelector('.si-title');
      if (t && o.focus !== false) try { t.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    }

    function choices(key, options, next, multi) {
      var wrap = h('div', { class: 'si-choices' });
      options.forEach(function (op) {
        var selected = multi ? (s.a[key] || []).indexOf(op[0]) !== -1 : s.a[key] === op[0];
        var b = h('button', { type: 'button', class: 'si-choice' + (selected ? ' is-on' : ''), 'aria-pressed': selected ? 'true' : 'false', on: { click: function () {
          if (multi) {
            var list = (s.a[key] || []).slice();
            var i = list.indexOf(op[0]);
            if (i === -1) list.push(op[0]); else list.splice(i, 1);
            set(key, list);
            render();
          } else {
            set(key, op[0]);
            go(typeof next === 'function' ? next(op[0]) : next);
          }
        } } }, h('span', { class: 'si-choice-label' }, op[1]), op[2] ? h('span', { class: 'si-choice-note' }, op[2]) : null);
        wrap.appendChild(b);
      });
      return wrap;
    }

    function nextBtn(label, onClick, disabled) {
      return h('button', { type: 'button', class: 'si-next', disabled: !!disabled, on: { click: onClick } }, label || 'Next');
    }

    function field(label, input, note) {
      return h('label', { class: 'si-field' }, h('span', null, label), input, note ? h('small', null, note) : null);
    }

    function check(key, label) {
      var cb = h('input', { type: 'checkbox', checked: !!s.a[key], on: { change: function (e) { set(key, e.target.checked); } } });
      return h('label', { class: 'si-check' }, cb, h('span', null, label));
    }

    function honeypot() {
      return h('div', { class: 'si-hp', 'aria-hidden': 'true' }, h('label', null, 'Website', h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', id: 'si-website' })));
    }

    function post(payload, done) {
      var body = {};
      Object.keys(attribution).forEach(function (k) { body[k] = attribution[k]; });
      Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
      var hp = root.querySelector('#si-website');
      body.website = hp ? hp.value : '';
      return fetch('/api/senior-lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'server_error' }; }); })
        .then(done)
        .catch(function () { done({ ok: false, error: 'network' }); });
    }

    var ERRORS = {
      consent: 'Please tick the box agreeing to be contacted.',
      consent_health: 'Please tick the box agreeing to share the care needs you described.',
      contact_required: 'Please give a phone number or an email address.',
      email: 'Please check the email address.',
      name: 'Please give your name.',
      network: 'We could not reach our server. Check your connection and try again.'
    };

    function familyPayload() {
      var a = s.a;
      return {
        kind: 'family', who_for: a.who_for, zip: a.zip || '', radius: a.radius || 'anywhere', adl_tasks: a.adl_tasks || [],
        dementia: a.dementia || '', wanders: a.wanders || '', budget_band: a.budget_band || '', payers: a.payers || [],
        timeline: a.timeline || '', tags: a.tags || [], shown_ids: (s.shown || []).slice(0, 200)
      };
    }

    function resourcesList() {
      return h('ul', { class: 'si-resources' }, RESOURCES.map(function (r) {
        return h('li', null, h('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.name), h('p', null, r.note));
      }));
    }

    function facilityCard(f) {
      return h('li', { class: 'si-fac' },
        h('strong', null, f.name),
        h('span', { class: 'si-fac-meta' }, [f.city, f.distance != null ? f.distance + ' mi' : null, f.memory_care ? 'Memory care' : null].filter(Boolean).join(' · ')),
        f.rate_min ? h('span', { class: 'si-fac-meta' }, 'From $' + Math.round(f.rate_min).toLocaleString('en-US') + ' a month') : null,
        f.phone ? h('a', { class: 'si-tel', href: 'tel:' + f.phone.replace(/[^\d+]/g, '') }, f.phone) : null
      );
    }

    var screens = {
      who: function () {
        shell('Who is this for?', 'A few quick questions, one at a time. It takes about two minutes.', choices('who_for', [
          ['myself', 'Myself'], ['parent', 'My parent'], ['spouse', 'My spouse'], ['professional', 'Someone I care for professionally', 'Discharge planners and case managers']
        ], function (v) { return v === 'professional' ? 'pro_tier' : 'zip'; }));
      },
      zip: function () {
        var zip = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'postal-code', maxlength: '5', placeholder: '38117', value: s.a.zip || '' });
        var radius = choices('radius', [['10', 'Within 10 miles'], ['20', 'Within 20 miles'], ['30', 'Within 30 miles'], ['anywhere', 'Anywhere in the Memphis area']], function () {
          set('zip', (zip.value || '').replace(/\D/g, '').slice(0, 5));
          return 'adl';
        });
        shell('Where should we look?', 'The ZIP code you want to be near, then how far is fine.', h('div', null, field('ZIP code', zip), radius));
      },
      adl: function () {
        shell('Which of these needs help day to day?', 'Tick all that apply. None is fine too.', h('div', null,
          choices('adl_tasks', [['bathing', 'Bathing'], ['dressing', 'Dressing'], ['transferring', 'Getting in and out of bed or a chair'], ['medications', 'Taking medications'], ['mobility', 'Walking or getting around'], ['eating', 'Eating']], null, true),
          nextBtn('Next', function () { go('dementia'); })));
      },
      dementia: function () {
        shell('Has a doctor diagnosed dementia or Alzheimer’s?', null, choices('dementia', [['yes', 'Yes'], ['no', 'No'], ['not_sure', 'Not sure']], function (v) { if (v !== 'yes') set('wanders', ''); return v === 'yes' ? 'wanders' : 'budget'; }));
      },
      wanders: function () {
        shell('Do they wander or try to leave home?', 'This tells us whether a secure memory care unit is needed.', choices('wanders', [['yes', 'Yes'], ['no', 'No']], 'budget'));
      },
      budget: function () {
        shell('What monthly budget are you working with?', 'Assisted living in Memphis is usually paid monthly.', choices('budget_band', Object.keys(M.BUDGET_BANDS).map(function (k) { return [k, M.BUDGET_BANDS[k].label]; }), 'payer'));
      },
      payer: function () {
        shell('How will care be paid for?', 'Tick all that apply.', h('div', null,
          choices('payers', Object.keys(M.PAYERS).map(function (k) { return [k, M.PAYERS[k]]; }), null, true),
          nextBtn('Next', function () { go('timeline'); })));
      },
      timeline: function () {
        shell('When is a move needed?', null, choices('timeline', Object.keys(M.TIMELINES).map(function (k) { return [k, M.TIMELINES[k]]; }), 'tags'));
      },
      tags: function () {
        shell('Anything that matters most? (optional)', 'Tick any that apply, or skip.', h('div', null,
          choices('tags', [['pets', 'Pets allowed'], ['faith', 'Faith community'], ['social', 'Very social'], ['quiet', 'Quiet'], ['dining', 'Good dining'], ['smoking', 'Smoking allowed']], null, true),
          nextBtn('See matching communities', function () { go(afterTags()); })));
      },
      results: function () {
        if (!facilities && !facilitiesError) { shell('Finding communities…', null, h('p', { class: 'si-help' }, 'One moment.')); return; }
        var r = facilities ? M.results(facilities, lead(), zips) : { matches: [], others: [] };
        s.shown = r.matches.map(function (f) { return f.id; });
        var body = h('div', null,
          facilitiesError ? h('p', { class: 'si-note' }, 'We could not load the list just now. You can still ask communities to contact you.') : null,
          h('p', { class: 'si-count' }, r.matches.length + (r.matches.length === 1 ? ' community fits' : ' communities fit') + ' what you described, nearest first.'),
          h('ul', { class: 'si-list' }, r.matches.map(facilityCard)),
          r.others.length ? h('details', { class: 'si-others' }, h('summary', null, 'Other communities in the area (' + r.others.length + ') - may not fit every need you described'), h('ul', { class: 'si-list' }, r.others.map(facilityCard))) : null,
          h('div', { class: 'si-cta' },
            h('h3', null, 'Want up to five of these communities to contact you?'),
            h('p', { class: 'si-help' }, 'Free for families. We share your contact details only with communities that fit, and only with your permission.'),
            nextBtn('Yes, have them contact me', function () { go('contact'); }))
        );
        shell('Communities that fit', null, body, { focus: true });
      },
      contact: function () {
        var name = h('input', { type: 'text', autocomplete: 'name', value: s.a.name || '' });
        var phone = h('input', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', value: s.a.phone || '' });
        var email = h('input', { type: 'email', autocomplete: 'email', value: s.a.email || '' });
        var senior = h('input', { type: 'text', autocomplete: 'off', value: s.a.senior_first_name || '' });
        var err = h('p', { class: 'si-error', role: 'alert' });
        var btn = nextBtn('Send my request', function () {
          set('name', name.value.trim()); set('phone', phone.value.trim()); set('email', email.value.trim()); set('senior_first_name', senior.value.trim());
          btn.disabled = true;
          var p = familyPayload();
          p.name = s.a.name; p.phone = s.a.phone; p.email = s.a.email; p.senior_first_name = s.a.senior_first_name;
          p.consent_contact = !!s.a.consent_contact; p.consent_health = !!s.a.consent_health;
          post(p, function (res) {
            btn.disabled = false;
            if (res && res.ok) { s.result = res; storeClear(); s.history = []; s.step = res.status === 'unsellable' ? 'offramp_done' : 'thanks'; render(); }
            else err.textContent = ERRORS[res && res.error] || 'Something went wrong. Please try again.';
          });
        });
        shell('How should they reach you?', 'A phone number or an email is enough.', h('div', null,
          field('Your name', name), field('Phone', phone), field('Email', email),
          s.a.who_for === 'myself' ? null : field('Their first name (optional)', senior),
          check('consent_contact', 'I agree to be contacted by phone, text or email by up to five senior living communities and by Memphis Senior Care Homes about this request.'),
          check('consent_health', 'I agree to share the care needs I described (care level, memory care, budget and timeline) with those communities.'),
          honeypot(), err, btn));
      },
      offramp: function () {
        var reason = M.offRampReason(lead());
        if (!s.offrampPosted) {
          s.offrampPosted = true;
          var p = s.a.who_for === 'professional' ? null : familyPayload();
          if (p) post(p, function (res) { if (res && res.ok) { s.result = res; } });
        }
        var why = reason === 'tier3_skilled_nursing'
          ? 'Help with five or more daily tasks is usually more care than assisted living provides. A skilled nursing facility, or skilled care at home, is likely the better fit, and these free public services can help you find it.'
          : 'Most assisted living in Tennessee is paid privately. If care will be paid by Medicaid or TennCare, TennCare CHOICES covers nursing-home care, or care at home and in the community, for people who qualify. These free public services can help.';
        var name = h('input', { type: 'text', autocomplete: 'name', value: s.a.name || '' });
        var phone = h('input', { type: 'tel', autocomplete: 'tel', value: s.a.phone || '' });
        var email = h('input', { type: 'email', autocomplete: 'email', value: s.a.email || '' });
        var err = h('p', { class: 'si-error', role: 'alert' });
        var btn = nextBtn('Ask a person to call me', function () {
          set('name', name.value.trim()); set('phone', phone.value.trim()); set('email', email.value.trim());
          var p = familyPayload();
          p.name = s.a.name; p.phone = s.a.phone; p.email = s.a.email; p.consent_contact = !!s.a.consent_contact;
          if (s.result && s.result.lead_id && s.result.edit_token) { p.lead_id = s.result.lead_id; p.edit_token = s.result.edit_token; }
          btn.disabled = true;
          post(p, function (res) {
            btn.disabled = false;
            if (res && res.ok) { storeClear(); s.step = 'offramp_done'; s.history = []; render(); }
            else err.textContent = ERRORS[res && res.error] || 'Something went wrong. Please try again.';
          });
        });
        shell('Here is where to start', why, h('div', null, resourcesList(),
          h('h3', null, 'Want a person to talk it through with you?'),
          field('Your name', name), field('Phone', phone), field('Email', email),
          check('consent_contact', 'I agree to be contacted by phone, text or email by Memphis Senior Care Homes about this request.'),
          honeypot(), err, btn), { noProgress: true });
      },
      offramp_done: function () {
        shell('Thank you', 'We have your request. These free public services can help right away:', resourcesList(), { noBack: true, noProgress: true });
      },
      thanks: function () {
        shell('Your request is in', 'Communities that fit will contact you, usually within a day. We will check in with you in 30 days to see how it went. You can still call any community on the list yourself.', h('p', { class: 'si-help' }, 'Reference: ' + ((s.result && s.result.lead_id) || '')), { noBack: true, noProgress: true });
      },
      pro_tier: function () {
        shell('Care level', 'How many daily tasks (bathing, dressing, transferring, medications, mobility, eating) does the patient need help with?', choices('care_tier', [
          ['1', 'Tier 1', '0-1 tasks'], ['2', 'Tier 2', '2-4 tasks'], ['3', 'Tier 3', '5-6 tasks (skilled nursing boundary)']
        ], 'pro_memory'));
      },
      pro_memory: function () {
        shell('Is secure memory care needed?', null, choices('memory_care', [['yes', 'Yes'], ['no', 'No']], 'pro_payer'));
      },
      pro_payer: function () {
        shell('Primary payer', null, choices('payer', Object.keys(M.PAYERS).map(function (k) { return [k, M.PAYERS[k]]; }), 'pro_discharge'));
      },
      pro_discharge: function () {
        var d = h('input', { type: 'date', value: s.a.discharge_date || '' });
        shell('Expected discharge date', null, h('div', null, field('Discharge date', d), nextBtn('Next', function () { set('discharge_date', d.value); go('pro_contact'); })));
      },
      pro_contact: function () {
        var email = h('input', { type: 'email', autocomplete: 'work email', value: s.a.email || '' });
        var err = h('p', { class: 'si-error', role: 'alert' });
        var btn = nextBtn('Send to fitting communities', function () {
          set('email', email.value.trim());
          btn.disabled = true;
          post({ kind: 'professional', care_tier: s.a.care_tier, memory_care: s.a.memory_care, payer: s.a.payer, discharge_date: s.a.discharge_date || '', email: s.a.email, consent_contact: !!s.a.consent_contact, consent_health: !!s.a.consent_health, zip: root.getAttribute('data-zip') || '' }, function (res) {
            btn.disabled = false;
            if (res && res.ok) { s.result = res; storeClear(); s.history = []; s.step = res.status === 'unsellable' ? 'offramp_done' : 'thanks'; render(); }
            else err.textContent = ERRORS[res && res.error] || 'Something went wrong. Please try again.';
          });
        });
        shell('Your work email', 'Communities reply to you. No patient or family details are collected here.', h('div', null,
          field('Work email', email),
          check('consent_contact', 'I agree to be contacted by up to five senior living communities and by Memphis Senior Care Homes about this placement.'),
          check('consent_health', 'I have permission to share the care level, memory care need and payer described here.'),
          honeypot(), err, btn));
      }
    };

    // Anonymous funnel: screen numbers only (no answers, no contact details), one random
    // id per visit, so drop-off is visible in GET /api/senior-funnel. Never blocks the wizard.
    var SPECIAL = { offramp: 12, offramp_done: 13, thanks: 14 };
    var session = (function () {
      var a = new Uint8Array(12);
      try { window.crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i += 1) a[i] = Math.floor(Math.random() * 256); }
      return Array.prototype.map.call(a, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    })();
    function track(event, screen) {
      try {
        fetch('/api/senior-event', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: session, event: event, screen: screen, page_kind: attribution.page_kind, page_slug: attribution.page_slug, src: attribution.src }) }).catch(function () {});
      } catch (e) { /* never block the wizard */ }
    }
    function screenNumber() {
      if (SPECIAL[s.step]) return SPECIAL[s.step];
      var i = flow().indexOf(s.step);
      if (i === -1) return 0;
      return s.a.who_for === 'professional' ? 21 + i : 1 + i;
    }

    function render() {
      (screens[s.step] || screens.who)();
      var n = screenNumber();
      track('screen', n);
      if (n === 2 || n === 22) track('intake_start', 0);
      if (s.step === 'results' && (facilities || facilitiesError)) track('results_shown', 0);
    }
    render();
  }

  ready(function () {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    loadCss();
    loadMatch(function (err) {
      if (err || !window.SeniorMatch) {
        root.textContent = 'This form could not load. Please refresh the page, or email hello@theindustryguides.com.';
        return;
      }
      boot(root);
    });
  });
})();
