"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/backend/firebase/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/frontend/components/ui/card";

export default function SetupPage() {
    const setupEnabled = process.env.NEXT_PUBLIC_ENABLE_SETUP === "true";
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const createAdmin = async () => {
        setStatus("Création en cours...");
        setError("");
        try {
            // 1. Create Auth User
            const cred = await createUserWithEmailAndPassword(auth, "admin@gmail.com", "123456789");

            // 2. Create Firestore Profile
            await setDoc(doc(db, "users", cred.user.uid), {
                uid: cred.user.uid,
                email: "admin@gmail.com",
                displayName: "Admin System",
                role: "admin",
                createdAt: Timestamp.now()
            });

            setStatus("Succès ! L'admin a été créé et connecté. Vous pouvez aller sur l'accueil.");
        } catch (e: unknown) {
            console.error(e);
            if (typeof e === "object" && e !== null && "code" in e && e.code === "auth/email-already-in-use") {
                setError("Cet email est déjà utilisé. Si vous ne connaissez pas le mot de passe, supprimez l'utilisateur dans la console Firebase et réessayez.");
            } else {
                const message = e instanceof Error ? e.message : "Erreur inconnue.";
                setError("Erreur: " + message);
            }
            setStatus("");
        }
    };

    if (!setupEnabled) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Initialisation désactivée</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Cette page est désactivée par défaut pour éviter toute initialisation non voulue en production.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Initialisation Admin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-md text-sm font-mono">
                        Email: admin@gmail.com<br />
                        Pass: 123456789
                    </div>

                    <Button onClick={createAdmin} className="w-full">
                        Créer le Compte Admin
                    </Button>

                    {status && <p className="text-emerald-600 font-medium text-center">{status}</p>}
                    {error && <p className="text-rose-600 font-medium text-center text-sm">{error}</p>}

                    {status && (
                        <Button variant="outline" className="w-full" onClick={() => window.location.href = "/"}>
                            Aller a l&apos;accueil
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
