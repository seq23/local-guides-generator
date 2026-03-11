/* eslint-disable no-console */
const publicOutboundLinkPolicy = require('./public_outbound_link_policy');
const requestAssistanceToolContract = require('./request_assistance_tool_contract');
const citationRoutingContract = require('./citation_routing_contract');
const schemaCitationRoutingContract = require('./schema_citation_routing_contract');

function run(ctx = {}) {
  publicOutboundLinkPolicy.run(ctx);
  requestAssistanceToolContract.run(ctx);
  citationRoutingContract.run(ctx);
  schemaCitationRoutingContract.run(ctx);
  console.log('✅ citation routing bundle PASS');
}

module.exports = { run };
