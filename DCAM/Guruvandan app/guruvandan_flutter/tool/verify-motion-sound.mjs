import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require(join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const origin = process.argv[2] || 'http://127.0.0.1:4187';
const server = process.argv[2] ? null : spawn(process.execPath,['tool/website_preview.cjs'],{env:{...process.env,PORT:'4187'},stdio:'pipe'});
if (server) await new Promise((resolve,reject) => { server.stdout.once('data',resolve); server.once('error',reject); });
const release = JSON.parse(readFileSync(new URL('../build/website-release-latest.json',import.meta.url),'utf8'));
try {
  for (const blocked of [false,true]) {
    const browser = await chromium.launch({headless:true,channel:'msedge',args:[`--autoplay-policy=${blocked ? 'document-user-activation-required' : 'no-user-gesture-required'}`]});
    try {
      const context = await browser.newContext({viewport:blocked ? {width:390,height:844} : {width:1280,height:900},reducedMotion:'reduce',hasTouch:blocked});
      await context.addInitScript(() => {
        if (navigator.connection) Object.defineProperty(navigator.connection,'saveData',{get:()=>true});
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.documentElement.classList.contains('film-painted'));
      const motion = page.locator('#motion-toggle');
      const sound = page.locator('#sound-toggle');
      assert.equal(await motion.getAttribute('aria-pressed'),'false');
      assert.equal(await sound.getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('#site-audio').evaluate(a=>a.muted),false);
      if (blocked) {
        await page.waitForFunction(()=>document.querySelector('#site-audio').paused);
        await page.locator('#motion-toggle').tap();
        await page.waitForFunction(()=>!document.querySelector('#site-audio').paused);
        await motion.tap();
      } else {
        await page.waitForFunction(()=>!document.querySelector('#site-audio').paused);
      }
      await page.waitForFunction(()=>document.querySelector('#film-canvas').dataset.media === 'video');
      const before = await page.locator('#film-canvas').getAttribute('data-frame');
      await page.evaluate(()=>scrollTo(0,500));
      await page.waitForFunction(old=>document.querySelector('#film-canvas').dataset.frame !== old,before);
      const nonblank = await page.locator('#film-canvas').evaluate(c=>{
        const ctx=c.getContext('2d'); const colors=new Set();
        for(let y=0;y<c.height;y+=40) for(let x=0;x<c.width;x+=40) colors.add([...ctx.getImageData(x,y,1,1).data].join(','));
        return colors.size>10;
      });
      assert.ok(nonblank);
      await page.screenshot({path:join(release.release,blocked?'motion-mobile.png':'motion-desktop.png')});
      await sound.click();
      await page.waitForFunction(()=>document.querySelector('#site-audio').paused && document.querySelector('#site-audio').muted);
      await motion.click();
      assert.equal(await motion.getAttribute('aria-pressed'),'true');
      await page.waitForFunction(()=>document.querySelector('#film-canvas').dataset.media === 'still');
      await page.emulateMedia({reducedMotion:'no-preference'});
      assert.equal(await motion.getAttribute('aria-pressed'),'true');
      assert.equal(await sound.getAttribute('aria-pressed'),'true');
      await sound.click();
      await page.waitForFunction(()=>!document.querySelector('#site-audio').paused && !document.querySelector('#site-audio').muted);
      if (blocked) {
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.documentElement.classList.contains('film-ready'));
        await sound.tap();
        await page.waitForFunction(()=>document.querySelector('#site-audio').paused && document.querySelector('#site-audio').muted);
        await motion.tap();
        assert.equal(await page.locator('#site-audio').evaluate(a=>a.paused),true);
      }
      assert.deepEqual(errors,[]);
      console.log(`${blocked?'Mobile / blocked autoplay':'Desktop / allowed autoplay'}: defaults, playback, mute, still mode and canvas checks passed.`);
    } finally { await browser.close(); }
  }
} finally {
  if(server) { server.kill(); await new Promise(resolve=>server.once('exit',resolve)); }
}
