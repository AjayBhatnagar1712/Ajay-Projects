import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copy, normalize, translate, hasTranslation} from '../../web/website-copy.mjs';
import {quotePageShell} from '../../tool/quote_page_shell.mjs';

test('every translation is unique, nonempty and contains Hindi', () => {
  const keys = copy.map(([english]) => normalize(english));
  assert.equal(new Set(keys).size, keys.length);
  for (const [english, hindi] of copy) {
    assert.ok(english.trim());
    assert.match(hindi, /[\u0900-\u097f]/, english);
    assert.equal(translate(english, 'en'), english);
    assert.equal(translate(english, 'hi'), hindi);
  }
});

test('all eighteen scene titles and captions are translated', () => {
  const clips = JSON.parse(readFileSync(new URL('../../web/cinema/media/v2/manifest.json', import.meta.url)));
  for (const clip of clips) for (const value of [clip.title, clip.line]) assert.ok(hasTranslation(value), value);
});

test('translation preserves unknown content and tolerates HTML whitespace and uppercase', () => {
  assert.equal(translate('  THE   JOURNEY  ', 'hi'), 'यात्रा');
  assert.equal(translate('guruvandan11@gmail.com', 'hi'), 'guruvandan11@gmail.com');
});

test('public pages contain language controls and module; app and admin remain separate', () => {
  for (const name of ['index','shop','privacy-policy','support','account-deletion']) {
    const page = readFileSync(new URL(`../../web/${name}.html`, import.meta.url), 'utf8');
    assert.match(page, /data-language-switch/);
    assert.match(page, /website-language\.mjs/);
  }
  for (const name of ['app','admin']) assert.doesNotMatch(readFileSync(new URL(`../../web/${name}.html`, import.meta.url), 'utf8'), /website-language/);
});

test('Hindi is the default website language and visitors can switch back to English', () => {
  const module = readFileSync(new URL('../../web/website-language.mjs', import.meta.url), 'utf8');
  assert.match(module, /let language = 'hi'/);
  assert.match(module, /language === 'en' \? 'hi' : 'en'/);
  assert.match(module, /guruvandan\.website\.language\.v2/);
});

test('official localized store badges replace homemade download buttons', () => {
  for (const name of ['index','shop']) {
    const page = readFileSync(new URL(`../../web/${name}.html`, import.meta.url), 'utf8');
    for (const badge of ['google-play-en.png','google-play-hi.png','app-store-en.svg','app-store-hi.svg']) assert.match(page, new RegExp(badge));
  }
});

test('shop has corrected wording, cinematic styling and no sales checkout', () => {
  const page = readFileSync(new URL('../../web/shop.html', import.meta.url), 'utf8');
  assert.match(page, /Sacred offerings and meditational merchandise are being thoughtfully prepared\./);
  assert.match(page, /cinema-home shop-page/);
  assert.match(page, /Coming soon/);
  assert.doesNotMatch(page, /Sacred offerings d |checkout/i);
});

test('static quote pages retain social metadata and cards with the bilingual shell', () => {
  const homepage = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
  const previous = '<html><head><meta property="og:image" content="/quote/test/card.png"><style>old</style></head><body><h1>A shared thought &amp; wisdom</h1><script>oldAutoredirect()</script></body></html>';
  const page = quotePageShell(homepage, previous);
  assert.match(page, /\/quote\/test\/card.png/);
  assert.match(page, /A shared thought &amp; wisdom/);
  assert.match(page, /id="quote-hindi"/);
  assert.match(page, /data-language-switch/);
  assert.doesNotMatch(page, /oldAutoredirect|<style>old/);
});
