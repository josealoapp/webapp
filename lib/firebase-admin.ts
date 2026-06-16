import { getApps, initializeApp, cert, getApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isPostgresAuthEnabled } from "@/lib/postgres";
import {
  deletePostgresAuthUser,
  getAuthUserById,
  listPostgresAuthUsers,
  verifyPostgresAuthToken,
} from "@/lib/postgres-auth";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getPrivateKey() {
  return requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getFirebaseAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: getPrivateKey(),
    }),
  });
}

export function getAdminAuth(): any {
  if (isPostgresAuthEnabled()) {
    return {
      async verifyIdToken(token: string) {
        const user = await verifyPostgresAuthToken(token);
        return {
          uid: user.uid,
          email: user.email || undefined,
          name: user.displayName || undefined,
          picture: user.photoURL || undefined,
          email_verified: user.emailVerified,
        };
      },
      async listUsers(maxResults = 1000) {
        return listPostgresAuthUsers(maxResults);
      },
      async getUser(userId: string) {
        const user = await getAuthUserById(userId);
        if (!user) {
          const error = new Error("auth/user-not-found") as Error & { code?: string };
          error.code = "auth/user-not-found";
          throw error;
        }
        return user;
      },
      async deleteUser(userId: string) {
        await deletePostgresAuthUser(userId);
      },
    };
  }

  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
