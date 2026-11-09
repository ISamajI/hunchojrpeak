# Builds the J&B concept preview (site at /, proposal at /proposal/) into the folder given as argv[1].
# The concept strip marks it as a redesign preview; robots noindex keeps it out of search.
import os
import shutil
import sys

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = str(ROOT / 'jandbauto') + '/'
out = sys.argv[1]
if os.path.isdir(out):
    shutil.rmtree(out)
shutil.copytree(src, out, ignore=shutil.ignore_patterns('tests', '*.md'))


def rep(s, a, b):
    assert s.count(a) == 1, (a[:70], s.count(a))
    return s.replace(a, b)


html = open(out + '/index.html').read()
html = rep(html, '<div class="progress" aria-hidden="true"><span></span></div>',
           '<div class="concept" role="note"><b>Design concept</b><span>Website redesign preview for J&amp;B Automotive · not the official site</span></div>\n  <div class="progress" aria-hidden="true"><span></span></div>')
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
'''
open(out + '/styles.css', 'w').write(css)
open(out + '/.nojekyll', 'w').write('')
os.makedirs(out + '/proposal', exist_ok=True)
shutil.copy(str(ROOT / 'preview' / 'proposal.html'), out + '/proposal/index.html')
print('built', sorted(os.listdir(out)))
