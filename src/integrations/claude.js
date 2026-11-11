// Claude API via the official Anthropic SDK. Used for research synthesis,
// demo copy, outreach drafting and reply classification. Every caller has a
// deterministic fallback, so the system keeps working when no key is set.
import Anthropic from '@anthropic-ai/sdk';
import { env, isConfigured, settings } from '../config.js';

let client = null;

export function claudeAvailable() {
  return isConfigured('anthropic');
}

function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: env('ANTHROPIC_API_KEY'),
      // Explicit base URL so a host-level ANTHROPIC_BASE_URL can't silently redirect business data.
      baseURL: env('AKAMARU_ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
      maxRetries: 2,
    });
  }
  return client;
}

export class ClaudeRefusal extends Error {}

/**
 * Ask Claude for JSON matching `schema` (structured outputs).
 * @returns {Promise<object>}
 */
export async function generateJson({ system, prompt, schema, maxTokens = 8000, effort = 'medium' }) {
  const response = await getClient().beta.messages.create({
    model: settings.model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  });
  if (response.stop_reason === 'refusal') {
    throw new ClaudeRefusal(`Claude declined (${response.stop_details?.category || 'unspecified'})`);
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude response hit max_tokens before finishing');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

/** Used by tests to inject a fake client. */
export function _setClient(c) {
  client = c;
}
