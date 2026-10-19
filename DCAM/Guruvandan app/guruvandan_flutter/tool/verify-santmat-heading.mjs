import {createRequire} from 'node:module';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const release = JSON.parse(readFileSync(new URL('../build/website-release-latest.json',import.meta.url),'utf8'));
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('https://guruvandan.com/',{waitUntil:'domcontentloaded'});
  const heading = page.locator('.finale-intro h2');
  await page.waitForFunction(() => document.querySelector('.finale-intro h2')?.textContent.includes('संतमत ज्ञान।'));
  await heading.scrollIntoViewIfNeeded();
  await page.screenshot({path:join(release.release,'santmat-hindi-mobile.png')});
  assert.ok((await heading.textContent()).includes('संतमत ज्ञान।'));
  await page.locator('[data-language-switch]').first().click();
  await page.waitForFunction(() => document.querySelector('.finale-intro h2')?.textContent.includes('Santmat Gyan.'));
  await heading.scrollIntoViewIfNeeded();
  await page.screenshot({path:join(release.release,'santmat-english-mobile.png')});
  console.log('Live Hindi and English headings verified after the journey.');
} finally { await browser.close(); }
