import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {firebaseConfig} from '../web/support-data.mjs';

const email = 'guruvandan11@gmail.com';
const password = process.env.GURUVANDAN_ADMIN_PASSWORD;
if (!password) throw new Error('Admin password is required through the environment.');
const config = JSON.parse(readFileSync(join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
const require = createRequire(import.meta.url);
const cliAuth = require(join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
const activeEmail = config.activeAccounts?.[process.cwd()];
const account = [config, ...(config.additionalAccounts || [])].find(item => item.user?.email === activeEmail) || config;
const token = (await cliAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes)).access_token;
if (!token) throw new Error('Firebase CLI authentication is unavailable.');
async function adminRequest(action, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify({...body,targetProjectId:'guru-vandan'})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Account ${action} failed: ${result.error?.message || response.status}`);
  return result;
}
const found = await adminRequest('lookup', {email:[email]});
if (process.argv.includes('--verify-only')) {
  assert.equal(found.users?.[0]?.email,email);
} else if (found.users?.length) {
  await adminRequest('update', {localId:found.users[0].localId, password, disableUser:false, validSince:String(Math.floor(Date.now()/1000))});
  console.log('Admin account password updated.');
} else {
  await adminRequest('signUp', {email,password});
  console.log('Admin account created.');
}
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})
});
const result = await response.json();
assert.equal(response.status,200,result.error?.message);
assert.equal(result.email,email);
console.log('Configured credentials successfully authenticate.');
if (process.argv.includes('--verify-rules')) {
  for (const path of ['supportMessages','users']) {
    const check = await fetch(`${firebaseConfig.databaseURL}/${path}.json?auth=${encodeURIComponent(result.idToken)}`);
    assert.equal(check.status,200,`Admin access denied to ${path}`);
    console.log(`Admin ${path} access verified.`);
  }
  const rulesResponse = await fetch(`${firebaseConfig.databaseURL}/.settings/rules.json`, {headers:{Authorization:`Bearer ${token}`}});
  assert.equal(rulesResponse.status,200);
  const rules = await rulesResponse.json();
  const localRules = JSON.parse(readFileSync(new URL('../firebase.database.rules.json',import.meta.url),'utf8'));
  assert.deepEqual(rules,localRules);
  const serialized = JSON.stringify(rules);
  assert.ok(!serialized.includes('trustkeyper.com'));
  assert.ok(!serialized.includes("root.child('admins')"));
  for (const path of ['supportMessages','users']) {
    const denied = await fetch(`${firebaseConfig.databaseURL}/${path}.json`);
    assert.equal(denied.status,401);
  }
  console.log('Deployed single-account rules match source; anonymous admin reads are denied.');
}
