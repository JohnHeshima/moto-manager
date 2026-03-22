"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/backend/firebase/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Label } from "@/frontend/components/ui/label";
import { Loader2, KeyRound, Mail } from "lucide-react";
import PasswordInput from "@/frontend/components/PasswordInput";

function getErrorMessage(error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "Erreur inconnue";

    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        return "Email ou mot de passe incorrect.";
    }

    if (code === "auth/user-not-found") {
        return "Aucun utilisateur trouvé avec cet email.";
    }

    return `Une erreur est survenue. ${message}`;
}

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (error: unknown) {
            console.error(error);
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-black/10 shadow-[0_28px_70px_rgba(0,0,0,0.16)]">
                <CardHeader className="text-center space-y-2 pb-6">
                    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-primary/20">
                        <KeyRound className="h-8 w-8 text-foreground" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
                    <CardDescription>
                        Accédez à votre espace MotoManager
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="nom@exemple.com"
                                    className="pl-10 h-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Mot de passe</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <PasswordInput
                                    id="password"
                                    className="pl-10 h-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-black/8 bg-secondary px-3 py-2 text-center text-sm font-medium text-foreground/80">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Se connecter"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
