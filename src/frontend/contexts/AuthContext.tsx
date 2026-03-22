"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/backend/firebase/firebase";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

type UserRole = 'admin' | 'driver' | 'co_manager';
const LEGACY_ADMIN_EMAIL = "admin@gmail.com";

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
    displayName: string;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    logout: async () => { },
    refreshUserProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

function buildFallbackProfile(currentUser: User): UserProfile | null {
    if (currentUser.email?.toLowerCase() !== LEGACY_ADMIN_EMAIL) {
        return null;
    }

    return {
        uid: currentUser.uid,
        email: currentUser.email || LEGACY_ADMIN_EMAIL,
        role: "admin",
        displayName: currentUser.displayName || "Admin System",
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUserProfile = async () => {
        const currentUser = auth.currentUser;

        if (!currentUser) {
            setUser(null);
            setUserProfile(null);
            return;
        }

        setUser(currentUser);

        try {
            const docRef = doc(db, "users", currentUser.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as Partial<UserProfile>;
                setUserProfile({
                    uid: data.uid || currentUser.uid,
                    email: data.email || currentUser.email || "",
                    role: data.role || "driver",
                    displayName: data.displayName || currentUser.displayName || currentUser.email || "Utilisateur",
                });
                return;
            }

            const fallbackProfile = buildFallbackProfile(currentUser);
            setUserProfile(fallbackProfile);
        } catch (error) {
            console.error("Error refreshing user profile:", error);
            const fallbackProfile = buildFallbackProfile(currentUser);
            setUserProfile(fallbackProfile);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setUserProfile(null);

            if (currentUser) {
                // Fetch user profile from Firestore "users" collection
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data() as Partial<UserProfile>;
                        setUserProfile({
                            uid: data.uid || currentUser.uid,
                            email: data.email || currentUser.email || "",
                            role: data.role || "driver",
                            displayName: data.displayName || currentUser.displayName || currentUser.email || "Utilisateur",
                        });
                    } else {
                        const fallbackProfile = buildFallbackProfile(currentUser);
                        if (fallbackProfile) {
                            setUserProfile(fallbackProfile);
                        } else {
                            console.warn("No user profile found for", currentUser.uid);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                    const fallbackProfile = buildFallbackProfile(currentUser);
                    if (fallbackProfile) {
                        setUserProfile(fallbackProfile);
                    }
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, logout, refreshUserProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
