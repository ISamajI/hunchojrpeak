// SVG chart kit. Spec (dataviz method): bars ≤24px with 4px rounded data-end and
// square baseline; 2px lines; ≥8px end markers with a 2px surface ring; 1px solid
// recessive gridlines; one y-axis; legend for ≥2 series; crosshair tooltip listing
// every series; hit targets larger than marks; table view for every chart.
import { h, clear, showTip, hideTip, fmt } from './dom.js';

export const SERIES = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', muted: '#6c7689' };
const SURFACE = '#10141b';

function niceMax(max, ticks = 4) {
  if (!(max > 0)) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { max: step * ticks, step };
}

function xLabel(x, bucket) {
  if (bucket === 'month') { const [y, m] = x.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' }); }
  const d = new Date(x + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function observe(container, draw) {
  let w = 0;
  const ro = new ResizeObserver(() => {
    const nw = Math.floor(container.clientWidth);
    if (nw && nw !== w) { w = nw; draw(nw); }
  });
  ro.observe(container);
  return () => ro.disconnect();
}

/** Bar (column) chart, optional comparison line for the previous period (same unit, same axis). */
export function columnChart(container, { points, compare, format = (v) => fmt.num(v), height = 220, bucket = 'day', name = 'Value', compareName = 'Previous period' }) {
  container.classList.add('chart');
  return observe(container, (W) => {
    clear(container);
    const pad = { l: 52, r: 8, t: 10, b: 26 };
    const iw = W - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const values = points.map((p) => p.value).concat(compare ? compare.map((p) => p.value) : []);
    const { max, step } = niceMax(Math.max(0, ...values));
    const y = (v) => pad.t + ih - (v / max) * ih;
    const band = iw / Math.max(1, points.length);
    const bw = Math.max(2, Math.min(24, band * 0.62));
    const svg = h('svg', { viewBox: `0 0 ${W} ${height}`, height, role: 'img', 'aria-label': `${name} chart` });
    for (let v = 0; v <= max + 1e-9; v += step) {
      svg.append(h('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }));
      svg.append(h('text', { class: 'axis-text', x: pad.l - 8, y: y(v) + 3.5, 'text-anchor': 'end', text: format(v, true) }));
    }
    const every = Math.ceil(points.length / Math.max(1, Math.floor(iw / 64)));
    points.forEach((p, i) => {
      const cx = pad.l + band * i + band / 2;
      if (i % every === 0) svg.append(h('text', { class: 'axis-text', x: cx, y: height - 8, 'text-anchor': 'middle', text: xLabel(p.x, bucket) }));
      const bh = (p.value / max) * ih;
      if (p.value > 0) {
        const r = Math.min(4, bw / 2, bh);
        const x0 = cx - bw / 2, y0 = y(p.value), base = pad.t + ih;
        svg.append(h('path', { class: 'bar', fill: SERIES.blue, d: `M${x0},${base}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${base}Z` }));
      }
      const hit = h('rect', { class: 'hit', x: pad.l + band * i, y: pad.t, width: band, height: ih, tabindex: 0, 'aria-label': `${xLabel(p.x, bucket)}: ${format(p.value)}` });
      const show = (e) => {
        svg.querySelectorAll('.bar').forEach((b) => b.classList.add('dim'));
        showTip(e.clientX ? e : { clientX: hit.getBoundingClientRect().right, clientY: hit.getBoundingClientRect().top + 30 }, () => h('div', {},
          h('div', { class: 'tt-title', text: xLabel(p.x, bucket) + (bucket === 'week' ? ' (week)' : '') }),
          h('div', { class: 'tt-row' }, h('i', { style: { background: SERIES.blue } }), h('b', { text: format(p.value) }), h('span', { text: name })),
          compare?.[i] && h('div', { class: 'tt-row' }, h('i', { style: { background: SERIES.muted } }), h('b', { text: format(compare[i].value) }), h('span', { text: compareName }))));
      };
      hit.addEventListener('pointermove', show);
      hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', () => { hideTip(); svg.querySelectorAll('.bar').forEach((b) => b.classList.remove('dim')); });
      hit.addEventListener('blur', hideTip);
      svg.append(hit);
    });
    if (compare?.length) {
      const pts = compare.slice(0, points.length).map((p, i) => `${pad.l + band * i + band / 2},${y(p.value)}`).join(' ');
      svg.insertBefore(h('polyline', { points: pts, fill: 'none', stroke: SERIES.muted, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' }), svg.querySelector('.hit'));
    }
    svg.append(h('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih, stroke: 'rgba(148,163,184,.25)' }));
    container.append(svg);
    if (compare?.length) container.append(h('div', { class: 'legend', style: { marginTop: '8px' } },
      h('span', {}, h('i', { style: { background: SERIES.blue } }), name), h('span', {}, h('i', { class: 'line', style: { background: SERIES.muted } }), compareName)));
  });
}

/** Multi-series line chart with area wash, crosshair and all-series tooltip. */
export function lineChart(container, { series, format = (v) => fmt.num(v), height = 220, bucket = 'day', area = true }) {
  container.classList.add('chart');
  return observe(container, (W) => {
    clear(container);
    const pad = { l: 44, r: 12, t: 10, b: 26 };
    const iw = W - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const n = series[0]?.points.length || 0;
    const { max, step } = niceMax(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.value))));
    const x = (i) => pad.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1));
    const y = (v) => pad.t + ih - (v / max) * ih;
    const svg = h('svg', { viewBox: `0 0 ${W} ${height}`, height, role: 'img', 'aria-label': series.map((s) => s.name).join(', ') + ' over time' });
    for (let v = 0; v <= max + 1e-9; v += step) {
      svg.append(h('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }));
      svg.append(h('text', { class: 'axis-text', x: pad.l - 8, y: y(v) + 3.5, 'text-anchor': 'end', text: format(v, true) }));
    }
    const every = Math.ceil(n / Math.max(1, Math.floor(iw / 70)));
    series[0]?.points.forEach((p, i) => { if (i % every === 0) svg.append(h('text', { class: 'axis-text', x: x(i), y: height - 8, 'text-anchor': 'middle', text: xLabel(p.x, bucket) })); });
    for (const s of series) {
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join('');
      if (area && series.length <= 2) svg.append(h('path', { d: `${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: s.color, 'fill-opacity': 0.1 }));
      svg.append(h('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      const last = s.points.at(-1);
      if (last) svg.append(h('circle', { cx: x(n - 1), cy: y(last.value), r: 4, fill: s.color, stroke: SURFACE, 'stroke-width': 2 }));
    }
    const cross = h('line', { class: 'crosshair', y1: pad.t, y2: pad.t + ih, x1: 0, x2: 0, visibility: 'hidden' });
    const marks = series.map((s) => h('circle', { r: 4, fill: s.color, stroke: SURFACE, 'stroke-width': 2, cx: 0, cy: 0, visibility: 'hidden' }));
    svg.append(cross, ...marks);
    const hit = h('rect', { class: 'hit', x: pad.l, y: pad.t, width: iw, height: ih, tabindex: 0, 'aria-label': 'Hover or use arrow keys to read values' });
    let focusIdx = n - 1;
    const at = (i, e) => {
      i = Math.max(0, Math.min(n - 1, i));
      focusIdx = i;
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      series.forEach((s, k) => { marks[k].setAttribute('cx', x(i)); marks[k].setAttribute('cy', y(s.points[i].value)); marks[k].setAttribute('visibility', 'visible'); });
      const r = svg.getBoundingClientRect();
      showTip(e || { clientX: r.left + (x(i) / W) * r.width, clientY: r.top + 40 }, () => h('div', {},
        h('div', { class: 'tt-title', text: xLabel(series[0].points[i].x, bucket) + (bucket === 'week' ? ' (week)' : '') }),
        series.map((s) => h('div', { class: 'tt-row' }, h('i', { style: { background: s.color } }), h('b', { text: format(s.points[i].value) }), h('span', { text: s.name })))));
    };
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      at(Math.round(((px - pad.l) / iw) * (n - 1)), e);
    });
    hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') at(focusIdx - 1); if (e.key === 'ArrowRight') at(focusIdx + 1); });
    hit.addEventListener('focus', () => at(focusIdx));
    const off = () => { hideTip(); cross.setAttribute('visibility', 'hidden'); marks.forEach((m) => m.setAttribute('visibility', 'hidden')); };
    hit.addEventListener('pointerleave', off);
    hit.addEventListener('blur', off);
    svg.append(hit);
    container.append(svg);
    if (series.length >= 2) container.append(h('div', { class: 'legend', style: { marginTop: '8px' } }, series.map((s) => h('span', {}, h('i', { class: 'line', style: { background: s.color } }), s.name))));
  });
}

/** 12-ish point sparkline in a de-emphasis hue with the current point accented. */
export function sparkline(values, { color = SERIES.blue, height = 28 } = {}) {
  const W = 120;
  const max = Math.max(1, ...values);
  const n = values.length;
  const svg = h('svg', { viewBox: `0 0 ${W} ${height}`, preserveAspectRatio: 'none', class: 'spark', 'aria-hidden': 'true', style: { width: '100%', height: `${height}px` } });
  if (!n || values.every((v) => v === 0)) {
    svg.append(h('line', { x1: 0, x2: W, y1: height - 2, y2: height - 2, stroke: 'rgba(148,163,184,.2)', 'stroke-dasharray': '2 3' }));
    return svg;
  }
  const x = (i) => (n === 1 ? W : (W * i) / (n - 1));
  const y = (v) => height - 3 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  svg.append(h('path', { d: `${d}L${W},${height}L0,${height}Z`, fill: color, 'fill-opacity': 0.1 }));
  svg.append(h('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
  return svg;
}

/** Horizontal bars (ordinal stages / categories) — values labeled at the tip. */
export function hbars(rows, { format = (v) => fmt.num(v), color = SERIES.blue, onClick } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h('div', {}, rows.map((r) => h('div', { class: 'hbar', style: onClick ? { cursor: 'pointer' } : {}, onclick: onClick ? () => onClick(r) : null, title: `${r.label}: ${format(r.value)}` },
    h('span', { class: 'lbl', text: r.label }),
    h('span', { class: 'track' }, h('i', { style: { width: `${(r.value / max) * 100}%`, background: r.color || color } })),
    h('span', { class: 'v', text: format(r.value) }))));
}

/** Table view of any series — the accessible / exact-numbers path for every chart. */
export function seriesTable(series, { format = (v) => fmt.num(v), bucket = 'day' } = {}) {
  return h('div', { class: 'table-wrap', style: { maxHeight: '260px' } }, h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', { text: bucket === 'month' ? 'Month' : bucket === 'week' ? 'Week of' : 'Date' }), series.map((s) => h('th', { class: 'r', text: s.name })))),
    h('tbody', {}, series[0].points.map((p, i) => h('tr', {}, h('td', { class: 'mono', text: p.x }), series.map((s) => h('td', { class: 'r num', text: format(s.points[i].value) })))))));
}

/** Chart card with a chart/table toggle. */
export function chartCard({ title, eyebrow, tools, draw, table, cls = '' }) {
  const body = h('div', {});
  const cleanup = [];
  let mode = 'chart';
  const toggle = h('div', { class: 'seg', role: 'group', 'aria-label': 'View as' },
    h('button', { type: 'button', 'aria-pressed': 'true', text: 'Chart', onclick: (e) => setMode('chart', e.target) }),
    h('button', { type: 'button', 'aria-pressed': 'false', text: 'Table', onclick: (e) => setMode('table', e.target) }));
  function setMode(m, btn) {
    mode = m;
    toggle.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  }
  function render() {
    cleanup.splice(0).forEach((f) => f?.());
    clear(body);
    if (mode === 'table') body.append(table());
    else { const c = h('div', {}); body.append(c); cleanup.push(draw(c)); }
  }
  const el = h('section', { class: `panel ${cls}` },
    h('header', { class: 'panel-head' }, h('h2', { text: title }), eyebrow && h('span', { class: 'eyebrow', text: eyebrow }), h('div', { class: 'chart-card-tools' }, tools, table && toggle)),
    h('div', { class: 'panel-body' }, body));
  queueMicrotask(render);
  return el;
}
