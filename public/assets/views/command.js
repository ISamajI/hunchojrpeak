// AI COMMAND CENTER — talk to AKUMARU; every command maps to a real operation.
import { h, clear, fmt, toast, errorBox } from '../lib/dom.js';
import { icon, brandMark } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { jobCard, approvalCard } from './_shared.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/** Progressive reveal of a response that already arrived (typing effect, honest: no fake latency beyond ~0.6s). */
function reveal(el, text) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || text.length < 4) { el.textContent = text; return; }
  const total = Math.min(600, text.length * 8);
  const start = performance.now();
  const step = (t) => {
    const n = Math.ceil((Math.min(1, (t - start) / total)) * text.length);
    el.textContent = text.slice(0, n);
    if (n < text.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default async function command(root, ctx) {
  const scroll = h('div', { class: 'thread-scroll', 'aria-live': 'polite' });
  const input = h('textarea', { rows: 1, placeholder: 'Tell AKUMARU what to do — e.g. "Find 20 businesses around Hamilton that need websites"', 'aria-label': 'Command', dataset: { commandInput: '1' } });
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'hidden', 'aria-label': 'Import leads CSV' });
  const sendBtn = h('button', { class: 'btn primary', 'aria-label': 'Send command', title: 'Send (Enter)' }, icon('send'));
  const micBtn = SpeechRecognition ? h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Voice command', title: 'Voice command' }, icon('mic')) : null;
  const attachBtn = h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Attach a CSV of leads to import', title: 'Attach a CSV of leads (name, category, city, phone, email, website)', onclick: () => fileInput.click() }, icon('paperclip'));
  const suggestions = h('div', { class: 'suggestions' });
  const form = h('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('div', { class: 'composer-box' }, attachBtn, micBtn, input, sendBtn), suggestions, fileInput);
  const thread = h('section', { class: 'panel thread' },
    h('header', { class: 'panel-head' }, h('h2', { text: 'Conversation' }), h('span', { class: 'eyebrow', text: 'COMMAND HISTORY' }),
      h('div', { class: 'chart-card-tools' }, h('span', { class: 'muted', style: { fontSize: '11px' } }, h('span', { class: 'kbd', text: 'Enter' }), ' send · ', h('span', { class: 'kbd', text: 'Shift+Enter' }), ' new line'))),
    scroll, form);
  const opsBox = h('div', { class: 'stack', style: { gap: '8px' } });
  const apprBox = h('div', { class: 'list' });
  const rail = h('aside', { class: 'stack rail', style: { minHeight: 0, overflowY: 'auto' } },
    h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Executing' })), h('div', { class: 'panel-body' }, opsBox)),
    h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Awaiting your approval' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/approvals' }, icon('right')))), h('div', { style: { maxHeight: '360px', overflowY: 'auto' } }, apprBox)),
    h('section', { class: 'panel pad' }, h('div', { class: 'eyebrow', text: 'CAPABILITIES' }),
      h('ul', { class: 'dim', style: { margin: '8px 0 0', paddingLeft: '16px', fontSize: '12px', lineHeight: '1.8' } },
        ['Discover & research businesses', 'Build and deploy demos', 'Find unresponsive prospects', 'Summarize today', 'Analyze revenue & pipeline', 'Draft marketing (needs Claude)', 'Check site uptime', 'Import leads from CSV'].map((t) => h('li', { text: t })))));
  root.append(h('div', { class: 'command-layout' }, thread, rail));

  const jobEls = new Map();
  const bottom = () => requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });

  function aiMessage(children) {
    return h('div', { class: 'msg ai' }, h('div', { style: { width: '26px', flex: 'none' } }, brandMark()), h('div', { class: 'body' }, h('div', { class: 'who', text: ctx.state.meta?.brand || 'AKUMARU' }), children));
  }

  function renderResponse(res, { animate = false } = {}) {
    const r = res.response || res;
    const parts = [];
    if (r.title) parts.push(h('div', { style: { fontWeight: 600, marginBottom: '4px' }, text: r.title }));
    if (r.text) {
      const t = h('div', { class: 'txt', style: r.kind === 'error' ? { color: 'var(--critical-text)' } : {} });
      animate ? reveal(t, r.text) : (t.textContent = r.text);
      parts.push(t);
    }
    if (r.kind === 'job' && r.jobId) {
      const holder = h('div', {});
      jobEls.set(r.jobId, holder);
      api.get(`/api/jobs/${r.jobId}`).then((j) => { const pinned = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80; holder.replaceChildren(jobCard(j, { expanded: true })); if (pinned) bottom(); }).catch(() => {});
      parts.push(holder);
    }
    if (r.kind === 'table' && r.rows) {
      parts.push(h('div', { class: 'table-wrap mt', style: { maxHeight: '320px', border: '1px solid var(--line)', borderRadius: '8px' } },
        h('table', { class: 'data' }, h('thead', {}, h('tr', {}, r.columns.map((c) => h('th', { text: c.replace(/_/g, ' ') })))),
          h('tbody', {}, r.rows.map((row) => h('tr', { class: r.linkBase ? 'click' : '', onclick: r.linkBase ? () => (location.hash = r.linkBase + row.id) : null }, r.columns.map((c) => h('td', { class: c === 'id' ? 'mono muted' : '', text: c === 'last_contacted' ? fmt.ago(row[c]) : row[c] ?? '—' }))))))));
      if (r.hint) parts.push(h('div', { class: 'muted mt', style: { fontSize: '12px' }, text: r.hint }));
    }
    if (r.kind === 'summary' && r.items) {
      parts.push(h('div', { class: 'grid cols-3 mt', style: { gap: '8px' } }, r.items.map((it) => h('div', { class: 'panel pad', style: { padding: '10px 12px' } }, h('div', { class: 'muted', style: { fontSize: '11px' }, text: it.label }), h('div', { style: { fontSize: '20px', fontWeight: 600 }, class: 'num', text: fmt.num(it.value) })))));
    }
    if (r.suggestions) parts.push(h('div', { class: 'suggestions' }, r.suggestions.map((s) => h('button', { type: 'button', class: 'suggestion', text: s, onclick: () => run(s) }))));
    if (r.link) parts.push(h('div', { class: 'mt' }, h('a', { class: 'btn sm', href: r.link }, 'Open', icon('right'))));
    if (res.parser === 'claude') parts.push(h('div', { class: 'muted mt', style: { fontSize: '10.5px', fontFamily: 'var(--mono)' }, text: 'Interpreted by Claude' }));
    return aiMessage(parts);
  }

  function userMessage(text, at) {
    return h('div', { class: 'msg me' }, h('div', { class: 'txt', text }), at && h('div', { class: 'muted', style: { fontSize: '10.5px', marginTop: '3px', textAlign: 'right' }, text: fmt.ago(at) }));
  }

  async function run(text) {
    const t = String(text || '').trim();
    if (!t) return;
    input.value = '';
    autosize();
    scroll.querySelector('.welcome')?.remove();
    scroll.append(userMessage(t));
    const thinking = aiMessage(h('div', { class: 'op-step' }, h('span', { class: 'caret' }), h('span', { text: 'Interpreting command…' })));
    scroll.append(thinking);
    bottom();
    sendBtn.disabled = true;
    try {
      const res = await api.post('/api/commands', { text: t });
      thinking.replaceWith(renderResponse(res, { animate: true }));
      ctx.refreshStatus();
    } catch (e) {
      thinking.replaceWith(aiMessage(errorBox(e)));
    } finally {
      sendBtn.disabled = false;
      bottom();
      input.focus();
    }
  }
  const submit = () => run(input.value);

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });

  if (micBtn) {
    let rec = null;
    micBtn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = true;
      micBtn.classList.add('primary');
      rec.onresult = (e) => { input.value = [...e.results].map((r) => r[0].transcript).join(''); autosize(); };
      rec.onerror = (e) => toast('Voice input unavailable', e.error === 'not-allowed' ? 'Microphone permission was denied.' : e.error, 'high');
      rec.onend = () => { micBtn.classList.remove('primary'); rec = null; if (input.value.trim()) submit(); };
      rec.start();
    });
  }

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 1_000_000) return toast('File too large', 'CSV imports are limited to 1 MB.', 'high');
    scroll.append(userMessage(`📎 ${f.name} (${fmt.bytes(f.size)})`));
    try {
      const r = await api.postText('/api/import/leads', await f.text());
      scroll.append(aiMessage([h('div', { style: { fontWeight: 600 }, text: 'Leads imported' }),
        h('div', { class: 'txt', text: `${r.created} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped (no name)` : ''}.${r.errors.length ? `\n${r.errors.length} row(s) had errors:\n${r.errors.slice(0, 5).join('\n')}` : ''}` }),
        h('div', { class: 'suggestions' }, h('a', { class: 'suggestion', href: '#/leads', text: 'View leads' }))]));
    } catch (e) { scroll.append(aiMessage(errorBox(e))); }
    bottom();
  });

  ctx.onLive((type, j) => {
    if (type !== 'job') return;
    const holder = jobEls.get(j.id);
    if (holder) holder.replaceChildren(jobCard(j, { expanded: true }));
    renderOps();
  });
  ctx.onState(renderOps);
  function renderOps() {
    clear(opsBox);
    if (!ctx.state.jobs.length) opsBox.append(h('div', { class: 'muted', style: { fontSize: '12px' }, text: 'Nothing executing. Agents are on standby.' }));
    ctx.state.jobs.forEach((j) => opsBox.append(jobCard(j)));
  }
  async function loadApprovals() {
    try {
      const list = await api.get('/api/approvals');
      clear(apprBox);
      if (!list.length) apprBox.append(h('div', { class: 'muted', style: { padding: '14px 16px', fontSize: '12px' }, text: 'Nothing waiting.' }));
      list.slice(0, 5).forEach((a) => apprBox.append(approvalCard(a, () => { loadApprovals(); ctx.refreshStatus(); })));
    } catch (e) { apprBox.replaceChildren(errorBox(e)); }
  }
  ctx.onLive((type, a) => { if (type === 'activity' && /approval_/.test(a.action)) loadApprovals(); });

  // History, oldest first
  try {
    const [hist, meta] = await Promise.all([api.get('/api/commands?limit=30'), ctx.state.meta ? Promise.resolve(ctx.state.meta) : api.get('/api/meta')]);
    suggestions.append(...meta.suggestions.slice(0, 6).map((s) => h('button', { type: 'button', class: 'suggestion', text: s, onclick: () => run(s) })));
    if (!hist.length) {
      scroll.append(h('div', { class: 'welcome' }, aiMessage([h('div', { class: 'txt', text: `I'm ${meta.brand}, the operating intelligence behind ${meta.agency.name}. Tell me what you need — I'll run what I'm allowed to run on my own and queue anything binding for your approval.` })])));
    }
    for (const c of hist.reverse()) { scroll.append(userMessage(c.text, c.created_at)); scroll.append(renderResponse(c)); }
  } catch (e) { scroll.append(errorBox(e)); }
  renderOps();
  loadApprovals();
  bottom();
  setTimeout(bottom, 350);

  const pending = sessionStorage.getItem('akumaru_pending_cmd');
  if (pending) { sessionStorage.removeItem('akumaru_pending_cmd'); run(pending); } else input.focus();
  const onCmd = (e) => { sessionStorage.removeItem('akumaru_pending_cmd'); run(e.detail); };
  window.addEventListener('akumaru:command', onCmd);
  return () => window.removeEventListener('akumaru:command', onCmd);
}
