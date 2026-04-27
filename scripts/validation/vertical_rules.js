function getVerticalRules(route){
  const r = String(route || '').toLowerCase();
  if (r.includes('guides/')) {
    if (r.includes('uscis')) return { banned:[/guaranteed approval/i, /approval is guaranteed/i], required:[/not legal advice/i, /results vary|process can vary|timing can vary/i] };
    if (r.includes('trt') || r.includes('peptide') || r.includes('iv-hydration') || r.includes('hair') || r.includes('medical-weight-loss')) return { banned:[/guaranteed results/i, /will fix/i, /cure/i], required:[/not medical advice/i, /results vary|can vary|not a quick fix/i] };
    if (r.includes('accident') || r.includes('injury') || r.includes('lawyer') || r.includes('wrongful') || r.includes('slip') || r.includes('truck')) return { banned:[/guaranteed payout/i, /guaranteed settlement/i], required:[/not legal advice/i, /case.*vary|results.*vary|timelines.*vary/i] };
  }
  return { banned:[], required:[] };
}
module.exports = { getVerticalRules };
