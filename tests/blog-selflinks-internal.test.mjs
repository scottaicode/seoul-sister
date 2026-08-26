/**
 * Absolute self-links in blog bodies must render WITHOUT target="_blank".
 * 567 such links across 46 posts were opening in a new tab because isExternal
 * tested the scheme only. Executes the real renderer expression, transpiled out
 * of page.tsx, rather than asserting on source text (a source regex passes
 * against the broken code).
 */
import { readFileSync } from 'fs';
import assert from 'assert';
import ts from 'typescript';

const src = readFileSync('src/app/blog/[slug]/page.tsx', 'utf8');
const m = src.match(/renderer\.link = \(\{ href, title, text \}\) => \{[\s\S]*?\n\}/);
assert.ok(m, 'could not locate renderer.link in page.tsx');

const fn = ts.transpileModule(`const link = ${m[0].replace('renderer.link = ', '')}; link`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const link = eval(fn);

const internal = [
  'https://www.seoulsister.com/best/eye-care',
  'https://seoulsister.com/ingredients/niacinamide',
  'https://www.seoulsister.com/products/de179315-d7d1-404e-bd59-ff73e28d2e35',
  '/products/abc',
];
for (const href of internal) {
  const html = link({ href, title: null, text: 'x' });
  assert.ok(!html.includes('target="_blank"'), `internal link opened in new tab: ${href}`);
}

const external = ['https://www.reddit.com/r/AsianBeauty', 'https://oliveyoung.co.kr/x'];
for (const href of external) {
  const html = link({ href, title: null, text: 'x' });
  assert.ok(html.includes('target="_blank"'), `external link lost target=_blank: ${href}`);
  assert.ok(html.includes('rel="noopener noreferrer"'), `external link lost rel: ${href}`);
}

// A lookalike domain must NOT be treated as ours.
assert.ok(
  link({ href: 'https://seoulsister.com.evil.test/x', title: null, text: 'x' }).includes('target="_blank"'),
  'lookalike domain treated as internal'
);

console.log('PASS blog-selflinks-internal (%d internal, %d external)', internal.length, external.length);
