#!/usr/bin/env node
const { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize } = require('./lib');
const profile = profileConfig('uscis_medical');
const guides = [];
const overrides = require('../../data/community/query_compiler/uscis_medical.json');
upsertGuides(profile.relDir, guides, profile);
const normalizedCount = normalizeAllGuides(profile.relDir, profile);
writeOverrides('data/community/query_compiler/uscis_medical.json', overrides);
runSyncGuides();
auditVertical(profile);
summarize('uscis_medical', guides, normalizedCount);
