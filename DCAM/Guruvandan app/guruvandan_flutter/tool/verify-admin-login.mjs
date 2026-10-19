import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('https://guruvandan.com/admin.html');
  await page.locator('#admin-auth').waitFor({state:'visible'});
  assert.equal(await page.locator('#admin-email').inputValue(),'guruvandan11@gmail.com');
  assert.equal(await page.locator('#google-signin').count(),0);
  await page.locator('#admin-password').fill(process.env.GURUVANDAN_ADMIN_PASSWORD);
  await page.locator('#admin-login button[type=submit]').click();
  await page.locator('#support-inbox').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#admin-identity').textContent(),'guruvandan11@gmail.com');
  const release = JSON.parse(readFileSync(new URL('../build/website-release-latest.json',import.meta.url),'utf8'));
  await page.screenshot({path:join(release.release,'admin-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(release.release,'admin-mobile.png'),fullPage:true});
  await page.locator('#admin-signout').click();
  await page.locator('#admin-auth').waitFor({state:'visible'});
  assert.equal(await page.locator('#support-inbox').isVisible(),false);
  console.log('Live browser login, inbox access, desktop/mobile rendering and logout passed.');
} finally {
  await browser.close();
}
