import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

const DB_ID = 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, { experimentalForceLongPolling: true }, DB_ID);
} catch (e) {
  try {
    firestoreInstance = getFirestore(app, DB_ID);
  } catch (e2) {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
