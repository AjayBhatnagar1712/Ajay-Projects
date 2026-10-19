import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

const enabled = process.env.SUPPORT_EMULATOR_TESTS === '1';
const ruleTest = enabled ? test : test.skip;
const host = 'http://127.0.0.1:9000';
const namespace = 'demo-guruvandan-support-default-rtdb';
const message = () => ({name:'Test Visitor',email:'visitor@example.invalid',topic:'audio',message:'This is an emulator-only support message.',device:'',appVersion:'',language:'en',source:'website',consent:true,status:'new',createdAt:{'.sv':'timestamp'}});
let adminToken;
let memberToken;
let legacyToken;

async function request(path, method = 'GET', body, token) {
  return fetch(`${host}/${path}.json?ns=${namespace}${token ? `&auth=${encodeURIComponent(token)}` : ''}`, {
    method, headers:{'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)
  });
}

async function createUser(email) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'emulator-only-password',returnSecureToken:true})
  });
  assert.equal(response.status,200);
  return response.json();
}

before(async () => {
  if (!enabled) return;
  const rules = JSON.parse(readFileSync(new URL('../../firebase.database.rules.json',import.meta.url),'utf8'));
  const response = await fetch(`${host}/.settings/rules.json?ns=${namespace}`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(rules)});
  assert.equal(response.status,200,await response.text());
  const suffix = randomUUID();
  const admin = await createUser(`admin-${suffix}@example.invalid`);
  adminToken = admin.idToken;
  const grant = await fetch(`${host}/admins/${admin.localId}.json?ns=${namespace}`,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:'true'});
  assert.equal(grant.status,200);
  memberToken = (await createUser(`visitor-${suffix}@example.invalid`)).idToken;
  const signIn = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'guruvandan11@gmail.com',password:'emulator-only-password',returnSecureToken:true})});
  legacyToken = signIn.ok ? (await signIn.json()).idToken : (await createUser('guruvandan11@gmail.com')).idToken;
});

ruleTest('visitors can submit but cannot read, overwrite, delete or change status', async () => {
  const path = `supportMessages/${randomUUID()}`;
  assert.equal((await request(path,'PUT',message())).status,200);
  for (const token of [undefined,memberToken,adminToken]) {
    assert.equal((await request(path,'GET',undefined,token)).status,401);
    assert.equal((await request('supportMessages','GET',undefined,token)).status,401);
    assert.equal((await request(path,'PUT',message(),token)).status,401);
    assert.equal((await request(path,'DELETE',undefined,token)).status,401);
    assert.equal((await request(path+'/status','PUT','resolved',token)).status,401);
  }
});

ruleTest('admins can read and update status but cannot alter the original message', async () => {
  const path = `supportMessages/${randomUUID()}`;
  assert.equal((await request(path,'PUT',message())).status,200);
  for (const token of [legacyToken]) {
    assert.equal((await request(path,'GET',undefined,token)).status,200);
    assert.equal((await request(path+'/status','PUT','read',token)).status,200);
    assert.equal((await request(path+'/status','PUT','resolved',token)).status,200);
    assert.equal((await request(path+'/message','PUT','Changed message not allowed',token)).status,401);
    assert.equal((await request(path+'/email','PUT','other@example.invalid',token)).status,401);
    assert.equal((await request(path+'/status','DELETE',undefined,token)).status,401);
  }
  assert.equal((await request(path,'DELETE',undefined,adminToken)).status,401);
  assert.equal((await request(path,'DELETE',undefined,legacyToken)).status,200);
});

ruleTest('database rejects oversized, incomplete, forged and unexpected fields', async () => {
  const changes = [{message:'a'.repeat(4001)},{message:' ' .repeat(20)},{message:'short'},{email:'invalid'},{name:'x'},{device:'a'.repeat(161)},{appVersion:'a'.repeat(41)},{status:'resolved'},{createdAt:1},{createdAt:Date.now()+3600000},{source:'admin'},{language:'fr'},{topic:'unknown'},{admin:true},{message:null},{consent:false}];
  for (const change of changes) assert.equal((await request(`supportMessages/${randomUUID()}`,'PUT',{...message(),...change})).status,401,JSON.stringify(change).slice(0,100));
  assert.equal((await request('supportMessages/not-a-valid-id','PUT',message())).status,401);
});

ruleTest('authenticated visitors can submit but cannot grant themselves admin access', async () => {
  assert.equal((await request(`supportMessages/${randomUUID()}`,'PUT',message(),memberToken)).status,200);
  assert.equal((await request('admins/forged','PUT',true,memberToken)).status,401);
});

ruleTest('multiline Hindi messages work while whitespace-only messages and email controls are rejected', async () => {
  assert.equal((await request(`supportMessages/${randomUUID()}`,'PUT',{...message(),name:'साधक',message:'ध्यान के समय ऑडियो रुक जाता है।\nकृपया सहायता करें।',language:'hi'})).status,200);
  for (const change of [{message:'\n\r\t '.repeat(20)},{email:'test\nvisitor@example.invalid'},{email:'test\tvisitor@example.invalid'},{name:'\t\t'}]) {
    assert.equal((await request(`supportMessages/${randomUUID()}`,'PUT',{...message(),...change})).status,401);
  }
});
