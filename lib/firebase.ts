import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Replace with actual configuration from the user
const firebaseConfig = {
    apiKey: "AIzaSyBu41GjS9r8OESB_PNoDiwx0_KDD-9jH8E",
    authDomain: "myapptest-9106d.firebaseapp.com",
    projectId: "myapptest-9106d",
    storageBucket: "myapptest-9106d.firebasestorage.app",
    messagingSenderId: "279813657900",
    appId: "1:279813657900:web:e3cc1b5a55148757fdc889",
    measurementId: "G-F92PZQED3T"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, "driver-payment-manager");
const auth = getAuth(app);
let analytics;

if (typeof window !== "undefined") {
    // Analytics is only available in the browser environment
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
        isSupported().then((supported) => {
            if (supported) {
                analytics = getAnalytics(app);
            }
        });
    });
}

export { db, auth, firebaseConfig };
