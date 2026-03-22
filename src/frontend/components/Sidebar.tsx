"use client";

import { useEffect } from "react";
import { X, LayoutDashboard, History, BarChart3, LogOut, Settings, Users, FileText } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/frontend/contexts/AuthContext";
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
    const canAccessAdministration =
        userProfile?.role === "admin" ||
        userProfile?.role === "co_manager" ||
        user?.email === "admin@gmail.com";

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
                "fixed inset-y-0 left-0 w-[280px] border-r border-black/8 bg-card/98 z-[70] shadow-[0_24px_60px_rgba(0,0,0,0.18)] transform transition-transform duration-300 ease-out flex flex-col backdrop-blur-xl",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between border-b border-black/8 bg-secondary/45 p-6">
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

                    {canAccessAdministration && (
                        <>
                            <div className="my-6 border-t border-border/30" />
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Administration</div>
                            <NavItem
                                icon={<Users size={20} />}
                                label="Utilisateurs"
                                active={false}
                                onClick={() => { router.push('/users'); onClose(); }}
                            />
                            <NavItem
                                icon={<FileText size={20} />}
                                label="Documents"
                                active={currentTab === 'documents'}
                                onClick={() => { onNavigate('documents'); onClose(); }}
                            />
                        </>
                    )}

                    <div className="my-6 border-t border-border/30" />

                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Système</div>
                    <NavItem
                        icon={<Settings size={20} />}
                        label="Paramètres"
                        active={currentTab === 'settings'}
                        onClick={() => { onNavigate('settings'); onClose(); }}
                    />
                    <NavItem
                        icon={<LogOut size={20} />}
                        label="Déconnexion"
                        active={false}
                        className="text-foreground/70 hover:text-foreground hover:bg-primary/20"
                        onClick={handleLogout}
                    />
                </div>

                <div className="border-t border-black/8 bg-secondary/35 p-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full border border-black/10 bg-primary/14 flex items-center justify-center text-foreground font-bold text-sm">
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

function NavItem({
    icon,
    label,
    active,
    onClick,
    className,
}: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                active
                    ? "bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                className
            )}
        >
            {icon}
            {label}
        </button>
    );
}
