const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugToWords(slug) {
  return String(slug || '')
    .replace(/^guides[_/-]?/i, '')
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .split('/')
    .pop()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(text) {
  return String(text || '')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

function routeWithSlash(route) {
  const s = String(route || '/').trim();
  if (!s || s === '/') return '/';
  return `/${s.replace(/^\/+|\/+$/g, '')}/`;
}

function readJsonIfExists(fp) {
  if (!fp || !fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function getVerticalNoun(verticalKey) {
  switch (String(verticalKey || '').toLowerCase()) {
    case 'pi': return 'personal injury lawyer';
    case 'dentistry': return 'dentist';
    case 'trt': return 'TRT or wellness clinic';
    case 'neuro': return 'neuro evaluation provider';
    case 'uscis_medical': return 'civil surgeon';
    default: return 'provider';
  }
}

function getVerticalPlural(verticalKey) {
  switch (String(verticalKey || '').toLowerCase()) {
    case 'pi': return 'personal injury lawyers';
    case 'dentistry': return 'dentists';
    case 'trt': return 'TRT or wellness clinics';
    case 'neuro': return 'neuro evaluation providers';
    case 'uscis_medical': return 'civil surgeons';
    default: return 'providers';
  }
}

function getTopicLabel(ctx) {
  const explicitTitle = String(ctx.title || '').trim();
  if (ctx.pageKind === 'guide-detail' || ctx.pageKind === 'global-detail') {
    if (explicitTitle) {
      return explicitTitle
        .replace(/\s+[|·-].*$/, '')
        .replace(/^Guides?\s*[:\-–]\s*/i, '')
        .trim();
    }
    return titleCase(slugToWords(ctx.route));
  }
  if (ctx.pageKind === 'city') return `${getVerticalPlural(ctx.verticalKey)} in ${ctx.marketLabel}`;
  if (ctx.pageKind === 'state') return `${getVerticalPlural(ctx.verticalKey)} in ${ctx.stateName}`;
  if (ctx.pageKind === 'faq') return `${getVerticalPlural(ctx.verticalKey)} FAQ`;
  if (ctx.pageKind === 'guides-hub') return `${getVerticalPlural(ctx.verticalKey)} guides`;
  if (ctx.pageKind === 'home') return getVerticalPlural(ctx.verticalKey);
  return explicitTitle || titleCase(slugToWords(ctx.route));
}


function interpolateTemplate(value, ctx) {
  const raw = String(value || '');
  const replacements = {
    market: String(ctx.marketLabel || '').trim(),
    state: String(ctx.stateName || '').trim(),
    topic: getTopicLabel(ctx),
    route: routeWithSlash(ctx.route),
    verticalNoun: getVerticalNoun(ctx.verticalKey),
    verticalPlural: getVerticalPlural(ctx.verticalKey)
  };
  return raw.replace(/\{(market|state|topic|route|verticalNoun|verticalPlural)\}/g, (_, key) => replacements[key] || '');
}

function normalizeOverrideItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item) return null;
    if (typeof item === 'string') {
      return { query: item, href: '/', label: 'Related path', groupId: 'custom', groupLabel: 'Custom' };
    }
    const query = String(item.query || '').trim();
    if (!query) return null;
    return {
      query,
      href: routeWithSlash(item.href || '/'),
      label: String(item.label || 'Related path').trim() || 'Related path',
      groupId: String(item.groupId || 'custom').trim() || 'custom',
      groupLabel: String(item.groupLabel || item.groupId || 'Custom').trim() || 'Custom'
    };
  }).filter(Boolean);
}

function mergeOverrideObjects(target, source) {
  if (!source || typeof source !== 'object') return target;
  Object.keys(source).forEach((key) => {
    if (!target[key]) target[key] = {};
    const current = target[key];
    const incoming = source[key] || {};
    if (Object.prototype.hasOwnProperty.call(incoming, 'replaceDefault')) {
      current.replaceDefault = !!incoming.replaceDefault;
    }
    if (Array.isArray(incoming.items)) {
      current.items = normalizeOverrideItems(incoming.items);
    }
    if (Array.isArray(incoming.addItems)) {
      current.addItems = normalizeOverrideItems(incoming.addItems);
    }
  });
  return target;
}

