const path = require('path');

// The one company every canonical site belongs to. Footers, the 404 page and the
// publisher statements on the shared global pages all derive from this constant;
// nothing else in the repo may carry a second copy of the name.
const PARENT_COMPANY = 'The Industry Guides';

// The one contact address every canonical's footer and contact pages show
// (owner decision, 12 Oct 2026). Routed by Cloudflare Email Routing on theindustryguides.com.
const CONTACT_EMAIL = 'hello@theindustryguides.com';

const PACK_SITE_CONFIG = {
  pi: {
    pageSetSlugs: ['pi_v1.json', 'cities_pi_v1.json'],
    siteUrl: 'https://theaccidentguides.com',
    brandName: 'The Accident Guides',
  },
  dentistry: {
    pageSetSlugs: ['dentistry_v1.json', 'cities_dentistry_v1.json'],
    siteUrl: 'https://dentistryguides.com',
    brandName: 'The Dentistry Guides',
  },
  trt: {
    pageSetSlugs: ['trt_v1.json', 'cities_trt_v1.json'],
    siteUrl: 'https://hormonesivhair.com',
    brandName: 'Hormone Optimization Guides',
  },
  neuro: {
    pageSetSlugs: ['neuro_v1.json', 'cities_neuro_v1.json'],
    siteUrl: 'https://neuroevalguides.com',
    brandName: 'Neuro Evaluation Guides',
  },
  uscis_medical: {
    pageSetSlugs: ['uscis_medical_v1.json', 'cities_uscis_medical_v1.json'],
    siteUrl: 'https://uscisexam.com',
    brandName: 'USCIS Exam Guides',
  },
  senior_living: {
    pageSetSlugs: ['senior_living_v1.json', 'cities_senior_living_v1.json'],
    siteUrl: 'https://memphisseniorcarehomes.com',
    brandName: 'Memphis Senior Care Homes',
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

module.exports = { PARENT_COMPANY, CONTACT_EMAIL, PACK_SITE_CONFIG, getPackKeyFromPageSet, getPackSiteConfig };
