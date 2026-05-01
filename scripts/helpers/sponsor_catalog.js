const fs = require('fs');
const path = require('path');

function normalizePublicAssetPath(slug, value) {
  if (!value) return '';
  const rel = String(value).trim().replace(/^\/+/, '');
  const file = path.basename(rel);
  return 'assets/sponsors/' + String(slug || '').trim().toLowerCase() + '/' + file;
}

function loadSponsorCatalog(repoRoot) {
  const root = repoRoot || process.cwd();
  const dir = path.join(root, 'data', 'sponsor_intake', 'sponsors');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    const sponsorRoot = path.join(dir, entry.name);
    const fp = path.join(sponsorRoot, 'sponsor.json');
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const slug = String(raw.slug || raw.sponsor_slug || entry.name).trim().toLowerCase();
      const assets = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};
      out[slug] = {
        ...raw,
        slug,
        sponsor_slug: slug,
        website_url: String(raw.website_url || raw.website || '').trim(),
        lead_email: String(raw.lead_email || raw.contact_email || '').trim(),
        phone: String(raw.phone || '').trim(),
        assets: {
          logo: normalizePublicAssetPath(slug, assets.logo),
          top_cta_image: normalizePublicAssetPath(slug, assets.top_cta_image || assets.hero_image || assets.hero || assets.ad_728x90),
          mid_cta_image: normalizePublicAssetPath(slug, assets.mid_cta_image || assets.top_cta_image || assets.ad_300x250 || assets.hero_image || assets.hero),
          bottom_cta_image: normalizePublicAssetPath(slug, assets.bottom_cta_image || assets.mid_cta_image || assets.top_cta_image || assets.ad_300x250 || assets.hero_image || assets.hero),
          directory_cta_image: normalizePublicAssetPath(slug, assets.directory_cta_image || assets.top_cta_image || assets.ad_300x250 || assets.hero_image || assets.hero)
        },
        source_root: sponsorRoot
      };
    } catch (_) {}
  }
  return out;
}

function getSponsorBySlug(repoRoot, slug) {
  if (!slug) return null;
  const all = loadSponsorCatalog(repoRoot);
  return all[String(slug).trim().toLowerCase()] || null;
}

module.exports = { loadSponsorCatalog, getSponsorBySlug };
