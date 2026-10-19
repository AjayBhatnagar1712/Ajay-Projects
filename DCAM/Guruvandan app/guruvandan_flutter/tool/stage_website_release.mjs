import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {quotePageShell} from './quote_page_shell.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = join(workspace, 'build/web');
const source = join(workspace, 'web');
const releaseId = new Date().toISOString().replace(/[:.]/g, '-');
const release = join(workspace, 'build/hosting-releases', releaseId);
const publicDirectory = join(release, 'public');
const manifest = JSON.parse(readFileSync(join(source, 'cinema/media/v2/manifest.json'), 'utf8'));
const previousManifest = JSON.parse(readFileSync(join(source, 'cinema/media/v1/manifest.json'), 'utf8'));
const required = ['index.html', 'app.html', 'admin.html', 'main.dart.js', 'quote_page.js', 'shop.html', 'site.css', 'privacy-policy.html', 'support.html', 'account-deletion.html', '.well-known/apple-app-site-association', '.well-known/assetlinks.json', 'assets/assets/images/chakra_logo.png', 'story-assets/gurudev.jpg'];
for (const path of required) if (!existsSync(join(baseline, path))) throw new Error(`Missing baseline file: ${path}`);
for (const clip of manifest) for (const key of ['src','small','poster']) if (!existsSync(join(source,clip[key].slice(1)))) throw new Error(`Missing film asset: ${clip[key]}`);
if (existsSync(release)) throw new Error('Release directory already exists.');
mkdirSync(release, {recursive:true});
cpSync(baseline,publicDirectory,{recursive:true,errorOnExist:true,force:false});
const additions = ['index.html','shop.html','shop.css','website-language.css','website-language.mjs','website-copy.mjs','quote_page.js','privacy-policy.html','support.html','account-deletion.html','cinema/film.css','cinema/film.mjs','cinema/reel.mjs','cinema/video-pool.mjs','cinema/media/v1/manifest.json','cinema/media/v2/manifest.json'];
additions.push('admin.html','admin-support.mjs','support.mjs','support-data.mjs','support.css','legal.css','website-theme.css');
additions.push('audio/santmat-pravachan-2026-09-30.mp3');
additions.push('.well-known/apple-app-site-association','.well-known/assetlinks.json','store-badges/google-play-en.png','store-badges/google-play-hi.png','store-badges/app-store-en.svg','store-badges/app-store-hi.svg');
for (const clip of [...previousManifest,...manifest]) for (const key of ['src','small','poster']) if (!additions.includes(clip[key].slice(1))) additions.push(clip[key].slice(1));
for (const path of additions) {
  const destination = join(publicDirectory,path);
  mkdirSync(dirname(destination),{recursive:true});
  cpSync(join(source,path),destination);
}
const baseConfig = JSON.parse(readFileSync(join(workspace,'firebase.json'),'utf8')).hosting;
const quoteDirectory = join(publicDirectory,'quote');
if (existsSync(quoteDirectory)) {
  const homepage = readFileSync(join(source,'index.html'),'utf8');
  for (const entry of readdirSync(quoteDirectory,{withFileTypes:true})) {
    const page = join(quoteDirectory,entry.name,'index.html');
    if (entry.isDirectory() && existsSync(page)) writeFileSync(page,quotePageShell(homepage,readFileSync(page,'utf8')));
  }
}
const hosting = {...baseConfig, site:'guru-vandan', public:'public'};
hosting.headers = [...baseConfig.headers,
  {source:'**/*.mjs',headers:[{key:'Content-Type',value:'text/javascript; charset=utf-8'}]},
  {source:'/cinema/media/**/*.@(mp4|jpg)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},
  {source:'/cinema/media/**/*.mp4',headers:[{key:'Content-Type',value:'video/mp4'}]}
  ,{source:'/audio/**/*.mp3',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'},{key:'Content-Type',value:'audio/mpeg'}]}
];
cpSync(join(workspace,'firebase.database.rules.json'),join(release,'firebase.database.rules.json'));
writeFileSync(join(release,'firebase.json'),JSON.stringify({hosting,database:{rules:'firebase.database.rules.json'}},null,2)+'\n');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const preserved = required.filter(path => !additions.includes(path)).map(path => {
  if (hash(join(baseline,path)) !== hash(join(publicDirectory,path))) throw new Error(`Preserved file changed: ${path}`);
  return path;
});
function inventory(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const path = join(directory,entry.name);
    return entry.isDirectory() ? inventory(path) : [{path:relative(publicDirectory,path).replaceAll('\\','/'),bytes:statSync(path).size}];
  });
}
const files = inventory(publicDirectory);
const report = {releaseId,project:'guru-vandan',site:'guru-vandan',config:join(release,'firebase.json'),publicDirectory,homepageHash:hash(join(publicDirectory,'index.html')),preserved,fileCount:files.length,totalBytes:files.reduce((sum,file)=>sum+file.bytes,0),files};
writeFileSync(join(release,'release-report.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(join(workspace,'build/website-release-latest.json'),JSON.stringify({release,config:report.config,homepageHash:report.homepageHash},null,2)+'\n');
console.log(JSON.stringify({release,config:report.config,files:report.fileCount,sizeMB:(report.totalBytes/1048576).toFixed(1),preserved:preserved.length},null,2));