function loadFanoutOverrides(pageSet, verticalKey) {
  const merged = {};
  mergeOverrideObjects(merged, pageSet && pageSet.fanoutOverrides);

  const declaredFile = pageSet && pageSet.fanoutOverridesFile ? String(pageSet.fanoutOverridesFile) : '';
  if (declaredFile) {
    const overridePath = path.isAbsolute(declaredFile)
      ? declaredFile
      : path.join(REPO_ROOT, declaredFile.replace(/^\.\//, ''));
    const fromFile = readJsonIfExists(overridePath);
    if (fromFile && fromFile.overrides) mergeOverrideObjects(merged, fromFile.overrides);
    else if (fromFile) mergeOverrideObjects(merged, fromFile);
  }

  const bridgeDir = path.join(DATA_DIR, 'community', 'query_compiler');
  const sharedBridge = readJsonIfExists(path.join(bridgeDir, 'shared.json'));
  const verticalBridge = readJsonIfExists(path.join(bridgeDir, `${String(verticalKey || '').toLowerCase()}.json`));
  [sharedBridge, verticalBridge].forEach((payload) => {
    if (!payload) return;
    if (payload.overrides) mergeOverrideObjects(merged, payload.overrides);
    else mergeOverrideObjects(merged, payload);
  });

  return merged;
}

function getOverrideKeyCandidates(ctx) {
  const route = routeWithSlash(ctx.route);
  const pageKind = String(ctx.pageKind || 'generic');
  return [
    `${pageKind}:${route}`,
    `${pageKind}:*`,
    route,
    '*'
  ];
}

function applyOverrides(items, ctx, pageSet) {
  const overrides = loadFanoutOverrides(pageSet, ctx.verticalKey);
  const candidates = getOverrideKeyCandidates(ctx);
  let current = Array.isArray(items) ? items.slice() : [];

  candidates.forEach((key) => {
    const match = overrides[key];
    if (!match) return;
    if (match.replaceDefault && Array.isArray(match.items)) {
      current = match.items.slice();
    } else if (Array.isArray(match.items) && current.length === 0) {
      current = match.items.slice();
    }
    if (Array.isArray(match.addItems) && match.addItems.length) {
      current = current.concat(match.addItems);
    }
  });

  current = current.map((item) => ({
    ...item,
    query: interpolateTemplate(item.query, ctx),
    href: interpolateTemplate(item.href, ctx),
    label: interpolateTemplate(item.label, ctx),
    groupLabel: interpolateTemplate(item.groupLabel, ctx)
  }));

  const seen = new Set();
  return current.filter((item) => {
    const key = `${item.groupId}|${item.query.toLowerCase()}|${routeWithSlash(item.href)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    item.href = routeWithSlash(item.href);
    return true;
  });
}

function defaultClusterItems(ctx) {
  const market = String(ctx.marketLabel || ctx.stateName || '').trim();
  const noun = getVerticalNoun(ctx.verticalKey);
  const plural = getVerticalPlural(ctx.verticalKey);
  const topic = getTopicLabel(ctx);
  const route = routeWithSlash(ctx.route);
  const verticalKey = String(ctx.verticalKey || '').trim().toLowerCase();
  const isNeuro = verticalKey === 'neuro';
  const isUscis = verticalKey === 'uscis_medical';
  const neuroRoutes = {
    costs: '/guides/neuro-evaluation-pricing/',
    questions: '/guides/questions-to-ask-before-neuro-testing/',
    redFlags: '/guides/neuro-provider-red-flags/',
    after: '/guides/what-to-expect-after-a-neuro-evaluation/',
    choose: '/guides/how-to-choose-a-neuro-evaluation-provider/',
    insurance: '/guides/neuro-insurance-and-out-of-network/',
    report: '/guides/what-a-neuro-report-includes/',
    telehealth: '/guides/telehealth-vs-in-person-neuro/',
    nextSteps: '/next-steps/'
  };
  const uscisRoutes = {
    costs: '/guides/costs-and-timeframes/',
    questions: '/guides/questions-to-ask-a-civil-surgeon/',
    redFlags: '/guides/questions-to-ask-a-civil-surgeon/',
    after: '/guides/after-your-exam-next-steps/',
    choose: '/guides/i-693-medical-exam-requirements/',
    insurance: '/guides/document-checklist/',
    report: '/guides/document-checklist/',
    telehealth: '/guides/uscis-vaccination-requirements/',
    nextSteps: '/next-steps/',
    // Naturalization routes. Only the two that genuinely vary by place are
    // fanned out under a geo-templated query: the N-400 interview is held at a
    // USCIS field office, and which office serves a given metro is the one
    // per-place fact this vertical has. The civics test, the age-based
    // exemptions and Form N-648 are federal and identical in every state, so
    // they are linked from the state and city guide cards rather than dressed
    // up as location-specific queries here.
    interview: '/guides/uscis-interview-checklist/',
    n400: '/guides/n-400-checklist/'
  };
  const routeSet = isNeuro ? neuroRoutes : (isUscis ? uscisRoutes : null);

  // Naturalization fan-out, uscis_medical only. Empty for every other vertical.
  //
  // Live on state pages. On city pages this is a fallback that currently does
  // not fire: uscis_medical city records are served by the configured cluster
  // in data/community/query_compiler/uscis_medical.json, which overrides these
  // defaults. That file is also the source for the citation probe's query set,
  // so widening it widens what gets measured - a separate decision from this
  // one. City pages reach the naturalization guides through the decision
  // support groups in build_city_sites.js instead.
  const naturalizationItems = isUscis ? [
    { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `naturalization interview checklist in ${market}`, href: uscisRoutes.interview, label: 'Interview checklist' },
    { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `N-400 filing checklist in ${market}`, href: uscisRoutes.n400, label: 'N-400 checklist' }
  ] : [];

  if (ctx.pageKind === 'city') {
    return [
      { groupId: 'compare', groupLabel: 'Compare and shortlist', query: `best ${plural} in ${market}`, href: route, label: 'City hub' },
      { groupId: 'compare', groupLabel: 'Compare and shortlist', query: `how to choose a ${noun} in ${market}`, href: route, label: 'City hub' },
      { groupId: 'faq', groupLabel: 'FAQ and red flags', query: `${noun} questions in ${market}`, href: `${route}#city-faq`, label: 'City FAQ' },
      { groupId: 'faq', groupLabel: 'FAQ and red flags', query: `red flags when choosing a ${noun} in ${market}`, href: routeSet ? routeSet.redFlags : '/guides/#red-flags', label: 'Red flags guide' },
      { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `${noun} cost in ${market}`, href: routeSet ? routeSet.costs : '/guides/#costs', label: 'Costs path' },
      { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `questions to ask a ${noun} in ${market}`, href: routeSet ? routeSet.questions : '/guides/#questions', label: 'Questions path' },
      { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `find a ${noun} in ${market}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' },
      ...naturalizationItems
    ];
  }

  if (ctx.pageKind === 'state') {
    return [
      { groupId: 'compare', groupLabel: 'State-level lookup paths', query: `${plural} in ${market}`, href: route, label: 'State hub' },
      { groupId: 'compare', groupLabel: 'State-level lookup paths', query: `how to find a ${noun} in ${market}`, href: route, label: 'State hub' },
      { groupId: 'faq', groupLabel: 'State-level lookup paths', query: `${noun} questions in ${market}`, href: route, label: 'State FAQ' },
      { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `${noun} checklist in ${market}`, href: routeSet ? routeSet.after : '/guides/', label: routeSet ? 'After-evaluation guide' : 'Guides hub' },
      { groupId: 'next', groupLabel: 'Costs, timing, next steps', query: `request help finding a ${noun} in ${market}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' },
      ...naturalizationItems
    ];
  }

  if (ctx.pageKind === 'faq') {
    return [
      { groupId: 'faq', groupLabel: 'Common question paths', query: `${plural} FAQ`, href: route, label: 'FAQ hub' },
      { groupId: 'faq', groupLabel: 'Common question paths', query: `questions to ask a ${noun}`, href: route, label: 'FAQ hub' },
      { groupId: 'faq', groupLabel: 'Common question paths', query: `red flags when choosing a ${noun}`, href: routeSet ? routeSet.redFlags : '/guides/#red-flags', label: 'Red flags guide' },
      { groupId: 'next', groupLabel: 'Common question paths', query: `how to compare ${plural}`, href: routeSet ? routeSet.choose : '/guides/', label: 'Guides hub' }
    ];
  }

  if (ctx.pageKind === 'guides-hub') {
    return [
      { groupId: 'costs', groupLabel: 'Costs', query: `${noun} costs`, href: routeSet ? routeSet.costs : '/guides/#costs', label: 'Costs cluster' },
      { groupId: 'timeline', groupLabel: 'Timeline', query: `${noun} timeline`, href: isNeuro ? neuroRoutes.after : '/guides/#timeline', label: 'Timeline cluster' },
      { groupId: 'questions', groupLabel: 'Questions to ask', query: `questions to ask a ${noun}`, href: routeSet ? routeSet.questions : '/guides/#questions', label: 'Questions cluster' },
      { groupId: 'red-flags', groupLabel: 'Red flags', query: `red flags for ${noun}`, href: routeSet ? routeSet.redFlags : '/guides/#red-flags', label: 'Red-flags cluster' },
      { groupId: 'next', groupLabel: 'Next steps', query: `find a ${noun}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' }
    ];
  }

  if (ctx.pageKind === 'guide-detail') {
    return [
      { groupId: 'primary', groupLabel: 'Primary route', query: topic, href: route, label: 'This guide' },
      { groupId: 'primary', groupLabel: 'Primary route', query: `what to know about ${topic}`, href: route, label: 'This guide' },
      { groupId: 'compare', groupLabel: 'Related decision paths', query: `questions to ask about ${topic}`, href: isNeuro ? neuroRoutes.questions : '/faq/', label: 'FAQ' },
      { groupId: 'compare', groupLabel: 'Related decision paths', query: `red flags for ${topic}`, href: routeSet ? routeSet.redFlags : '/guides/#red-flags', label: 'Red-flags cluster' },
      { groupId: 'next', groupLabel: 'Related decision paths', query: `find help with ${topic}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' }
    ];
  }

  if (ctx.pageKind === 'global-detail') {
    return [
      { groupId: 'primary', groupLabel: 'Primary route', query: topic, href: route, label: 'This page' },
      { groupId: 'primary', groupLabel: 'Primary route', query: `what should I know about ${topic}`, href: route, label: 'This page' },
      { groupId: 'compare', groupLabel: 'Related decision paths', query: `how to compare options for ${topic}`, href: routeSet ? routeSet.choose : '/guides/', label: 'Guides hub' },
      { groupId: 'compare', groupLabel: 'Related decision paths', query: `questions to ask about ${topic}`, href: isNeuro ? neuroRoutes.questions : '/faq/', label: 'FAQ' },
      { groupId: 'next', groupLabel: 'Related decision paths', query: `find help with ${topic}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' }
    ];
  }

  if (ctx.pageKind === 'home') {
    return [
      { groupId: 'primary', groupLabel: 'Core discovery paths', query: `${plural} near me`, href: route, label: 'Home' },
      { groupId: 'primary', groupLabel: 'Core discovery paths', query: `how to choose a ${noun}`, href: routeSet ? routeSet.choose : '/guides/', label: 'Guides hub' },
      { groupId: 'compare', groupLabel: 'Core discovery paths', query: `${noun} FAQ`, href: isNeuro ? neuroRoutes.questions : '/faq/', label: 'FAQ' },
      { groupId: 'next', groupLabel: 'Core discovery paths', query: `find a ${noun}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' }
    ];
  }

  return [
    { groupId: 'primary', groupLabel: 'Related search paths', query: topic || `${plural} guide`, href: route, label: 'This page' },
    { groupId: 'next', groupLabel: 'Related search paths', query: `find a ${noun}`, href: routeSet ? routeSet.nextSteps : '/request-assistance/', label: 'Get matched with a provider' }
  ];
}

function classifyPageKind(ctx) {
  const route = routeWithSlash(ctx.route);
  if (ctx.pageKind) return ctx.pageKind;
  if (ctx.marketLabel) return 'city';
  if (/^\/states\//i.test(route)) return 'state';
  if (route === '/faq/') return 'faq';
  if (route === '/guides/') return 'guides-hub';
  if (/^\/guides\//i.test(route)) return 'guide-detail';
  if (route === '/') return 'home';
  return 'global-detail';
}

function buildFanoutCluster(ctx, pageSet) {
  const enriched = { ...ctx, pageKind: classifyPageKind(ctx) };
  const items = applyOverrides(defaultClusterItems(enriched), enriched, pageSet);
  const groups = [];
  const byGroup = new Map();
  items.forEach((item) => {
    const key = `${item.groupId}|${item.groupLabel}`;
    if (!byGroup.has(key)) {
      const group = {
        id: String(item.groupId || 'group').trim() || 'group',
        label: String(item.groupLabel || 'Related search paths').trim() || 'Related search paths',
        items: []
      };
      byGroup.set(key, group);
      groups.push(group);
    }
    byGroup.get(key).items.push({
      query: String(item.query || '').trim(),
      href: routeWithSlash(item.href || '/'),
      label: String(item.label || 'Related path').trim() || 'Related path'
    });
  });

  return {
    pageKind: enriched.pageKind,
    route: routeWithSlash(enriched.route),
    title: String(enriched.title || '').trim(),
    topic: getTopicLabel(enriched),
    groups
  };
}

function renderFanoutClusterHtml(cluster) {
  if (!cluster || !Array.isArray(cluster.groups) || cluster.groups.length === 0) return '';
  const groupHtml = cluster.groups.map((group) => {
    const safeId = String(group.id || 'group').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const items = (group.items || []).map((item) => {
      return (
        '<li class="fanout-query-item">' +
          '<a href="' + escapeHtml(item.href) + '"><strong>' + escapeHtml(item.query) + '</strong></a>' +
          '<span class="fanout-query-path"> → ' + escapeHtml(item.label) + '</span>' +
        '</li>'
      );
    }).join('\n');
    return (
      '<div class="fanout-query-group" id="' + escapeHtml(safeId) + '">' +
        '<h3>' + escapeHtml(group.label) + '</h3>' +
        '<ul class="fanout-query-list">' + items + '</ul>' +
      '</div>'
    );
  }).join('\n');

  return (
    '<details class="section fanout-query-cluster fanout-query-cluster--tertiary accordion" data-fanout-query-cluster="true">' +
      '<summary><span>Related search paths</span><span class="accordion-meta">Additional owned routes for this topic</span></summary>' +
      '<div class="accordion-panel">' +
        '<p class="muted">These routes support fanout/query coverage and keep owned paths visible, but they are intentionally secondary to the main framework and next-step flow.</p>' +
        groupHtml +
      '</div>' +
    '</details>'
  );
}

function writeFanoutExport(outDir, records, pageSet, verticalKey) {
  if (!outDir || !Array.isArray(records)) return;
  const payload = {
    generatedAt: new Date().toISOString(),
    verticalKey: String(verticalKey || ''),
    pageSetFile: String((pageSet && pageSet.__pageSetFile) || pageSet?.pageSetFile || ''),
    totalPages: records.length,
    records
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '_fanout_query_clusters.json'), JSON.stringify(payload, null, 2));

  const releasesDir = path.join(REPO_ROOT, 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });
  const fileName = `fanout_query_clusters.${String(verticalKey || 'pack').toLowerCase()}.json`;
  fs.writeFileSync(path.join(releasesDir, fileName), JSON.stringify(payload, null, 2));
}

module.exports = {
  buildFanoutCluster,
  renderFanoutClusterHtml,
  writeFanoutExport,
  routeWithSlash,
  classifyPageKind
};
