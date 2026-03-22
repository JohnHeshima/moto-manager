import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBu41GjS9r8OESB_PNoDiwx0_KDD-9jH8E",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "myapptest-9106d.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "myapptest-9106d",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "myapptest-9106d.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "279813657900",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:279813657900:web:e3cc1b5a55148757fdc889",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-F92PZQED3T"
};
const firestoreDatabaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim() || "driver-payment-manager";

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firestoreDatabaseId);
const auth = getAuth(app);
const storage = getStorage(app);

if (typeof window !== "undefined") {
    // Analytics is only available in the browser environment
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
        isSupported().then((supported) => {
            if (supported) {
                getAnalytics(app);
            }
        });
    });
}

export { db, auth, storage, firebaseConfig, firestoreDatabaseId };
