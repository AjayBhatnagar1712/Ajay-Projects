const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const projectId = 'dcam-classes-c0715';
const cliRequire = createRequire(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/package.json'));
const auth = cliRequire('./lib/auth');
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Firebase CLI login is required.');
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
let accessToken;
async function request(suffix, body) {
  if (!accessToken) accessToken = (await auth.getAccessToken(account.tokens.refresh_token, [])).access_token;
  const response = await fetch(baseUrl + suffix, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${data.error?.message || 'request failed'}`);
  return data;
}
const apply = process.argv.includes('--apply');
const backupDir = path.resolve('tmp/question-difficulty-migration');

async function main() {
  let cursor;
  let scanned = 0;
  let changed = 0;
  const counts = {};
  const owners = {};
  const backupFile = path.join(backupDir, `${Date.now()}-previous-fields.jsonl`);
  if (apply) fs.mkdirSync(backupDir, { recursive: true });
  while (true) {
    const structuredQuery = { select: { fields: ['difficultyLevel', 'alignments', 'teacherId'].map((fieldPath) => ({ fieldPath })) }, from: [{ collectionId: 'practice_questions' }], orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 250 };
    if (cursor) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false };
    const docs = (await request(':runQuery', { structuredQuery })).flatMap((result) => result.document ? [result.document] : []);
    if (!docs.length) break;
    const writes = [];
    const backup = [];
    for (const doc of docs) {
      const data = doc.fields;
      scanned++;
      const level = data.difficultyLevel?.stringValue || '(missing)';
      counts[level] = (counts[level] || 0) + 1;
      const owner = data.teacherId?.stringValue || '(missing)';
      owners[owner] = (owners[owner] || 0) + 1;
      const alignments = data.alignments?.arrayValue?.values || [];
      if (level === 'Easy' && alignments.every((entry) => entry.mapValue?.fields?.difficultyLevel?.stringValue === 'Easy')) continue;
      changed++;
      if (!apply) continue;
      const fields = { difficultyLevel: { stringValue: 'Easy' } };
      if (data.alignments?.arrayValue) fields.alignments = { arrayValue: { values: alignments.map((entry) => ({ mapValue: { fields: { ...entry.mapValue.fields, difficultyLevel: { stringValue: 'Easy' } } } })) } };
      backup.push(JSON.stringify({ name: doc.name, updateTime: doc.updateTime, difficultyLevel: data.difficultyLevel, alignments: data.alignments }));
      writes.push({ update: { name: doc.name, fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: doc.updateTime } });
    }
    if (writes.length) {
      fs.appendFileSync(backupFile, backup.join('\n') + '\n');
      await request(':commit', { writes });
    }
    cursor = docs.at(-1).name;
    console.log(`Scanned ${scanned}; ${apply ? 'updated' : 'would update'} ${changed}`);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'audit', projectId, scanned, changed, counts, owners, ...(apply ? { backupFile } : {}) }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
