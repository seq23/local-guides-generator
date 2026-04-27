const path = require('path');

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

module.exports = { PACK_SITE_CONFIG, getPackKeyFromPageSet, getPackSiteConfig };
