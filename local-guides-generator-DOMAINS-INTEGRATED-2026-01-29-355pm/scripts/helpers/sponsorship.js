/*
  Sponsorship + Next-Steps helpers (vertical-agnostic)

  Locked rules:
  - Defaults are OFF everywhere.
  - If packConfig.educationOnly === true -> sponsorship + next-steps are OFF.
  - Two enable paths when educationOnly !== true:
      A) Sponsor-driven (per-city): packConfig.sponsorship.nextStepsEnabled === true AND sponsor is live
      B) Global buyout: packConfig.sponsorship.globalNextStepsEnabled === true
*/

function isSponsorLive(cityData) {
  // cityData is expected to be the sponsor object (or any object containing sponsor fields).
  const s = cityData;
  return !!(
    s &&
    typeof s === "object" &&
    s.status === "live" &&
    (s.firm_name || s.name) &&
    s.official_site_url &&
    s.intake_url
  );
}

function isNextStepsEnabled(packConfig) {
  const cfg = packConfig || {};
  if (cfg.educationOnly === true) return false;
  return !!(cfg.sponsorship && cfg.sponsorship.nextStepsEnabled === true);
}

function isGlobalNextStepsEnabled(packConfig) {
  const cfg = packConfig || {};
  if (cfg.educationOnly === true) return false;
  return !!(cfg.sponsorship && cfg.sponsorship.globalNextStepsEnabled === true);
}

function shouldRenderNextSteps(packConfig, cityData) {
  const cfg = packConfig || {};
  if (cfg.educationOnly === true) return false;

  if (isGlobalNextStepsEnabled(cfg)) return true;

  // Sponsor-driven enable path.
  if (!isNextStepsEnabled(cfg)) return false;
  return isSponsorLive(cityData);
}

function getSponsorCTAConfig(packConfig) {
  // Generic wording; no vertical-specific copy.
  // Intentionally does not change behavior based on pack config.
  return {
    label: "Visit sponsor",
    sublabel: "Advertising"
  };
}

module.exports = {
  isSponsorLive,
  isNextStepsEnabled,
  isGlobalNextStepsEnabled,
  shouldRenderNextSteps,
  getSponsorCTAConfig
};
