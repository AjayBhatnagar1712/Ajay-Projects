import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {clamp,compileReel,frameTime,neighbors,sampleReel,sceneGeometry} from '../../web/cinema/reel.mjs';

const shots = JSON.parse(readFileSync(new URL('../../web/cinema/media/v2/manifest.json',import.meta.url)));
const reel = compileReel(shots);

test('the supplied footage produces eighteen ordered scenes',() => {
  assert.equal(reel.clips.length,18);
  assert.equal(reel.clips[0].id,'horizon');
  assert.equal(reel.clips.at(-1).id,'lamp');
  assert.ok(reel.duration > 130 && reel.duration < 160);
  assert.deepEqual([...new Set(shots.map(shot=>shot.act))],[0,1,2,3,4,5,6]);
});
test('all desktop, mobile and poster media exist',() => {
  for (const shot of shots) for (const key of ['src','small','poster']) assert.ok(statSync(resolve('web',shot[key].slice(1))).size > 1000);
});
test('forward and reverse positions are deterministic and stationary positions hold',() => {
  const samples = [0,.01,.1,.26,.46,.69,.85,1];
  const forward = samples.map(progress=>sampleReel(reel,progress));
  assert.deepEqual([...samples].reverse().map(progress=>sampleReel(reel,progress)),[...forward].reverse());
  assert.deepEqual(sampleReel(reel,.412),sampleReel(reel,.412));
});
test('there are no gaps or more than two overlapping clips',() => {
  for (let step=0;step<=10000;step++) {
    const sample=sampleReel(reel,step/10000);
    assert.ok(sample.layers.length>=1 && sample.layers.length<=2);
    assert.equal(sample.layers[0].opacity,1);
    for(const layer of sample.layers) {
      assert.ok(layer.time>=0 && layer.time<layer.clip.duration);
      assert.ok(layer.opacity>=0 && layer.opacity<=1);
    }
    assert.ok(neighbors(reel,sample).length<=3);
    assert.equal(neighbors(reel,sample,true).length,sample.layers.length);
  }
});
test('overlap dissolves incoming footage without fading the base to black',() => {
  const boundary=reel.clips[4].begin;
  const sample=sampleReel(reel,(boundary+reel.overlap/2)/reel.duration);
  assert.equal(sample.layers[0].opacity,1);
  assert.ok(Math.abs(sample.layers[1].opacity-.5)<.001);
});
test('mobile preserves the scene height and focuses the horizontal crop',() => {
  const geometry=sceneGeometry(1280,720,390,844,.7);
  assert.ok(geometry.width>=390);
  assert.ok(geometry.x<=0);
  assert.ok(geometry.y>0 && geometry.y+geometry.height<844);
  assert.ok(Math.abs(geometry.height-844*.6)<.001);
  const desktop=sceneGeometry(1280,720,1440,900,.5);
  assert.ok(desktop.width>=1440 && desktop.height>=900);
});
test('endpoints clamp and seek targets never run past the final frame',() => {
  assert.equal(sampleReel(reel,-1).current.clip.id,'horizon');
  assert.equal(sampleReel(reel,2).current.clip.id,'lamp');
  assert.equal(clamp(NaN),0);
  assert.ok(frameTime(50,10)<10);
  assert.equal(frameTime(-10,10),0);
});

test('portrait framing retains both teachers and the framed photograph when requested',() => {
  for (const id of ['inner-door','disciple']) {
    const shot = shots.find(clip => clip.id === id);
    assert.equal(shot.portraitFit, 'contain');
    for (const width of [320,390,430]) {
      const geometry = sceneGeometry(1280,720,width,844,shot.focus,shot.portraitFit);
      assert.equal(geometry.x, 0);
      assert.equal(geometry.width, width);
      assert.ok(geometry.height < 844);
      assert.ok(Math.abs(geometry.width / geometry.height - 16 / 9) < 0.001);
    }
    assert.deepEqual(sceneGeometry(1280,720,1440,900,shot.focus,shot.portraitFit),sceneGeometry(1280,720,1440,900,shot.focus));
  }
});

test('only the five requested scenes change immutable media URLs',() => {
  const original = JSON.parse(readFileSync(new URL('../../web/cinema/media/v1/manifest.json',import.meta.url)));
  const changed = new Set(['horizon','blessing','inner-door','satsang','disciple']);
  assert.deepEqual(shots.map(shot => shot.id),original.map(shot => shot.id));
  for (const [index,shot] of shots.entries()) {
    if (!changed.has(shot.id)) assert.deepEqual(shot,original[index]);
    else {
      for (const key of ['src','small','poster']) assert.ok(shot[key].startsWith('/cinema/media/v2/'));
      assert.equal(shot.duration * shot.fps,Math.round(shot.duration * shot.fps));
      assert.equal(shot.duration,shot.end - shot.start);
      assert.equal(shot.title,original[index].title);
    }
  }
  assert.equal(shots.find(shot => shot.id === 'satsang').end,4.5);
});
test('invalid reels fail explicitly',() => {
  assert.throws(()=>compileReel([]));
  assert.throws(()=>compileReel([shots[0],shots[0]]));
  assert.throws(()=>compileReel([{...shots[0],duration:0}]));
});
test('home keeps quote routes, shop, accessible interactions and real store links',() => {
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  for(const id of ['quote-english','quote-hindi','quote-author-english','quote-author-hindi','film-progress','moment-dialog','chapters-dialog']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('/quote_page.js'));
  assert.ok(html.includes('com.ivar.guruvandan'));
  assert.ok(html.includes('id6807657972'));
  assert.ok(html.includes('/shop.html'));
  assert.ok(html.includes('मेँहीँ'));
  assert.ok(!html.includes('/journey.js'));
});

test('home includes the supplied soundtrack and compact sound control without act headings',() => {
  const html=readFileSync(new URL('../../web/index.html',import.meta.url),'utf8');
  const script=readFileSync(new URL('../../web/cinema/film.mjs',import.meta.url),'utf8');
  const audio=statSync(new URL('../../web/audio/santmat-pravachan-2026-09-30.mp3',import.meta.url));
  assert.ok(audio.size > 1000000);
  assert.ok(html.includes('id="site-audio"'));
  assert.ok(html.includes('id="sound-toggle"'));
  assert.ok(!html.includes('id="film-act"'));
  assert.ok(!html.includes('id="scene-number"'));
  assert.ok(script.includes('playSound();'));
});

test('website links are no longer delegated to installed mobile apps',() => {
  const android=JSON.parse(readFileSync(new URL('../../web/.well-known/assetlinks.json',import.meta.url),'utf8'));
  const apple=JSON.parse(readFileSync(new URL('../../web/.well-known/apple-app-site-association',import.meta.url),'utf8'));
  assert.deepEqual(android,[]);
  assert.deepEqual(apple.applinks.details,[]);
});
