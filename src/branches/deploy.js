// Preview deployment for demos. Vercel when connected; local dashboard preview otherwise.
// Production publishing is an owner-approval action.
import { getDb } from '../db.js';
import { log } from '../activity.js';
import { getBusiness, advanceStage } from '../crm.js';
import { isConfigured, settings } from '../config.js';
import { decide, registerExecutor, requestApproval } from '../decision.js';
import { deployStatic } from '../integrations/vercel.js';
import { addSite } from '../monitor.js';

function latestPassingDemo(businessId) {
  return getDb().prepare('SELECT * FROM demos WHERE business_id = ? AND qa_passed = 1 ORDER BY version DESC LIMIT 1').get(businessId);
}

export function localPreviewUrl(slug, version) {
  return `${settings.publicUrl.replace(/\/$/, '')}/preview/${slug}/v${version}/`;
}

export async function deployPreview(businessId) {
  const { mode } = decide('deploy_preview', { production: false });
  if (mode !== 'autonomous') throw new Error('Preview deploy unexpectedly requires approval');
  const business = getBusiness(businessId);
  const demo = latestPassingDemo(businessId);
  if (!demo) throw new Error(`No QA-passed demo for business ${businessId}; build one first`);
  let url;
  let provider;
  let warning = null;
  if (isConfigured('vercel')) {
    try {
      const res = await deployStatic({ dir: demo.dir, name: `ltgpeak-demo-${business.slug}` });
      url = res.url;
      provider = 'vercel';
    } catch (e) {
      warning = `Vercel deploy failed: ${e.message}. Fell back to local preview.`;
      log('orochimaru', 'vercel_deploy_failed', 'business', businessId, { error: e.message });
    }
  }
  if (!url) {
    url = localPreviewUrl(business.slug, demo.version);
    provider = 'local';
  }
  getDb().prepare('UPDATE demos SET preview_url = ?, deploy_provider = ? WHERE id = ?').run(url, provider, demo.id);
  advanceStage(businessId, 'preview_deployed', 'orochimaru');
  log('orochimaru', 'preview_deployed', 'business', businessId, { url, provider, warning });
  return { url, provider, warning, public: provider !== 'local' };
}

export function requestProductionPublish(businessId) {
  const business = getBusiness(businessId);
  const demo = latestPassingDemo(businessId);
  if (!demo) throw new Error('No QA-passed demo to publish');
  return requestApproval('publish_production', { businessId, demoId: demo.id }, `Publish ${business.name} demo v${demo.version} as the official production site`);
}

registerExecutor('publish_production', async ({ demoId }) => {
  const demo = getDb().prepare('SELECT * FROM demos WHERE id = ?').get(demoId);
  const business = getBusiness(demo.business_id);
  const res = await deployStatic({ dir: demo.dir, name: `ltgpeak-${business.slug}`, production: true });
  log('orochimaru', 'production_published', 'business', business.id, res);
  addSite({ url: res.url, businessId: business.id, label: business.name });
  return res;
});
