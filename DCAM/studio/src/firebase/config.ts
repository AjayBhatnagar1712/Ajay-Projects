const storageBucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
const designatedAdminEmailFromEnv = process.env.NEXT_PUBLIC_DESIGNATED_ADMIN_EMAIL?.trim().toLowerCase();
const authDomainFromEnv = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
const useHostingAuthDomainFromEnv = process.env.NEXT_PUBLIC_USE_HOSTING_AUTH_DOMAIN === 'true';
const defaultFirebaseAuthDomain = 'dcam-classes-c0715.firebaseapp.com';

export const designatedAdminEmail = designatedAdminEmailFromEnv || 'ajaybhatnagar1712@gmail.com';

function resolveFirebaseAuthDomain() {
  if (!useHostingAuthDomainFromEnv) {
    return authDomainFromEnv || defaultFirebaseAuthDomain;
  }

  if (typeof window === 'undefined') {
    return authDomainFromEnv || defaultFirebaseAuthDomain;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return authDomainFromEnv || defaultFirebaseAuthDomain;
  }

  return hostname;
}

export const firebaseConfig = {
  "projectId": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dcam-classes-c0715",
  "appId": process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1059390458247:web:996f6f8b4c65edb759eb22",
  "storageBucket": storageBucketFromEnv || "dcam-classes-c0715.firebasestorage.app",
  "apiKey": process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyASFhsSpSbaVWYj71_BZjeuO7gqtEMU4Jo",
  "authDomain": resolveFirebaseAuthDomain(),
  "measurementId": process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-L62B146LYR",
  "messagingSenderId": process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1059390458247"
};
