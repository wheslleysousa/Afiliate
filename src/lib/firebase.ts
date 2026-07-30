import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
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

const DB_ID = firebaseConfigJson.firestoreDatabaseId || 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';

let firestoreInstance;
try {
  firestoreInstance = getFirestore(app, DB_ID);
} catch (e) {
  try {
    firestoreInstance = initializeFirestore(app, {}, DB_ID);
  } catch (e2) {
    try {
      firestoreInstance = getFirestore(app);
    } catch (e3) {
      console.error("Erro ao inicializar Firestore:", e3);
    }
  }
}

export const db = firestoreInstance;
