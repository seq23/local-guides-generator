const path = require('path');

// The one company every canonical site belongs to. Footers, the 404 page and the
// publisher statements on the shared global pages all derive from this constant;
// nothing else in the repo may carry a second copy of the name.
const PARENT_COMPANY = 'The Industry Guides';

// The one contact address every canonical's footer and contact pages show
// (owner decision, 12 Oct 2026). Routed by Cloudflare Email Routing on theindustryguides.com.
const CONTACT_EMAIL = 'hello@theindustryguides.com';

// The umbrella company's own hub page for each publication. These are real,
// live pages on theindustryguides.com that name and describe the publication
// (verified 25 Oct 2026: all six answer 200 and reference their canonical
// host), which is what makes them a legitimate schema.org `sameAs` - "a
// reference Web page that unambiguously indicates the item's identity".
//
// Why this list and not a social profile. Search Readiness item c1 wants an
// Organization with name, url, logo and sameAs on every page, and the sites
// had no sameAs at all (`schema.sameAs` is `[]` in every page set). None of
// these six publications has a social account; inventing one would put a dead
// URL claiming to identify the publisher on every page of six live sites,
// which is worse than the empty array it replaced. The umbrella hub is the one
// identity reference that actually exists and is true.
const UMBRELLA_HOST = 'https://theindustryguides.com';

const PACK_SITE_CONFIG = {
  pi: {
    pageSetSlugs: ['pi_v1.json', 'cities_pi_v1.json'],
    siteUrl: 'https://theaccidentguides.com',
    brandName: 'The Accident Guides',
    umbrellaPath: 'personal-injury',
  },
  dentistry: {
    pageSetSlugs: ['dentistry_v1.json', 'cities_dentistry_v1.json'],
    siteUrl: 'https://dentistryguides.com',
    brandName: 'The Dentistry Guides',
    umbrellaPath: 'dentistry',
  },
  trt: {
    pageSetSlugs: ['trt_v1.json', 'cities_trt_v1.json'],
    siteUrl: 'https://hormonesivhair.com',
    brandName: 'Hormone Optimization Guides',
    umbrellaPath: 'trt',
  },
  neuro: {
    pageSetSlugs: ['neuro_v1.json', 'cities_neuro_v1.json'],
    siteUrl: 'https://neuroevalguides.com',
    brandName: 'Neuro Evaluation Guides',
    umbrellaPath: 'neuro',
  },
  uscis_medical: {
    pageSetSlugs: ['uscis_medical_v1.json', 'cities_uscis_medical_v1.json'],
    siteUrl: 'https://uscisexam.com',
    brandName: 'USCIS Exam Guides',
    umbrellaPath: 'uscis-medical',
  },
  senior_living: {
    pageSetSlugs: ['senior_living_v1.json', 'cities_senior_living_v1.json'],
    siteUrl: 'https://memphisseniorcarehomes.com',
    brandName: 'Memphis Senior Care Homes',
    umbrellaPath: 'senior-living',
    alternateNames: ['memphis senior care homes', 'memphis senior guide'],
  },
  starter: {
    pageSetSlugs: ['starter_v1.json'],
    siteUrl: 'https://local-guides-generator.pages.dev',
    brandName: 'LKG Training Pack',
  },
};

function normalizePageSet(raw) {
  return String(raw || '').replace(/\\/g, '/').trim();
}

function getPackKeyFromPageSet(rawPageSetFile) {
  const ps = normalizePageSet(rawPageSetFile);
  const base = path.basename(ps);
  for (const [key, cfg] of Object.entries(PACK_SITE_CONFIG)) {
    if (cfg.pageSetSlugs.includes(base)) return key;
  }
  return '';
}

function getPackSiteConfig(rawPageSetFile) {
  const key = getPackKeyFromPageSet(rawPageSetFile);
  return key ? { key, ...PACK_SITE_CONFIG[key] } : null;
}

/**
 * The umbrella hub URL that identifies a pack's publication, or '' for a pack
 * that has none (the starter training pack is not a publication).
 */
function getUmbrellaSameAs(rawPageSetFile) {
  const cfg = getPackSiteConfig(rawPageSetFile);
  return cfg && cfg.umbrellaPath ? `${UMBRELLA_HOST}/${cfg.umbrellaPath}/` : '';
}

module.exports = {
  PARENT_COMPANY,
  CONTACT_EMAIL,
  UMBRELLA_HOST,
  PACK_SITE_CONFIG,
  getPackKeyFromPageSet,
  getPackSiteConfig,
  getUmbrellaSameAs,
};
