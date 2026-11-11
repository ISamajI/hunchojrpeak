#!/usr/bin/env -S node --no-warnings=ExperimentalWarning
// AKAMARU — the front door. CLI for the LTGPeak business operating system.
import { parseArgs } from 'node:util';
import * as A from '../src/index.js';
import { settings } from '../src/config.js';
import { recent } from '../src/activity.js';
import { setTaskStatus } from '../src/branches/onboarding.js';

const HELP = `Akamaru — LTGPeak autonomous business OS

Usage: akamaru <command> [options]

Pipeline
  run --category <c> --near <place> [--limit N] [--threshold N] [--provider google_places|openstreetmap]
                         Discover → research → demo → QA → preview → outreach draft (sends queue for approval)
  discover --category <c> --near <place> [--limit N]
  add --name <n> [--category] [--city] [--address] [--website] [--email] [--phone]
  process <id> [--force] Run every remaining autonomous step for one lead
  research <id> | demo <id> | deploy <id> | outreach <id>

CRM
  leads [--stage s] [--min N]       List leads
  lead <id>                         Full lead detail
  stage <id> <stage>                Move a lead (stage "won" also creates onboarding plan)
  note <id> <text>                  Add a note
  task <taskId> <todo|doing|done|skipped>

Owner approvals
  approvals [--status pending|all]  What Akamaru is waiting on you for
  approve <id> | reject <id> [--note text]
  publish <id>                      Request approval to publish a demo as the production site
  queue <campaignId> [--body text]  Queue an edited draft for send approval

Responses
  inbound --from <email> [--subject s] --text <t>   Log a reply (same as webhook)

System
  doctor [--live]                   Integration status (+ live reachability probe)
  activity [--limit N]
  serve [--port N] [--host h]       Dashboard at http://127.0.0.1:4317
`;

const out = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values: o, positionals: pos } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      category: { type: 'string' }, near: { type: 'string' }, limit: { type: 'string' }, threshold: { type: 'string' },
      provider: { type: 'string' }, name: { type: 'string' }, city: { type: 'string' }, address: { type: 'string' },
      website: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, stage: { type: 'string' },
      min: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' }, from: { type: 'string' },
      subject: { type: 'string' }, text: { type: 'string' }, body: { type: 'string' }, port: { type: 'string' },
      host: { type: 'string' }, live: { type: 'boolean' }, force: { type: 'boolean' },
    },
  });
  const id = () => {
    const n = Number(pos[0]);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`"${cmd}" needs a numeric id`);
    return n;
  };
  switch (cmd) {
    case 'run': return out(await A.runPipeline({ category: o.category, near: o.near, limit: Number(o.limit || 10), threshold: o.threshold ? Number(o.threshold) : undefined, provider: o.provider }));
    case 'discover': return out(await A.discoverBusinesses({ category: o.category, near: o.near, limit: Number(o.limit || 20), provider: o.provider }));
    case 'add': return out(A.crm.upsertBusiness({ name: o.name, category: o.category, city: o.city, address: o.address, website: o.website, email: o.email, phone: o.phone, source: 'manual' }));
    case 'process': return out(await A.processLead(id(), { force: o.force, threshold: o.threshold ? Number(o.threshold) : undefined }));
    case 'research': return out(await A.researchBusiness(id()));
    case 'demo': return out(await A.buildDemo(id()));
    case 'deploy': return out(await A.deployPreview(id()));
    case 'outreach': return out(await A.draftOutreach(id()));
    case 'leads': {
      const rows = A.crm.listLeads({ stage: o.stage, minScore: o.min ? Number(o.min) : undefined });
      if (!rows.length) return out('No leads yet.');
      return console.table(rows.map((r) => ({ id: r.id, score: r.score, name: r.name, stage: r.stage, city: r.city, preview: r.preview_url || '' })));
    }
    case 'lead': return out(A.crm.leadDetail(id()) || 'Not found');
    case 'stage': {
      if (pos[1] === 'won') return out({ onboarding: A.markWon(id()) });
      A.crm.setStage(id(), pos[1], 'owner'); return out('ok');
    }
    case 'note': A.crm.addNote(id(), pos.slice(1).join(' ')); return out('ok');
    case 'task': setTaskStatus(id(), pos[1]); return out('ok');
    case 'approvals': {
      const list = A.decision.listApprovals(o.status || 'pending');
      if (!list.length) return out('Nothing waiting for approval.');
      for (const a of list) out(`#${a.id} [${a.status}] ${a.action}: ${a.summary}\n   why: ${a.reason}${a.preview ? '\n   ' + a.preview.replace(/\n/g, '\n   ') : ''}\n`);
      return;
    }
    case 'approve': return out(await A.decision.approve(id(), 'owner:cli'));
    case 'reject': return out(A.decision.reject(id(), 'owner:cli', o.note || ''));
    case 'publish': return out(A.requestProductionPublish(id()));
    case 'queue': return out(A.queueCampaign(id(), { subject: o.subject, body: o.body }));
    case 'inbound': return out(await A.handleInbound({ from: o.from, subject: o.subject, text: o.text }));
    case 'doctor': {
      const rows = await A.runDoctor({ live: o.live });
      for (const r of rows) {
        out(`${r.configured ? '✔' : '✘'} ${r.label}${r.reachable === undefined ? '' : r.reachable ? `  (reachable: ${r.probe})` : `  (UNREACHABLE: ${r.probe})`}`);
        if (r.configured) out(`    powers: ${r.powers}`);
        else out(`    missing: ${r.missing.join(', ') || '—'}\n    without it: ${r.fallback}\n    connect: ${r.connect}`);
      }
      return;
    }
    case 'activity': return out(recent(Number(o.limit || 30)).map((a) => `${a.ts}  ${a.actor.padEnd(14)} ${a.action}${a.entity_id ? ` #${a.entity_id}` : ''}`).join('\n'));
    case 'serve': {
      const port = Number(o.port || process.env.AKAMARU_PORT || 4317);
      const host = o.host || process.env.AKAMARU_HOST || '127.0.0.1';
      await A.startServer({ port, host });
      return out(`Akamaru dashboard running at http://${host}:${port}  (previews: ${settings.publicUrl}/preview/...)`);
    }
    default: return out(HELP);
  }
}

main().catch((e) => {
  console.error(`akamaru: ${e.message}`);
  process.exit(1);
});
