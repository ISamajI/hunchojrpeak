(async function () {
  const $ = (id) => document.getElementById(id);
  $('logout').onclick = logout;
  const cfg = await loadConfig();
  const me = (await api('/api/me')).user;
  $('who').textContent = me.name;

  let ret = await api('/api/return');
  let data = ret.data || {};
  let files = ret.files || [];
  $('loading').classList.add('hidden');

  // Prefill from account.
  if (!data.email) data.email = me.email;
  if (!data.first_name && !data.last_name && me.name) {
    const parts = me.name.trim().split(/\s+/);
    data.first_name = parts[0]; if (parts.length > 1) data.last_name = parts[parts.length - 1];
  }

  if (!ret.editable) return showStatus();

  // ---------- Wizard ----------
  const STEPS = [...TAX_SCHEMA.map((s) => ({ ...s, kind: 'form' })),
    { id: 'docs', title: 'Documents', kind: 'docs', intro: 'Snap a photo or upload PDFs. Everything is encrypted.' },
    { id: 'sign', title: 'Review & Sign', kind: 'sign', intro: `Check your answers, then sign to send everything to ${cfg.preparerName}.` }];
  let idx = Math.min(Number(sessionStorage.getItem('step') || 0), STEPS.length - 1);
  let mounted = null;

  if (ret.status === 'needs_info' && ret.ownerNote) {
    const n = $('needsInfo');
    n.classList.remove('hidden');
    n.append(el('strong', { text: `${cfg.preparerName} needs a little more information: ` }), ret.ownerNote,
      el('div', { class: 'small', text: 'Update your answers or upload documents, then sign and re-submit on the last step.' }));
  }
  $('wizard').classList.remove('hidden');

  // Autosave (debounced)
  let saveTimer = null, saving = Promise.resolve();
  function queueSave() {
    $('saveState').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    saving = api('/api/return', { method: 'PUT', body: { data } })
      .then(() => ($('saveState').textContent = 'All changes saved ✓'))
      .catch((e) => ($('saveState').textContent = 'Not saved: ' + e.message));
    return saving;
  }
  window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });

  function drawSteps() {
    const nav = $('steps'); nav.innerHTML = '';
    STEPS.forEach((s, i) => {
      const done = s.kind === 'form' ? sectionComplete(s, data) : s.kind === 'docs' ? files.length > 0 : false;
      nav.append(el('button', { type: 'button', class: 'step' + (i === idx ? ' active' : '') + (done && i !== idx ? ' done' : ''),
        onclick: () => go(i) }, el('span', { class: 'n', text: done && i !== idx ? '✓' : String(i + 1) }), s.title));
    });
    $('bar').style.width = Math.round((idx / (STEPS.length - 1)) * 100) + '%';
  }

  function go(i) {
    if (saveTimer) saveNow();
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    sessionStorage.setItem('step', idx);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    const s = STEPS[idx];
    $('stepTitle').textContent = s.title;
    $('stepIntro').textContent = s.intro || '';
    const body = $('stepBody'); body.innerHTML = '';
    $('back').classList.toggle('hidden', idx === 0);
    $('next').classList.toggle('hidden', s.kind === 'sign');
    mounted = null;
    if (s.kind === 'form') mounted = mountStep(body, s.fields, data, { onChange: queueSave });
    else if (s.kind === 'docs') body.append(uploader(true));
    else body.append(signStep());
    drawSteps();
  }

  $('back').onclick = () => go(idx - 1);
  $('next').onclick = () => {
    if (mounted && !mounted.validate()) return toast('Please fix the highlighted fields.');
    go(idx + 1);
  };

  // ---------- Documents ----------
  function uploader(editable) {
    const box = el('div');
    box.append(el('p', { class: 'small muted', text: 'Commonly needed:' }),
      el('ul', { class: 'checklist' }, ['Photo ID (front & back) for you and spouse', 'Social Security cards for everyone on the return',
        'All W-2s and 1099s', '1098 mortgage / tuition / student loan forms', '1095-A if you had Marketplace insurance',
        'Last year’s tax return (new clients)', 'Business income & expense summary', 'Any IRS or state letters'].map((t) => el('li', { text: t }))));
    const cat = el('select', {}, DOC_CATEGORIES.map((c) => el('option', { value: c, text: c })));
    const inp = el('input', { type: 'file', multiple: true, accept: 'application/pdf,image/*', class: 'hidden' });
    const drop = el('div', { class: 'drop' }, el('strong', { text: '📎 Tap to choose files or take a photo' }),
      el('div', { class: 'small muted', text: 'PDF, JPG, PNG or HEIC · up to 15 MB each' }));
    const status = el('div', { class: 'small muted' });
    const list = el('ul', { class: 'filelist' });

    const drawList = () => {
      list.innerHTML = '';
      if (!files.length) list.append(el('li', { class: 'muted', text: 'No documents uploaded yet.' }));
      for (const f of files) {
        list.append(el('li', {},
          el('span', {}, el('a', { href: `/api/return/files/${f.id}`, target: '_blank', rel: 'noopener', text: f.orig_name }), ' ',
            el('span', { class: 'cat', text: f.category }), ' ', el('span', { class: 'muted small', text: fmtSize(f.size) })),
          editable ? el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Remove', onclick: async () => {
            try { files = (await api(`/api/return/files/${f.id}`, { method: 'DELETE' })).files; drawList(); drawSteps?.(); } catch (e) { toast(e.message); }
          } }) : null));
      }
    };
    async function send(fl) {
      if (!fl.length) return;
      const fd = new FormData();
      [...fl].forEach((f) => fd.append('files', f));
      fd.append('category', cat.value);
      status.textContent = `Uploading ${fl.length} file(s)…`;
      try {
        files = (await api('/api/return/files', { method: 'POST', body: fd })).files;
        status.textContent = 'Uploaded ✓';
        drawList(); if (editable) drawSteps();
      } catch (e) { status.textContent = e.message; }
      inp.value = '';
    }
    drop.onclick = () => inp.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); send(e.dataTransfer.files); };
    inp.onchange = () => send(inp.files);

    box.append(el('div', { class: 'grid' }, el('div', { class: 'f half' }, el('label', { class: 'lbl', text: 'What are you uploading?' }), cat)),
      el('br'), drop, inp, status, list);
    drawList();
    return box;
  }

  // ---------- Review & sign ----------
  function signStep() {
    const box = el('div');
    const incomplete = TAX_SCHEMA.filter((s) => !sectionComplete(s, data));
    if (incomplete.length) {
      box.append(el('div', { class: 'alert alert-err' }, 'Please finish these sections before signing: ',
        incomplete.map((s, i) => [i ? ', ' : '', el('a', { href: '#', text: s.title, onclick: (e) => { e.preventDefault(); go(STEPS.indexOf(STEPS.find((x) => x.id === s.id))); } })])));
    }
    if (!files.length) box.append(el('div', { class: 'alert alert-warn', text: 'You haven’t uploaded any documents yet. You can still submit and upload them later.' }));
    box.append(el('br'), renderSummary(data, { mask: true, onEdit: (i) => go(i) }));
    box.append(el('div', { class: 'review-sec' }, el('h3', { text: 'Documents' }),
      el('p', { class: 'small', text: files.length ? files.map((f) => f.orig_name).join(', ') : 'None yet' })));

    const legal = [data.first_name, data.middle_initial, data.last_name, data.suffix].filter(Boolean).join(' ');
    box.append(el('h3', { text: 'Authorization & Signature' }),
      el('div', { class: 'consent' },
        el('p', {}, `I authorize ${cfg.businessName} to prepare my ${cfg.taxYear} federal and state income tax returns using the information and documents I have provided through this portal.`),
        el('p', {}, 'Under penalties of perjury, I declare that the information I provided is true, correct, and complete to the best of my knowledge. I understand that I am responsible for the accuracy of this information and for keeping records that support it, and that my preparer relies on it without independent verification.'),
        el('p', {}, 'I consent to the use of my electronic signature, which has the same effect as my handwritten signature. I understand I will be asked to review and approve my completed return (including IRS Form 8879, if e-filing) before it is filed.'),
        el('p', {}, 'I consent to the secure electronic storage of my information for the purpose of preparing my tax return.')));

    const canvas = el('canvas');
    const pad = el('div', { class: 'sigbox' }, el('span', { class: 'x', text: '✕' }), el('div', { class: 'line' }), canvas);
    const sig = signaturePad(canvas);
    const nameIn = el('input', { type: 'text', autocomplete: 'off', placeholder: legal || 'Full legal name' });
    const agree = el('input', { type: 'checkbox' });
    const err = el('div', { class: 'alert alert-err hidden' });
    const btn = el('button', { class: 'btn btn-success btn-block', type: 'button', text: ret.status === 'needs_info' ? 'Sign & re-submit' : `Sign & send to ${cfg.preparerName}` });

    box.append(el('div', { class: 'grid' },
      el('div', { class: 'f' }, el('div', { class: 'lbl' }, 'Draw your signature', el('span', { class: 'req', text: '*' })), pad,
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Clear signature', onclick: () => sig.clear() })),
      el('div', { class: 'f half' }, el('label', { class: 'lbl' }, 'Type your full legal name', el('span', { class: 'req', text: '*' })), nameIn),
      el('div', { class: 'f half' }, el('div', { class: 'lbl', text: 'Date' }), el('input', { type: 'text', disabled: true, value: new Date().toLocaleDateString() })),
      el('div', { class: 'f' }, el('label', { class: 'choice' }, agree, 'I have read and agree to the authorization above, and I confirm my answers are accurate.'))),
      el('br'), err, el('br'), btn);

    btn.onclick = async () => {
      err.classList.add('hidden');
      const problem = incomplete.length ? 'Finish the sections listed at the top first.'
        : sig.isEmpty() ? 'Please draw your signature.'
        : nameIn.value.trim().length < 3 ? 'Type your full legal name.'
        : !agree.checked ? 'Check the box to agree to the authorization.' : null;
      if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        clearTimeout(saveTimer); await saving;
        await api('/api/return/submit', { method: 'POST', body: { data, signature: sig.toDataURL(), signedName: nameIn.value.trim(), agree: true } });
        saveTimer = null;
        sessionStorage.removeItem('step');
        ret = await api('/api/return');
        $('wizard').classList.add('hidden');
        showStatus();
        window.scrollTo(0, 0);
      } catch (e) {
        err.textContent = e.message; err.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Sign & submit';
      }
    };
    return box;
  }

  function signaturePad(canvas) {
    let ctx, drawing = false, strokes = 0, last = null;
    const setup = () => {
      const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      if (!r.width) return requestAnimationFrame(setup);
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f3a';
    };
    requestAnimationFrame(setup);
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => { if (!ctx) return; drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); strokes++;
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fill(); });
    canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => canvas.addEventListener(t, () => (drawing = false)));
    return {
      clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; },
      isEmpty: () => strokes === 0,
      toDataURL: () => canvas.toDataURL('image/png'),
    };
  }

  // ---------- Status (after submit) ----------
  function showStatus() {
    $('status').classList.remove('hidden');
    const st = ret.status;
    const copy = {
      submitted: ['📨', 'Thank you! Your information was received.', `${cfg.preparerName} has been notified and will start on your return soon. She’ll reach out if anything else is needed.`],
      in_progress: ['🧾', 'Your return is being prepared.', `${cfg.preparerName} is working on your taxes now. She’ll contact you to review and sign the final return.`],
      completed: ['✅', 'Your return is complete!', `${cfg.preparerName} has finished your return. Thank you for your business!`],
    }[st] || ['📨', 'Submitted', ''];
    $('statusIcon').textContent = copy[0]; $('statusTitle').textContent = copy[1]; $('statusText').textContent = copy[2];
    if (ret.ownerNote && st !== 'needs_info') $('statusText').append(el('div', { class: 'alert alert-ok', text: `Note from ${cfg.preparerName}: ` + ret.ownerNote }));
    const order = ['submitted', 'in_progress', 'completed'];
    const at = order.indexOf(st);
    $('timeline').innerHTML = '';
    ['Submitted', 'In progress', 'Completed'].forEach((t, i) =>
      $('timeline').append(el('div', { class: 't' + (i <= at ? ' on' : '') }, el('div', { class: 'dot', text: i <= at ? '✓' : '' }), t)));
    $('signedLine').textContent = ret.signedAt ? `Signed by ${ret.signedName} on ${fmtDate(ret.signedAt)}` : '';
    const lu = $('lateUploadBody'); lu.innerHTML = '';
    if (st === 'completed') $('lateUpload').classList.add('hidden'); else lu.append(uploader(false));
  }

  $('pwForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/change-password', { method: 'POST', body: { current: $('pw-cur').value, next: $('pw-new').value } });
      toast('Password changed.'); $('pw-cur').value = $('pw-new').value = '';
    } catch (err) { toast(err.message); }
  };

  render();
})();
