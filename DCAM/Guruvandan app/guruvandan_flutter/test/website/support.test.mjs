import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMessage, messagePayload, sendMessage, filterMessages, usesEmulators, topics} from '../../web/support-data.mjs';
import {hasTranslation} from '../../web/website-copy.mjs';

const sample = {name:'Test Visitor', email:'visitor@example.invalid', topic:'audio', message:'The audio stops when I lock the screen.', device:'Android', appVersion:'1.0', consent:true};

test('support validation trims input, supports Hindi and limits all fields', () => {
  assert.equal(validateMessage({...sample, name:'  Test Visitor  '}).fields.name, sample.name);
  assert.ok(validateMessage({...sample, name:'परीक्षण साधक', message:'ध्यान करते समय ऑडियो रुक जाता है।'}).fields);
  for (const [field, value] of [['name',' '],['name','a'.repeat(81)],['email','invalid'],['email','a'.repeat(254)+'@x.test'],['topic','__proto__'],['message','short'],['message',' '.repeat(20)],['message','a'.repeat(4001)],['device','a'.repeat(161)],['appVersion','a'.repeat(41)],['consent',false]]) {
    const result = validateMessage({...sample,[field]:value});
    assert.equal(result.field, field);
    assert.ok(hasTranslation(result.error), result.error);
  }
  for (const topic of Object.values(topics)) assert.ok(hasTranslation(topic), topic);
});

test('submission stores only approved fields with a server timestamp', () => {
  const validated = validateMessage({...sample, admin:true, status:'resolved'});
  const payload = messagePayload(validated.fields,'hi');
  assert.deepEqual(payload.createdAt,{'.sv':'timestamp'});
  assert.equal(payload.status,'new');
  assert.equal(payload.consent,true);
  assert.equal(payload.language,'hi');
  assert.ok(!Object.hasOwn(payload,'admin'));
});

test('emulator routing cannot be activated on the live website', () => {
  assert.equal(usesEmulators({hostname:'guruvandan.com', search:'?emulator=1'}),false);
  assert.equal(usesEmulators({hostname:'localhost', search:''}),false);
  assert.equal(usesEmulators({hostname:'127.0.0.1', search:'?emulator=1'}),true);
});

test('send is acknowledged by the server, uses a silent blind write, and propagates failures', async () => {
  const payload = messagePayload(validateMessage(sample).fields,'en');
  const location = {hostname:'127.0.0.1',search:'?emulator=1'};
  const id = '12345678-1234-4234-8234-123456789012';
  const fetcher = async (url, options) => {
    assert.match(url, /127\.0\.0\.1:9000/);
    assert.match(url, /print=silent/);
    assert.equal(options.method,'PUT');
    assert.deepEqual(JSON.parse(options.body),payload);
    return {ok:true};
  };
  assert.equal(await sendMessage(payload,{location,fetcher,id}),id);
  await assert.rejects(sendMessage(payload,{location,id,fetcher:async()=>({ok:false})}));
  await assert.rejects(sendMessage(payload,{location,id,fetcher:async()=>{throw new Error('Offline');}}));
});

test('inbox search and filters preserve message content and sort newest first', () => {
  const messages = [{...sample,id:'a',status:'new',createdAt:1},{...sample,id:'b',status:'resolved',createdAt:2,name:'दिव्या',message:'<img src=x onerror=alert(1)>'}];
  assert.deepEqual(filterMessages(messages,'all','').map(item=>item.id),['b','a']);
  assert.equal(filterMessages(messages,'new','visitor').length,1);
  assert.equal(filterMessages(messages,'all','दिव्या')[0].id,'b');
  assert.equal(messages[1].message,'<img src=x onerror=alert(1)>');
  const source = readFileSync(new URL('../../web/admin-support.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/innerHTML|insertAdjacentHTML/);
  assert.match(source,/node.textContent = value/);
});

test('public pages share the cinematic theme and Support publishes no email address', () => {
  for (const page of ['support','privacy-policy','account-deletion','shop']) {
    const html = readFileSync(new URL(`../../web/${page}.html`,import.meta.url),'utf8');
    assert.match(html,/cinema-home/);
    assert.match(html,/cinema-header/);
    assert.match(html,/cinema-footer/);
    assert.match(html,/website-theme.css/);
  }
  const support = readFileSync(new URL('../../web/support.html',import.meta.url),'utf8');
  assert.doesNotMatch(support,/mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  assert.match(support,/textarea.*name="message"/);
  assert.match(support,/role="status"/);
  assert.match(readFileSync(new URL('../../web/admin.html',import.meta.url),'utf8'),/Support messages/);
});
