# Builds the J&B concept preview into the folder given as argv[1]:
#   /          the proposal for J&B (first thing Sean sees)
#   /website/  the redesigned website
# The concept strip marks it as a redesign preview; robots noindex keeps it out of search.
import os
import shutil
import sys

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = str(ROOT / 'jandbauto') + '/'
dist = sys.argv[1]
if os.path.isdir(dist):
    shutil.rmtree(dist)
out = os.path.join(dist, 'website')
shutil.copytree(src, out, ignore=shutil.ignore_patterns('tests', '*.md', '_headers'))
shutil.copy(src + '_headers', os.path.join(dist, '_headers'))


def rep(s, a, b):
    assert s.count(a) == 1, (a[:70], s.count(a))
    return s.replace(a, b)


html = open(out + '/index.html').read()
html = rep(html, '<div class="progress" aria-hidden="true"><span></span></div>',
           '<div class="concept" role="note"><b>Design concept</b><span>Website redesign preview for J&amp;B Automotive · not the official site</span><a href="../">← Proposal</a></div>\n  <div class="progress" aria-hidden="true"><span></span></div>')
open(out + '/index.html', 'w').write(html)

css = open(out + '/styles.css').read()
css = rep(css, "  --header-h: 72px;\n", "  --header-h: 72px;\n  --strip: 30px;\n")
css = rep(css, "scroll-padding-top: calc(var(--header-h) + 12px);", "scroll-padding-top: calc(var(--header-h) + var(--strip) + 12px);")
css = rep(css, ".header {\n  position: fixed; top: 0;", ".header {\n  position: fixed; top: calc(var(--strip) + env(safe-area-inset-top, 0px));")
css = rep(css, "padding: calc(var(--header-h) + 40px) 0 90px;", "padding: calc(var(--header-h) + var(--strip) + 40px) 0 90px;")
css = rep(css, "  .hero { min-height: auto; padding-top: calc(var(--header-h) + 36px); }", "  .hero { min-height: auto; padding-top: calc(var(--header-h) + var(--strip) + 36px); }")
css = rep(css, "    position: fixed; top: var(--header-h); left: 0; right: 0; flex-direction: column;", "    position: fixed; top: calc(var(--header-h) + var(--strip) + env(safe-area-inset-top, 0px)); left: 0; right: 0; flex-direction: column;")
css = rep(css, ".progress { position: fixed; top: 0;", ".progress { position: fixed; top: calc(var(--strip) + env(safe-area-inset-top, 0px));")
css += '''
.concept { position: fixed; top: 0; left: 0; right: 0; z-index: 130; height: calc(var(--strip) + env(safe-area-inset-top, 0px)); padding: env(safe-area-inset-top, 0px) 16px 0; display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--cream); color: var(--bg); font: 500 12px/1.2 var(--f-body); white-space: nowrap; overflow: hidden; }
.concept b { padding: 3px 8px; border-radius: 6px; background: var(--bg); color: var(--cream); font: 700 10px var(--f-mono); letter-spacing: .1em; text-transform: uppercase; flex: none; }
.concept span { overflow: hidden; text-overflow: ellipsis; }
.concept a { flex: none; color: var(--bg); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
@media (max-width: 520px) { .concept span { display: none; } }
'''
open(out + '/styles.css', 'w').write(css)
open(os.path.join(dist, '.nojekyll'), 'w').write('')
shutil.copy(str(ROOT / 'preview' / 'proposal.html'), os.path.join(dist, 'index.html'))
# old link from the first preview: /proposal/ now forwards to the front page
os.makedirs(os.path.join(dist, 'proposal'), exist_ok=True)
open(os.path.join(dist, 'proposal', 'index.html'), 'w').write('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=../"><title>J&amp;B Website Proposal</title><a href="../">Open the proposal</a>')
print('built', sorted(os.listdir(dist)), sorted(os.listdir(out)))
