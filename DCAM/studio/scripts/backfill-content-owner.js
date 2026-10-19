/* eslint-disable no-console */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.argv[2];
const adminUid = process.argv[3];

if (!serviceAccountPath || !adminUid) {
  console.error('Usage: node scripts/backfill-content-owner.js <serviceAccountPath> <adminUid>');
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account JSON not found at: ${resolvedPath}`);
  process.exit(1);
}

const serviceAccount = require(resolvedPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfillContentOwner() {
  const batchSize = 400;
  let lastDoc = null;
  let totalScanned = 0;
  let totalUpdated = 0;

  while (true) {
    let query = db.collection('content').orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    let batchWrites = 0;

    snapshot.docs.forEach((doc) => {
      totalScanned += 1;
      const data = doc.data();
      if (!data.teacherId) {
        batch.update(doc.ref, {
          teacherId: adminUid,
          teacherName: data.teacherName || 'Admin',
        });
        batchWrites += 1;
        totalUpdated += 1;
      }
    });

    if (batchWrites > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < batchSize) break;
  }

  console.log(`Done. Scanned ${totalScanned} content docs. Updated ${totalUpdated}.`);
}

backfillContentOwner().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
