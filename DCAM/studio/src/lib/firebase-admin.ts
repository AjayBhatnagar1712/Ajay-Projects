import {
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
  cert,
  applicationDefault,
  type App,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function readFirebaseConfigFromEnv(): { projectId?: string; storageBucket?: string } {
  const rawConfig = process.env.FIREBASE_CONFIG;
  if (!rawConfig) return {};

  try {
    const parsed = JSON.parse(rawConfig) as { projectId?: string; storageBucket?: string };
    return parsed || {};
  } catch {
    return {};
  }
}

function resolveProjectId() {
  const firebaseConfig = readFirebaseConfigFromEnv();
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    firebaseConfig.projectId?.trim() ||
    undefined
  );
}

function resolveStorageBucket() {
  const firebaseConfig = readFirebaseConfigFromEnv();
  const projectId = resolveProjectId();

  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    firebaseConfig.storageBucket?.trim() ||
    (projectId ? `${projectId}.firebasestorage.app` : undefined)
  );
}

export function getFirebaseAdminApp(): App {
  if (getAdminApps().length > 0) {
    return getAdminApps()[0]!;
  }

  const projectId = resolveProjectId();
  const storageBucket = resolveStorageBucket();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeAdminApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
      storageBucket,
    });
  }

  return initializeAdminApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminBucket() {
  const adminApp = getFirebaseAdminApp();
  const bucketName = resolveStorageBucket();
  return getStorage(adminApp).bucket(bucketName);
}

export function getFirebaseAdminBucketName() {
  return getFirebaseAdminBucket().name;
}
