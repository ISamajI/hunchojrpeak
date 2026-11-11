// Shared labels for agents, stages and statuses.
export const AGENT = {
  sales: { name: 'Sales Intelligence', short: 'SALES', icon: 'target' },
  web: { name: 'Web Development', short: 'WEB DEV', icon: 'code' },
  marketing: { name: 'Marketing Intelligence', short: 'MARKETING', icon: 'marketing' },
  client: { name: 'Client Relations', short: 'CLIENT REL', icon: 'mail' },
  analytics: { name: 'Business Analytics', short: 'ANALYTICS', icon: 'chart' },
  security: { name: 'System Security', short: 'SECURITY', icon: 'shield' },
  orchestrator: { name: 'Tsunade · Orchestrator', short: 'CORE', icon: 'bolt' },
};
export function actorLabel(a) {
  if (a.agent && AGENT[a.agent]) return AGENT[a.agent].short;
  if (a.actor === 'owner' || String(a.actor).startsWith('owner:')) return 'YOU';
  if (a.actor === 'tsunade') return 'CORE';
  return String(a.actor || 'system').toUpperCase();
}
export const AGENT_STATUS = {
  active: ['active', 'EXECUTING'], queued: ['warning', 'QUEUED'], standby: ['idle', 'STANDBY'],
  attention: ['serious', 'ATTENTION'], offline: ['critical', 'OFFLINE'],
};
export const JOB_STATUS = { queued: ['warning', 'Queued'], running: ['active', 'Running'], done: ['good', 'Done'], failed: ['critical', 'Failed'] };
export const PRIORITY = { low: ['idle', 'Low'], normal: ['good', 'Normal'], high: ['warning', 'High'], critical: ['critical', 'Critical'] };
