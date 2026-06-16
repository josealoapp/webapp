import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { auth } from "@/lib/auth-client";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const FIREBASE_APP_NAME = "josealo-client-firestore-long-polling-v2";
const FIREBASE_CLIENT_VERSION = 2;

type FirebaseClient = {
  version: number;
  app: FirebaseApp;
  db: Firestore;
};

declare global {
  var __josealoFirebaseClient: FirebaseClient | undefined;
}

function createFirebaseClient(): FirebaseClient {
  const app =
    getApps().find((firebaseApp) => firebaseApp.name === FIREBASE_APP_NAME) ??
    initializeApp(firebaseConfig, FIREBASE_APP_NAME);

  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    db = getFirestore(app);
  }

  return {
    version: FIREBASE_CLIENT_VERSION,
    app,
    db,
  };
}

const firebaseClient =
  globalThis.__josealoFirebaseClient?.version === FIREBASE_CLIENT_VERSION
    ? globalThis.__josealoFirebaseClient
    : createFirebaseClient();
globalThis.__josealoFirebaseClient = firebaseClient;

export const app = firebaseClient.app;
export const db = firebaseClient.db;
export { auth };
