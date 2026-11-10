// Generic form renderer / validator / summary for TAX_SCHEMA.
(function () {
  let uid = 0;

  function formatSSN(v) {
    const d = v.replace(/\D/g, '').slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  }
  function formatPhone(v) {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Renders fields into a .grid container. `scope` is the object values live in; `root` is top-level data.
  // `onChange()` is called after any edit; `rerender()` re-draws the whole step (used for repeats).
  function renderFields(container, fields, scope, root, ctx) {
    for (const field of fields) {
      if (field.type === 'note') {
        const n = el('div', { class: 'note-h', text: field.text });
        ctx.watch.push({ node: n, field, scope, root });
        container.append(n);
        continue;
      }
      if (field.type === 'repeat') { renderRepeat(container, field, scope, root, ctx); continue; }

      const id = 'f' + (++uid);
      const wrap = el('div', { class: 'f' + (field.half ? ' half' : '') + (field.third ? ' third' : '') });
      wrap._field = field; wrap._scope = scope;
      const lbl = field.type === 'checkboxes' || field.type === 'radio' || field.type === 'yesno'
        ? el('div', { class: 'lbl' }, field.label, field.required ? el('span', { class: 'req', text: '*' }) : null)
        : el('label', { class: 'lbl', for: id }, field.label, field.required ? el('span', { class: 'req', text: '*' }) : null);
      wrap.append(lbl);

      const set = (v) => { scope[field.name] = v; ctx.onChange(); wrap.classList.remove('err'); };
      const val = scope[field.name];
      let input;

      if (field.type === 'select') {
        input = el('select', { id }, el('option', { value: '', text: 'Select…' }), field.options.map((o) => el('option', { value: o, text: o })));
        input.value = val || '';
        input.onchange = () => set(input.value);
      } else if (field.type === 'textarea') {
        input = el('textarea', { id, maxlength: 4000 });
        input.value = val || '';
        input.oninput = () => set(input.value);
      } else if (field.type === 'radio' || field.type === 'yesno') {
        const opts = field.type === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : field.options.map((o) => [o, o]);
        input = el('div', { class: 'choices' + (field.type === 'radio' && opts.length > 2 ? ' col' : '') });
        const nm = 'r' + id;
        for (const [v, t] of opts) {
          const r = el('input', { type: 'radio', name: nm, value: v });
          r.checked = val === v;
          r.onchange = () => set(v);
          input.append(el('label', { class: 'choice' }, r, t));
        }
      } else if (field.type === 'checkboxes') {
        input = el('div', { class: 'choices col' });
        const cur = new Set(Array.isArray(val) ? val : []);
        for (const o of field.options) {
          const c = el('input', { type: 'checkbox', value: o });
          c.checked = cur.has(o);
          c.onchange = () => {
            c.checked ? cur.add(o) : cur.delete(o);
            if (c.checked && /^(None of these|No income)$/.test(o)) { cur.clear(); cur.add(o); input.querySelectorAll('input').forEach((x) => (x.checked = x.value === o)); }
            else if (c.checked) { input.querySelectorAll('input').forEach((x) => { if (/^(None of these|No income)$/.test(x.value)) { x.checked = false; cur.delete(x.value); } }); }
            set(field.options.filter((x) => cur.has(x)));
          };
          input.append(el('label', { class: 'choice' }, c, o));
        }
      } else {
        const type = { email: 'email', tel: 'tel', date: 'date', number: 'number' }[field.type] || 'text';
        const box = el('input', { id, type, maxlength: field.max || 200, autocomplete: field.sensitive ? 'off' : null,
          inputmode: field.type === 'ssn' || field.type === 'money' ? 'numeric' : null,
          min: field.min, max: field.type === 'number' ? field.max : null, placeholder: field.type === 'ssn' ? '123-45-6789' : null });
        box.value = val ?? '';
        box.oninput = () => {
          if (field.type === 'ssn') box.value = formatSSN(box.value);
          if (field.type === 'tel') box.value = formatPhone(box.value);
          if (field.type === 'money') box.value = box.value.replace(/[^\d.,]/g, '');
          set(box.value);
        };
        input = field.type === 'money' ? el('div', { class: 'money' }, box) : box;
      }
      wrap.append(input);
      if (field.help) wrap.append(el('div', { class: 'help', text: field.help }));
      wrap.append(el('div', { class: 'errmsg' }));
      if (ctx.readOnly) wrap.querySelectorAll('input,select,textarea').forEach((x) => (x.disabled = true));
      ctx.watch.push({ node: wrap, field, scope, root });
      container.append(wrap);
    }
  }

  function renderRepeat(container, field, scope, root, ctx) {
    const box = el('div', { class: 'f' });
    box._field = field; box._scope = scope;
    ctx.watch.push({ node: box, field, scope, root });
    if (!Array.isArray(scope[field.name]) || !scope[field.name].length) scope[field.name] = [{}];
    const list = scope[field.name];
    const grid = el('div', { class: 'grid' });
    list.forEach((row, i) => {
      const item = el('div', { class: 'repeat-item' });
      const head = el('div', { class: 'rh' }, `${field.label} ${i + 1}`);
      if (list.length > 1 && !ctx.readOnly) {
        head.append(el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Remove',
          onclick: () => { list.splice(i, 1); ctx.onChange(); ctx.rerender(); } }));
      }
      const g = el('div', { class: 'grid' });
      renderFields(g, field.fields, row, root, ctx);
      item.append(head, g);
      grid.append(item);
    });
    box.append(grid);
    if (!ctx.readOnly) {
      box.append(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: field.addLabel || '+ Add',
        onclick: () => { list.push({}); ctx.onChange(); ctx.rerender(); } }));
    }
    container.append(box);
  }

  function refreshVisibility(ctx) {
    for (const w of ctx.watch) {
      // A field nested in a hidden ancestor is hidden anyway; just evaluate its own rule.
      w.node.classList.toggle('hidden', !isVisible(w.field, w.scope, w.root));
    }
  }

  // Returns true if valid; marks errors in DOM.
  function validate(ctx, silent) {
    let firstBad = null;
    for (const w of ctx.watch) {
      const { node, field, scope } = w;
      if (!node.classList.contains('f') || field.type === 'repeat') continue;
      if (node.closest('.hidden')) continue;
      const v = scope[field.name];
      let msg = '';
      const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
      if (field.required && empty) msg = 'This is required.';
      else if (!empty && field.type === 'ssn' && String(v).replace(/\D/g, '').length !== 9) msg = 'Enter all 9 digits.';
      else if (!empty && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Enter a valid email.';
      else if (!empty && field.type === 'tel' && String(v).replace(/\D/g, '').length !== 10) msg = 'Enter a 10-digit phone number.';
      else if (!empty && field.pattern && !new RegExp(field.pattern).test(String(v).trim())) msg = field.patternMsg || 'Invalid format.';
      else if (field.matches && v !== scope[field.matches]) msg = 'Does not match.';
      node.classList.toggle('err', !!msg);
      node.querySelector('.errmsg').textContent = msg;
      if (msg && !firstBad) firstBad = node;
    }
    if (firstBad && !silent) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !firstBad;
  }

  window.mountStep = function (container, fields, data, { onChange, readOnly } = {}) {
    const ctx = { watch: [], readOnly, onChange: () => { onChange?.(); refreshVisibility(ctx); } };
    ctx.rerender = () => {
      container.innerHTML = '';
      ctx.watch = [];
      const g = el('div', { class: 'grid' });
      renderFields(g, fields, data, data, ctx);
      container.append(g);
      refreshVisibility(ctx);
    };
    ctx.rerender();
    return { validate: (silent) => validate(ctx, silent) };
  };

  // Validate a whole section without rendering (used before submit).
  window.sectionComplete = function (section, data) {
    const tmp = document.createElement('div'); // detached: never shown
    return mountStep(tmp, section.fields, structuredClone(data)).validate(true);
  };

  // Read-only summary. opts.mask: mask sensitive values with a reveal button.
  window.renderSummary = function (data, opts = {}) {
    const out = el('div');
    const mk = (field, v) => {
      const s = displayValue(field, v);
      if (s == null) return null;
      if (!field.sensitive || !opts.mask) return el('span', { text: s });
      const masked = s.length > 4 ? '•••• ' + s.slice(-4) : '••••';
      const full = el('span', { class: 'full hidden', text: s });
      const m = el('span', { class: 'mask', text: masked });
      return el('span', { class: 'secret' }, m, full,
        el('button', { class: 'reveal no-print', type: 'button', text: 'show', onclick: (e) => {
          const hid = full.classList.toggle('hidden'); m.classList.toggle('hidden', !hid); e.target.textContent = hid ? 'show' : 'hide'; } }));
    };
    const kv = (fields, scope) => {
      const dl = el('dl', { class: 'kv' });
      for (const f of fields) {
        if (f.type === 'note' || !isVisible(f, scope, data)) continue;
        if (f.type === 'repeat') {
          const rows = (scope[f.name] || []).filter((r) => Object.values(r).some((x) => x !== '' && x != null));
          if (!rows.length) continue;
          dl.append(el('dt', { text: f.plural || (f.label + 's').replace(/sss$/, 'sses') }), el('dd', {}, rows.map((r, i) =>
            el('div', { class: 'subcard' }, el('strong', { text: `${f.label} ${i + 1}` }), kv(f.fields, r)))));
          continue;
        }
        if (f.name === 'account_confirm') continue;
        const v = mk(f, scope[f.name]);
        if (v) dl.append(el('dt', { text: f.label }), el('dd', {}, v));
      }
      return dl;
    };
    TAX_SCHEMA.forEach((sec, i) => {
      const h = el('h3', {}, sec.title);
      if (opts.onEdit) h.append(el('button', { class: 'btn btn-ghost btn-sm no-print', type: 'button', text: 'Edit', onclick: () => opts.onEdit(i) }));
      const body = kv(sec.fields, data);
      out.append(el('div', { class: 'review-sec' }, h, body.childNodes.length ? body : el('p', { class: 'muted small', text: 'Nothing entered.' })));
    });
    return out;
  };
})();
