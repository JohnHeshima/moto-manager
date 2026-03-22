"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, UserProfile } from "@/frontend/contexts/AuthContext";
import { db } from "@/backend/firebase/firebase";
import { collection, getDocs, doc, getDoc, query, updateDoc, setDoc, Timestamp, deleteDoc, where } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { Loader2, ArrowLeft, Shield, Bike, Plus, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import PasswordInput from "@/frontend/components/PasswordInput";

// --- SECONDARY FIREBASE APP FOR ADMIN CREATING USERS ---
// We do this to avoid signing out the current Admin when calling createUserWithEmailAndPassword
import { firebaseConfig } from "@/backend/firebase/firebase";

const secondaryApp = getApps().length > 1 ? getApps().find(a => a.name === "Secondary") || initializeApp(firebaseConfig, "Secondary") : initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);
// --------------------------------------------------------

type UserWithCreatedAt = UserProfile & {
    createdAt?: {
        toDate?: () => Date;
    };
};

function isUserRole(value: string): value is UserProfile["role"] {
    return value === "admin" || value === "driver" || value === "co_manager";
}

function getErrorDetails(error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    const message = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";

    return { code, message };
}

export default function UsersPage() {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const isLegacyAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
    const isAdmin = userProfile?.role === "admin" || isLegacyAdmin;
    const isCoManager = userProfile?.role === "co_manager";
    const canManageUsers = isAdmin || isCoManager;
    const canCreateOnlyDrivers = isCoManager && !isAdmin;

    // New User Form State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserName, setNewUserName] = useState("");
    const [newUserRole, setNewUserRole] = useState<"admin" | "driver" | "co_manager">("driver");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const fetchUsers = useCallback(async () => {
        try {
            if (!user) {
                setUsers([]);
                return;
            }

            let rawUsers: UserWithCreatedAt[] = [];

            if (isAdmin) {
                const snapshot = await getDocs(collection(db, "users"));
                rawUsers = snapshot.docs.map((userDoc) => ({ uid: userDoc.id, ...userDoc.data() } as UserWithCreatedAt));
            } else if (isCoManager) {
                const [selfSnapshot, driversSnapshot] = await Promise.all([
                    getDoc(doc(db, "users", user.uid)),
                    getDocs(query(collection(db, "users"), where("role", "==", "driver"))),
                ]);

                const visibleUsers: UserWithCreatedAt[] = [];

                if (selfSnapshot.exists()) {
                    visibleUsers.push({ uid: selfSnapshot.id, ...selfSnapshot.data() } as UserWithCreatedAt);
                }

                driversSnapshot.docs.forEach((userDoc) => {
                    visibleUsers.push({ uid: userDoc.id, ...userDoc.data() } as UserWithCreatedAt);
                });

                const dedupedUsers = new Map<string, UserWithCreatedAt>();
                visibleUsers.forEach((profile) => {
                    dedupedUsers.set(profile.uid, profile);
                });
                rawUsers = Array.from(dedupedUsers.values());
            }

            const userData = rawUsers
                .sort((a, b) => {
                    const aCreatedAt = a.createdAt?.toDate?.().getTime() || 0;
                    const bCreatedAt = b.createdAt?.toDate?.().getTime() || 0;
                    return bCreatedAt - aCreatedAt;
                })
                .map((profile) => ({
                    uid: profile.uid,
                    email: profile.email,
                    displayName: profile.displayName,
                    role: profile.role,
                }));

            setUsers(userData);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsFetching(false);
        }
    }, [isAdmin, isCoManager, user]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }

        if (!loading && user && !canManageUsers) {
            router.push("/");
            return;
        }

        if (!loading && user && canManageUsers) {
            fetchUsers();
        }
    }, [user, loading, canManageUsers, router, fetchUsers]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError("");

        try {
            const roleToCreate = canCreateOnlyDrivers ? "driver" : newUserRole;

            // 1. Create User in Auth (Secondary App)
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
            const newUser = userCredential.user;

            await updateProfile(newUser, { displayName: newUserName });

            // 2. Create User Profile in Firestore (Main App)
            const newProfile = {
                uid: newUser.uid,
                email: newUser.email || newUserEmail,
                displayName: newUserName,
                role: roleToCreate,
                createdAt: Timestamp.now()
            };

            await setDoc(doc(db, "users", newUser.uid), newProfile);

            // 3. Update Local State
            setUsers((currentUsers) => [newProfile as UserProfile, ...currentUsers]);
            setShowCreateForm(false);
            setNewUserEmail("");
            setNewUserPassword("");
            setNewUserName("");
            setNewUserRole("driver");

        } catch (error: unknown) {
            console.error("Error creating user:", error);
            const { code, message } = getErrorDetails(error);

            if (code === 'auth/email-already-in-use') {
                setCreateError("Email déjà utilisé.");
            } else {
                setCreateError("Erreur: " + message);
            }
        } finally {
            setIsCreating(false);
        }
    };

    // --- User Edit/Delete Logic ---
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleEdit = (user: UserProfile) => {
        setEditingUser(user);
        setIsEditOpen(true);
    };

    const saveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            await updateDoc(doc(db, "users", editingUser.uid), {
                displayName: editingUser.displayName,
                role: editingUser.role
            });
            setIsEditOpen(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error("Error updating user:", error);
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;
        try {
            await deleteDoc(doc(db, "users", uid));
            // Note: This only deletes Firestore profile. Auth user remains but app logic blocks access if profile missing.
            setUsers(users.filter(u => u.uid !== uid));
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };
    // ----------------------------

    if (loading || isFetching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background pb-20 p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="-ml-2">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
                    <p className="text-muted-foreground text-sm">Gérez les accès et les rôles.</p>
                </div>
            </div>

            {canManageUsers && (
                <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm">
                    {!showCreateForm ? (
                        <Button onClick={() => setShowCreateForm(true)} className="w-full">
                            <Plus className="mr-2 h-4 w-4" /> {canCreateOnlyDrivers ? "Ajouter un Motard" : "Ajouter un Utilisateur"}
                        </Button>
                    ) : (
                        <form onSubmit={handleCreateUser} className="space-y-4 animate-in fade-in zoom-in-95">
                            <h3 className="font-semibold text-lg">{canCreateOnlyDrivers ? "Nouveau Motard" : "Nouvel Utilisateur"}</h3>
                            <div className="space-y-2">
                                <Label>Nom Complet</Label>
                                <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="Ex: Jean Motard" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="email@exemple.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mot de passe</Label>
                                    <PasswordInput value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required minLength={6} placeholder="******" />
                                </div>
                            </div>
                            {isAdmin ? (
                                <div className="space-y-2">
                                    <Label>Rôle</Label>
                                    <Select
                                        value={newUserRole}
                                        onValueChange={(value) => {
                                            if (isUserRole(value)) {
                                                setNewUserRole(value);
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="driver">Motard</SelectItem>
                                            <SelectItem value="co_manager">Co-Gérant</SelectItem>
                                            <SelectItem value="admin">Administrateur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Rôle</Label>
                                    <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                                        Motard
                                    </div>
                                </div>
                            )}

                            {createError && <p className="text-sm text-rose-500 font-medium">{createError}</p>}

                            <div className="flex gap-2">
                                <Button type="submit" disabled={isCreating} className="flex-1">
                                    {isCreating ? <Loader2 className="animate-spin h-4 w-4" /> : "Créer"}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} disabled={isCreating}>Annuler</Button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <div className="grid gap-4">
                {users.map((u) => (
                    <Card key={u.uid} className="flex items-center justify-between p-4 bg-card border-border/60">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg",
                                u.role === 'admin' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {u.role === 'admin' ? <Shield size={20} /> : <Bike size={20} />}
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{u.displayName || "Utilisateur sans nom"}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                        u.role === 'admin' ? "bg-primary/10 text-primary" :
                                            (u.role === 'co_manager' ? "bg-primary/20 text-foreground" : "bg-secondary text-secondary-foreground")
                                    )}>
                                        {u.role === 'admin' ? 'Admin' : (u.role === 'driver' ? 'Motard' : 'Co-Gérant')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(u)}>
                                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                {user?.uid !== u.uid && (
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(u.uid)}>
                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* Edit Modal */}
            {isEditOpen && editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-sm shadow-2xl">
                        <CardHeader>
                            <CardTitle>Modification</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveEdit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nom complet</Label>
                                    <Input
                                        value={editingUser.displayName}
                                        onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rôle</Label>
                                    <Select
                                        value={editingUser.role}
                                        onValueChange={(value) => {
                                            if (isUserRole(value)) {
                                                setEditingUser({ ...editingUser, role: value });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="driver">Motard</SelectItem>
                                            <SelectItem value="co_manager">Co-Gérant</SelectItem>
                                            <SelectItem value="admin">Administrateur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Annuler</Button>
                                    <Button type="submit">Enregistrer</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </main>
    );
}
