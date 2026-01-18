"use client";

import { useEffect } from "react";
import { X, LayoutDashboard, History, BarChart3, LogOut, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentTab: string;
    onNavigate: (tab: string) => void;
}

export default function Sidebar({ isOpen, onClose, currentTab, onNavigate }: SidebarProps) {
    const { user, userProfile, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await logout();
            onClose();
            router.push('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };
    // Prevent scrolling when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 w-[280px] bg-background border-r border-border/50 z-[70] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 border-b border-border/30 flex justify-between items-center bg-muted/10">
                    <h2 className="text-xl font-bold tracking-tight">
                        Moto<span className="text-primary">Manager</span>
                    </h2>
                    <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Menu Principal</div>

                    <NavItem
                        icon={<LayoutDashboard size={20} />}
                        label="Tableau de bord"
                        active={currentTab === 'dashboard' || currentTab === 'new'}
                        onClick={() => { onNavigate('dashboard'); onClose(); }}
                    />
                    <NavItem
                        icon={<History size={20} />}
                        label="Historique"
                        active={currentTab === 'history'}
                        onClick={() => { onNavigate('history'); onClose(); }}
                    />
                    <NavItem
                        icon={<BarChart3 size={20} />}
                        label="Statistiques"
                        active={currentTab === 'stats'}
                        onClick={() => { onNavigate('stats'); onClose(); }}
                    />

                    {(userProfile?.role === 'admin' || userProfile?.role === 'co_manager') && (
                        <>
                            <div className="my-6 border-t border-border/30" />
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Administration</div>
                            <NavItem
                                icon={<Users size={20} />}
                                label="Utilisateurs"
                                active={false}
                                onClick={() => { router.push('/users'); onClose(); }}
                            />
                        </>
                    )}

                    <div className="my-6 border-t border-border/30" />

                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Système</div>
                    <NavItem
                        icon={<Settings size={20} />}
                        label="Paramètres"
                        active={false}
                        onClick={() => onClose()}
                    />
                    <NavItem
                        icon={<LogOut size={20} />}
                        label="Déconnexion"
                        active={false}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={handleLogout}
                    />
                </div>

                <div className="p-6 border-t border-border/30 bg-muted/5">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {(userProfile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{userProfile?.displayName || "Utilisateur"}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                                {userProfile?.role === 'driver' ? 'Motard' : (userProfile?.role || 'Chauffeur')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function NavItem({ icon, label, active, onClick, className }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                active
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                className
            )}
        >
            {icon}
            {label}
        </button>
    );
}
