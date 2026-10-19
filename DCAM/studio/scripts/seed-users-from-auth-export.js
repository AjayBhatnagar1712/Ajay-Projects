/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const DEFAULT_ADMIN_EMAILS = new Set([
  'ajaybhatnagar1712@gmail.com',
]);

const DEFAULT_TEACHER_UIDS = new Set([
  'pD1x6hvtraVhURYxNG5aoOkVF9c2',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.split('=');
    const key = rawKey.replace(/^--/, '');

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

function parseCsvSet(value) {
  if (!value || typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseCsvSetRaw(value) {
  if (!value || typeof value !== 'string') return new Set();
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function titleCase(input) {
  if (!input) return '';
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function deriveName(user) {
  const displayName = String(user.displayName || '').trim();
  if (displayName) {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstName: titleCase(parts[0]), lastName: '' };
    }
    return {
      firstName: titleCase(parts[0]),
      lastName: titleCase(parts.slice(1).join(' ')),
    };
  }

  const email = String(user.email || '').trim();
  if (email.includes('@')) {
    const local = email.split('@')[0];
    const parts = local
      .replace(/[._-]+/g, ' ')
      .replace(/[0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return { firstName: 'User', lastName: '' };
    if (parts.length === 1) return { firstName: titleCase(parts[0]), lastName: '' };
    return {
      firstName: titleCase(parts[0]),
      lastName: titleCase(parts.slice(1).join(' ')),
    };
  }

  return { firstName: 'User', lastName: '' };
}

function resolveRole(user, roleConfig) {
  const uid = String(user.localId || '').trim();
  const email = String(user.email || '').trim().toLowerCase();

  if (roleConfig.adminUids.has(uid) || roleConfig.adminEmails.has(email)) return 'admin';
  if (roleConfig.teacherUids.has(uid) || roleConfig.teacherEmails.has(email)) return 'teacher';
  return 'student';
}

function loadUsers(inputPath) {
  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Input file not found: ${resolvedInput}`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.users)) return parsed.users;

  throw new Error('Unsupported input format. Expected auth export JSON with {"users":[...]}');
}

function initializeAdmin(projectId, serviceAccountPath) {
  if (serviceAccountPath) {
    const resolvedServiceAccount = path.resolve(serviceAccountPath);
    if (!fs.existsSync(resolvedServiceAccount)) {
      throw new Error(`Service account JSON not found: ${resolvedServiceAccount}`);
    }
    const serviceAccount = require(resolvedServiceAccount);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

async function commitBatch(batch, pendingWrites) {
  if (pendingWrites === 0) return 0;
  await batch.commit();
  return pendingWrites;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const projectId = String(args.project || '').trim();
  const inputPath = String(args.input || '').trim();
  const serviceAccountPath = args['service-account'] ? String(args['service-account']) : '';
  const dryRun = !!args['dry-run'];
  const keepPhotoUrl = !!args['keep-photo-url'];
  const batchSize = Number(args['batch-size'] || 350);

  if (!projectId) {
    throw new Error('Missing --project <projectId>');
  }
  if (!inputPath) {
    throw new Error('Missing --input <path-to-users-old.json>');
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0 || batchSize > 450) {
    throw new Error('Invalid --batch-size. Use 1-450.');
  }

  const adminEmails = new Set(DEFAULT_ADMIN_EMAILS);
  const teacherUids = new Set(DEFAULT_TEACHER_UIDS);
  const teacherEmails = new Set();
  const adminUids = new Set();

  for (const email of parseCsvSet(args['admin-emails'])) adminEmails.add(email);
  for (const uid of parseCsvSetRaw(args['admin-uids'])) adminUids.add(uid);
  for (const email of parseCsvSet(args['teacher-emails'])) teacherEmails.add(email);
  for (const uid of parseCsvSetRaw(args['teacher-uids'])) teacherUids.add(uid);

  const users = loadUsers(inputPath);
  const roleConfig = { adminEmails, adminUids, teacherEmails, teacherUids };

  console.log(`Loaded ${users.length} user(s) from ${path.resolve(inputPath)}`);
  console.log(`Target project: ${projectId}`);
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);

  const plan = users.map((user) => {
    const uid = String(user.localId || '').trim();
    const email = String(user.email || '').trim().toLowerCase();
    const role = resolveRole(user, roleConfig);
    const { firstName, lastName } = deriveName(user);
    return { uid, email, role, firstName, lastName, source: user };
  });

  const roleCounts = plan.reduce(
    (acc, row) => {
      acc[row.role] += 1;
      return acc;
    },
    { admin: 0, teacher: 0, student: 0 }
  );

  console.log(`Planned roles -> admin: ${roleCounts.admin}, teacher: ${roleCounts.teacher}, student: ${roleCounts.student}`);
  console.log('Users:');
  for (const row of plan) {
    console.log(`- ${row.uid} | ${row.email || '(no-email)'} | ${row.role}`);
  }

  if (dryRun) {
    console.log('Dry run complete. No writes performed.');
    return;
  }

  initializeAdmin(projectId, serviceAccountPath);
  const db = admin.firestore();

  let batch = db.batch();
  let pendingWrites = 0;
  let committedWrites = 0;
  const nowIso = new Date().toISOString();

  for (const row of plan) {
    const uid = row.uid;
    if (!uid) {
      console.warn(`Skipping user with missing UID: ${row.email || '(unknown email)'}`);
      continue;
    }

    const source = row.source;
    const phoneNumber = String(source.phoneNumber || '').trim();
    const email = String(source.email || '').trim().toLowerCase();
    const profile = {
      id: uid,
      firstName: row.firstName || 'User',
      lastName: row.lastName || '',
      email,
      phoneNumber,
      roleId: row.role,
      status: 'active',
      photoURL: keepPhotoUrl ? String(source.photoUrl || '') : '',
      updatedAt: nowIso,
      ...(row.role === 'teacher' || row.role === 'admin' ? { teacherStatus: 'approved' } : {}),
    };

    batch.set(db.doc(`users/${uid}`), profile, { merge: true });
    pendingWrites += 1;

    if (row.role === 'teacher' || row.role === 'admin') {
      batch.set(
        db.doc(`roles_teacher/${uid}`),
        { createdAt: nowIso },
        { merge: true }
      );
      pendingWrites += 1;
    }

    if (row.role === 'admin') {
      batch.set(
        db.doc(`roles_admin/${uid}`),
        { createdAt: nowIso },
        { merge: true }
      );
      pendingWrites += 1;
    }

    if (pendingWrites >= batchSize) {
      committedWrites += await commitBatch(batch, pendingWrites);
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  committedWrites += await commitBatch(batch, pendingWrites);

  console.log(`Seed complete. Committed ${committedWrites} write(s).`);
  console.log('Next: test login for admin + teacher + student accounts.');
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
