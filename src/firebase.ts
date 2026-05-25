import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Simple auto-anon-login so the app runs flawlessly for nurses
export const ensureAuthenticated = async () => {
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
        } catch (e: any) {
            console.error("Auth failed:", e);
            if (e.code === 'auth/admin-restricted-operation') {
                console.warn("CRITICAL: You must enable 'Anonymous' Sign-in provider in your Firebase project Authentication settings for this applet to work.");
            }
        }
    }
};
