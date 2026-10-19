import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const release = JSON.parse(readFileSync(join(workspace,'build/website-release-latest.json'),'utf8'));
const manifest = JSON.parse(readFileSync(join(workspace,'web/cinema/media/v2/manifest.json'),'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = [];
async function checkText(origin,path,localPath) {
  const response = await fetch(origin + path,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,`${origin}${path}`);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(body),digest(readFileSync(resolve(workspace,localPath))),`Content mismatch: ${origin}${path}`);
  checks.push({url:origin+path,finalUrl:response.url,status:response.status,contentMatches:true,contentType:response.headers.get('content-type')});
}
for (const origin of ['https://guruvandan.com','https://www.guruvandan.com','https://guru-vandan.web.app']) await checkText(origin,'/','web/index.html');
for (const path of ['cinema/film.mjs','cinema/reel.mjs','cinema/video-pool.mjs','cinema/film.css','cinema/media/v2/manifest.json','website-language.mjs','website-copy.mjs','website-language.css','shop.html','shop.css','quote_page.js','privacy-policy.html','support.html','account-deletion.html']) await checkText('https://guruvandan.com','/'+path,'web/'+path);
for (const path of ['admin.html','admin-support.mjs','support.mjs','support-data.mjs','support.css','legal.css','website-theme.css']) await checkText('https://guruvandan.com','/'+path,'web/'+path);
for (const path of ['store-badges/google-play-en.png','store-badges/google-play-hi.png','store-badges/app-store-en.svg','store-badges/app-store-hi.svg']) await checkText('https://guruvandan.com','/'+path,'web/'+path);
for (const path of ['main.dart.js','app.html']) await checkText('https://guruvandan.com','/'+path,'build/web/'+path);
for (const path of ['.well-known/apple-app-site-association','.well-known/assetlinks.json']) await checkText('https://guruvandan.com','/'+path,'web/'+path);
for (const id of ['-Ozjplt-2nZjWF3lNIhk','-Ozjr_DKiz53CoyYynjS']) await checkText('https://guruvandan.com',`/quote/${id}/`,join(release.release,'public/quote',id,'index.html'));
for (const path of [manifest[0].src,manifest[0].small]) {
  const response = await fetch('https://guruvandan.com'+path,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,206,`Seeking unsupported: ${path}`);
  assert.equal((await response.arrayBuffer()).byteLength,1024);
  assert.match(response.headers.get('content-type'),/video\/mp4/);
  assert.match(response.headers.get('cache-control'),/immutable/);
  assert.ok(!response.headers.get('cache-control').includes('no-store'));
  checks.push({url:'https://guruvandan.com'+path,status:response.status,range:response.headers.get('content-range'),cacheControl:response.headers.get('cache-control')});
}
for (const clip of manifest) {
  for (const path of [clip.src,clip.small,clip.poster]) {
    const response = await fetch('https://guruvandan.com'+path,{method:'HEAD',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`Missing asset: ${path}`);
    assert.match(response.headers.get('content-type'),path.endsWith('.mp4') ? /video\/mp4/ : /image\/jpeg/);
  }
}
const report = {verifiedAt:new Date().toISOString(),checks,mediaFilesChecked:manifest.length*3};
writeFileSync(join(release.release,'live-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
