// Loads every branch so approval executors are registered, and re-exports the public API.
export * as crm from './crm.js';
export * as decision from './decision.js';
export { researchBusiness } from './branches/jiraiya-research.js';
export { buildDemo } from './branches/orochimaru-demo.js';
export { deployPreview, requestProductionPublish } from './branches/deploy.js';
export { draftOutreach, handleInbound, markWon, queueCampaign } from './branches/kakashi-outreach.js';
export { discoverBusinesses } from './branches/discovery.js';
export { processLead, runPipeline } from './branches/tsunade-orchestrator.js';
export { runDoctor } from './doctor.js';
export { startServer, createServer } from './server.js';
