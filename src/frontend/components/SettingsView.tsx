"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Loader2, LogOut, Save, ShieldCheck, Users, FileText, ChevronRight, KeyRound, ArrowLeft, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import PasswordInput from "@/frontend/components/PasswordInput";
import { db } from "@/backend/firebase/firebase";
import { useAuth } from "@/frontend/contexts/AuthContext";

function getFirebaseErrorMessage(error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "Erreur inconnue";

    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        return "Le mot de passe actuel est incorrect.";
    }

    if (code === "auth/email-already-in-use") {
        return "Cet email est déjà utilisé.";
    }

    if (code === "auth/requires-recent-login") {
        return "Reconnecte-toi puis réessaie la modification.";
    }

    if (code === "auth/weak-password") {
        return "Le nouveau mot de passe est trop faible.";
    }

    return `Une erreur est survenue. ${message}`;
}

export default function SettingsView({
    onOpenDocuments,
    onLogout,
}: {
    onOpenDocuments: () => void;
    onLogout: () => Promise<void>;
}) {
    const { user, userProfile, refreshUserProfile } = useAuth();
    const router = useRouter();
    const canManageUsers = userProfile?.role === "admin" || userProfile?.role === "co_manager";
    const [settingsScreen, setSettingsScreen] = useState<"menu" | "profile">("menu");

    const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
    const [email, setEmail] = useState(userProfile?.email || user?.email || "");
    const [currentPasswordForProfile, setCurrentPasswordForProfile] = useState("");
    const [profileError, setProfileError] = useState("");
    const [profileSuccess, setProfileSuccess] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleProfileSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) {
            return;
        }

        setIsSavingProfile(true);
        setProfileError("");
        setProfileSuccess("");

        try {
            const normalizedName = displayName.trim();
            const normalizedEmail = email.trim().toLowerCase();
            const currentEmail = (user.email || "").toLowerCase();
            const emailChanged = normalizedEmail !== currentEmail;
            const nameChanged = normalizedName !== (userProfile?.displayName || user.displayName || "");

            if (!emailChanged && !nameChanged) {
                setProfileSuccess("Aucune modification détectée.");
                setIsSavingProfile(false);
                return;
            }

            if (emailChanged) {
                if (!currentPasswordForProfile) {
                    throw new Error("Le mot de passe actuel est requis pour modifier l'email.");
                }

                const credential = EmailAuthProvider.credential(user.email || normalizedEmail, currentPasswordForProfile);
                await reauthenticateWithCredential(user, credential);
                await updateEmail(user, normalizedEmail);
            }

            if (nameChanged) {
                await updateProfile(user, { displayName: normalizedName });
            }

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: normalizedEmail || user.email || "",
                displayName: normalizedName || user.displayName || normalizedEmail || "Utilisateur",
                role: userProfile?.role || "driver",
            }, { merge: true });

            await refreshUserProfile();
            setCurrentPasswordForProfile("");
            setProfileSuccess("Informations mises à jour avec succès.");
        } catch (error) {
            console.error("Profile update failed:", error);
            setProfileError(error instanceof Error && error.message.startsWith("Le mot de passe actuel")
                ? error.message
                : getFirebaseErrorMessage(error));
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) {
            return;
        }

        setIsSavingPassword(true);
        setPasswordError("");
        setPasswordSuccess("");

        try {
            if (!currentPassword || !newPassword || !confirmPassword) {
                throw new Error("Tous les champs mot de passe sont requis.");
            }

            if (newPassword.length < 6) {
                throw new Error("Le nouveau mot de passe doit contenir au moins 6 caractères.");
            }

            if (newPassword !== confirmPassword) {
                throw new Error("La confirmation du nouveau mot de passe ne correspond pas.");
            }

            const credential = EmailAuthProvider.credential(user.email || "", currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordSuccess("Mot de passe mis à jour avec succès.");
        } catch (error) {
            console.error("Password update failed:", error);
            setPasswordError(error instanceof Error && (
                error.message.startsWith("Tous les champs") ||
                error.message.startsWith("Le nouveau mot de passe") ||
                error.message.startsWith("La confirmation")
            )
                ? error.message
                : getFirebaseErrorMessage(error));
        } finally {
            setIsSavingPassword(false);
        }
    };

    return (
        <div className="space-y-6 pb-6">
            <Card className="rounded-[28px] border border-black/10 bg-card shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
                <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-2xl border border-black/10 bg-primary/14 flex items-center justify-center text-foreground font-bold text-lg">
                            {(userProfile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{userProfile?.displayName || "Utilisateur connecté"}</p>
                            <p className="text-sm text-muted-foreground truncate">{userProfile?.email || user?.email}</p>
                            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {userProfile?.role === "admin" ? "Administrateur" : userProfile?.role === "co_manager" ? "Co-gérant" : "Motard"}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {settingsScreen === "profile" ? (
                <div className="space-y-4">
                    <Button
                        type="button"
                        variant="ghost"
                        className="px-2 -ml-2"
                        onClick={() => setSettingsScreen("menu")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour aux paramètres
                    </Button>

                    <Card className="rounded-[28px] border border-black/10 bg-card shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
                        <CardContent className="p-5 space-y-4">
                            <div>
                                <p className="text-base font-bold text-foreground">Mes informations</p>
                                <p className="text-sm text-muted-foreground mt-1">Nom, email et identifiants principaux du compte connecté.</p>
                            </div>

                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="settings-name">Nom complet</Label>
                                    <Input
                                        id="settings-name"
                                        value={displayName}
                                        onChange={(event) => setDisplayName(event.target.value)}
                                        placeholder="Votre nom complet"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settings-email">Email</Label>
                                    <Input
                                        id="settings-email"
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="nom@exemple.com"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settings-current-password">Mot de passe actuel</Label>
                                    <PasswordInput
                                        id="settings-current-password"
                                        value={currentPasswordForProfile}
                                        onChange={(event) => setCurrentPasswordForProfile(event.target.value)}
                                        placeholder="Requis seulement si vous changez l'email"
                                    />
                                </div>

                                {profileError && <p className="text-sm font-medium text-rose-600">{profileError}</p>}
                                {profileSuccess && <p className="text-sm font-medium text-emerald-600">{profileSuccess}</p>}

                                <Button type="submit" className="w-full" disabled={isSavingProfile}>
                                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Enregistrer mes informations
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[28px] border border-black/10 bg-card shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
                        <CardContent className="p-5 space-y-4">
                            <div>
                                <p className="text-base font-bold text-foreground">Changer mon mot de passe</p>
                                <p className="text-sm text-muted-foreground mt-1">Le mot de passe actuel est requis pour sécuriser la modification.</p>
                            </div>

                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="settings-password-current">Mot de passe actuel</Label>
                                    <PasswordInput
                                        id="settings-password-current"
                                        value={currentPassword}
                                        onChange={(event) => setCurrentPassword(event.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settings-password-new">Nouveau mot de passe</Label>
                                    <PasswordInput
                                        id="settings-password-new"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="settings-password-confirm">Confirmer le nouveau mot de passe</Label>
                                    <PasswordInput
                                        id="settings-password-confirm"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>

                                {passwordError && <p className="text-sm font-medium text-rose-600">{passwordError}</p>}
                                {passwordSuccess && <p className="text-sm font-medium text-emerald-600">{passwordSuccess}</p>}

                                <Button type="submit" className="w-full" disabled={isSavingPassword}>
                                    {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                                    Mettre à jour mon mot de passe
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="space-y-3">
                    <button
                        onClick={() => setSettingsScreen("profile")}
                        className="w-full flex items-center justify-between rounded-[24px] border border-black/10 bg-card px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(0,0,0,0.08)]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-primary/14 border border-black/10 flex items-center justify-center text-foreground">
                                <UserRound className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Mes informations</p>
                                <p className="text-xs text-muted-foreground">Modifier mon profil, mon email et mon mot de passe</p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {canManageUsers && (
                        <button
                            onClick={() => router.push("/users")}
                            className="w-full flex items-center justify-between rounded-[24px] border border-black/10 bg-card px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(0,0,0,0.08)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-primary/14 border border-black/10 flex items-center justify-center text-foreground">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">Utilisateurs</p>
                                    <p className="text-xs text-muted-foreground">Gérer les rôles et les accès</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}

                    {canManageUsers && (
                        <button
                            onClick={onOpenDocuments}
                            className="w-full flex items-center justify-between rounded-[24px] border border-black/10 bg-card px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(0,0,0,0.08)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-2xl bg-primary/14 border border-black/10 flex items-center justify-center text-foreground">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">Documents</p>
                                    <p className="text-xs text-muted-foreground">Accéder aux documents des motards</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-between rounded-[24px] border border-black/10 bg-card px-4 py-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(0,0,0,0.08)]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-2xl bg-secondary border border-black/10 flex items-center justify-center text-foreground">
                                <LogOut className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">Déconnexion</p>
                                <p className="text-xs text-muted-foreground">Fermer la session en cours</p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            )}
        </div>
    );
}
