// Self-hosted typefaces (open-source, bundled from @fontsource) — no third-party font CDNs,
// so demos are fast, private and work offline.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../config.js';

const V = (pkg) => path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files');
const S = (pkg) => path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files');

export const FONTS = {
  fraunces: { family: 'Fraunces', fallback: 'Georgia, serif', files: [[V('fraunces'), 'fraunces-latin-wght-normal.woff2', '100 900', 'normal'], [V('fraunces'), 'fraunces-latin-wght-italic.woff2', '100 900', 'italic']] },
  instrument: { family: 'Instrument Serif', fallback: 'Georgia, serif', files: [[S('instrument-serif'), 'instrument-serif-latin-400-normal.woff2', '400', 'normal'], [S('instrument-serif'), 'instrument-serif-latin-400-italic.woff2', '400', 'italic']] },
  cormorant: { family: 'Cormorant Garamond', fallback: 'Georgia, serif', files: [[S('cormorant-garamond'), 'cormorant-garamond-latin-500-normal.woff2', '500', 'normal'], [S('cormorant-garamond'), 'cormorant-garamond-latin-500-italic.woff2', '500', 'italic'], [S('cormorant-garamond'), 'cormorant-garamond-latin-600-normal.woff2', '600', 'normal']] },
  dmserif: { family: 'DM Serif Display', fallback: 'Georgia, serif', files: [[S('dm-serif-display'), 'dm-serif-display-latin-400-normal.woff2', '400', 'normal'], [S('dm-serif-display'), 'dm-serif-display-latin-400-italic.woff2', '400', 'italic']] },
  bricolage: { family: 'Bricolage Grotesque', fallback: 'system-ui, sans-serif', files: [[V('bricolage-grotesque'), 'bricolage-grotesque-latin-wght-normal.woff2', '200 800', 'normal']] },
  intertight: { family: 'Inter Tight', fallback: 'system-ui, sans-serif', files: [[V('inter-tight'), 'inter-tight-latin-wght-normal.woff2', '100 900', 'normal'], [V('inter-tight'), 'inter-tight-latin-wght-italic.woff2', '100 900', 'italic']] },
  manrope: { family: 'Manrope', fallback: 'system-ui, sans-serif', files: [[V('manrope'), 'manrope-latin-wght-normal.woff2', '200 800', 'normal']] },
  spacegrotesk: { family: 'Space Grotesk', fallback: 'system-ui, sans-serif', files: [[V('space-grotesk'), 'space-grotesk-latin-wght-normal.woff2', '300 700', 'normal']] },
  syne: { family: 'Syne', fallback: 'system-ui, sans-serif', files: [[S('syne'), 'syne-latin-600-normal.woff2', '600', 'normal'], [S('syne'), 'syne-latin-800-normal.woff2', '800', 'normal']] },
  bebas: { family: 'Bebas Neue', fallback: 'Impact, sans-serif', files: [[S('bebas-neue'), 'bebas-neue-latin-400-normal.woff2', '400', 'normal']] },
  archivo: { family: 'Archivo', fallback: 'system-ui, sans-serif', files: [[V('archivo'), 'archivo-latin-wght-normal.woff2', '100 900', 'normal']] },
  unbounded: { family: 'Unbounded', fallback: 'system-ui, sans-serif', files: [[V('unbounded'), 'unbounded-latin-wght-normal.woff2', '200 900', 'normal']] },
};

/** Copy the font files a direction needs into the demo and return @font-face CSS. */
export function installFonts(keys, outDir) {
  fs.mkdirSync(path.join(outDir, 'fonts'), { recursive: true });
  const css = [];
  for (const key of [...new Set(keys)]) {
    const f = FONTS[key];
    if (!f) throw new Error(`Unknown font ${key}`);
    for (const [dir, file, weight, style] of f.files) {
      fs.copyFileSync(path.join(dir, file), path.join(outDir, 'fonts', file));
      css.push(`@font-face{font-family:"${f.family}";src:url(../fonts/${file}) format("woff2");font-weight:${weight};font-style:${style};font-display:swap}`);
    }
  }
  return css.join('\n');
}

export const stack = (key) => `"${FONTS[key].family}", ${FONTS[key].fallback}`;
