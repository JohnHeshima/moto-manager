"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { History, PlusCircle, LayoutDashboard, Menu, Loader2, Mail, ShieldCheck, UserRound, LogOut, Users, Settings } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import PaymentForm from "@/frontend/components/PaymentForm";
import HistoryList from "@/frontend/components/HistoryList";
import StatsCard from "@/frontend/components/StatsCard";
import PaymentDetails from "@/frontend/components/PaymentDetails";
import Sidebar from "@/frontend/components/Sidebar";
import StatsView from "@/frontend/components/StatsView";
import DriverFilter from "@/frontend/components/DriverFilter";
import DocumentsView from "@/frontend/components/DocumentsView";
import SettingsView from "@/frontend/components/SettingsView";
import { DriverOption, Payment } from "@/shared/types";
import { useAuth } from "@/frontend/contexts/AuthContext";
import { useRouter } from "next/navigation";

import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/backend/firebase/firebase";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "new" | "details" | "edit" | "stats" | "documents" | "settings">("dashboard");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      const fetchDrivers = async () => {
        try {
          const userQuery = query(collection(db, "users"));
          const snap = await getDocs(userQuery);
          const driverOptions = snap.docs
            .map(d => d.data() as DriverOption)
            .filter(profile => profile.role === "driver");

          setDrivers(driverOptions);
          setSelectedDriverId((current) => {
            if (current && driverOptions.some(driver => driver.uid === current)) {
              return current;
            }

            if (userProfile?.role === "driver" && userProfile.uid) {
              return userProfile.uid;
            }

            return driverOptions[0]?.uid || "";
          });
        } catch (e) { console.error(e); }
      };
      fetchDrivers();
    }
  }, [user, loading, router, userProfile]);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isProfileOpen]);

  const canChooseDriver = drivers.length > 0;
  const effectiveDrivers = drivers.length > 0
    ? drivers
    : userProfile
      ? [
        {
          uid: userProfile.uid,
          displayName: userProfile.displayName,
          email: userProfile.email,
          role: userProfile.role
        }
      ]
      : [];
  const effectiveSelectedDriverId = selectedDriverId
    || drivers[0]?.uid
    || userProfile?.uid
    || "";
  const selectedDriver = effectiveDrivers.find(driver => driver.uid === effectiveSelectedDriverId);
  const selectedDriverLabel = selectedDriver?.displayName || selectedDriver?.email || (userProfile?.role === "driver" ? (userProfile.displayName || userProfile.email || "Mon compte") : "");

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handlePaymentSelect = (payment: Payment) => {
    setSelectedPayment(payment);
    setActiveTab("details");
  };

  const handlePaymentSuccess = () => {
    setSelectedPayment(null);
    setActiveTab("dashboard");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const roleLabel = userProfile?.role === "admin"
    ? "Administrateur"
    : userProfile?.role === "co_manager"
      ? "Co-gérant"
      : "Motard";

  // Close sidebar when tab changes effectively handled by Sidebar component mostly, but good to be safe
  const handleNavigate = (tab: string) => {
    if (tab === "dashboard" || tab === "history" || tab === "new" || tab === "details" || tab === "edit" || tab === "stats" || tab === "documents" || tab === "settings") {
      setActiveTab(tab);
    }
    setIsSidebarOpen(false);
  };

  return (
    <main className="min-h-screen bg-transparent pb-28 text-foreground">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentTab={activeTab}
        onNavigate={handleNavigate}
      />

      {/* Header - Modern Fintech Style */}
      <header className="sticky top-0 z-20 border-b border-black/8 bg-background/85 px-6 py-5 backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-full hover:bg-muted/50 transition-colors"
            >
              <Menu className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
                Moto<span className="text-primary">Manager</span>
              </h1>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
                {format(new Date(), "EEEE d MMM", { locale: fr })}
              </p>
            </div>
          </div>
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileOpen((open) => !open)}
              className="h-9 w-9 rounded-full border border-black/10 bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs ring-4 ring-background shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition hover:scale-105"
            >
              {(userProfile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-14 w-72 rounded-3xl border border-black/10 bg-card/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl border border-black/10 bg-primary/14 text-foreground flex items-center justify-center font-bold text-base">
                    {(userProfile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {userProfile?.displayName || "Utilisateur connecté"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {userProfile?.email || user?.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 rounded-2xl border border-black/5 bg-secondary/60 p-3">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>{roleLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{userProfile?.email || user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRound className="h-4 w-4" />
                    <span className="truncate">{user?.uid}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {(userProfile?.role === "admin" || userProfile?.role === "co_manager") && (
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        router.push("/users");
                      }}
                      className="flex-1 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Utilisateurs
                      </span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex-1 rounded-2xl bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="px-5 pt-6 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

        {activeTab === "dashboard" && (
          <div className="space-y-8">
            <StatsCard
              drivers={effectiveDrivers}
              selectedDriverId={effectiveSelectedDriverId}
              selectedDriverLabel={selectedDriverLabel}
              onDriverChange={setSelectedDriverId}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-semibold text-foreground">Accès Rapide</h2>
              </div>
              <button
                onClick={() => { setSelectedPayment(null); setActiveTab("new"); }}
                className="w-full relative overflow-hidden flex items-center gap-5 rounded-[28px] border border-black/10 bg-card p-5 shadow-[0_12px_35px_rgba(0,0,0,0.07)] transition-all active:scale-[0.98] group hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/18 via-primary/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-14 w-14 rounded-2xl border border-black/10 bg-primary/14 flex items-center justify-center text-foreground group-hover:scale-110 transition-transform duration-300">
                  <PlusCircle size={28} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-base text-foreground">Nouveau Versement</p>
                  <p className="text-sm text-muted-foreground">Enregistrer un paiement journalier</p>
                </div>
                <div className="text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </div>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Activité Récente</h2>
                  {selectedDriverLabel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Affichage filtré sur {selectedDriverLabel}
                    </p>
                  )}
                </div>
                <button onClick={() => setActiveTab("history")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  Tout voir
                </button>
              </div>
              <HistoryList
                limit={3}
                onSelectPayment={handlePaymentSelect}
                userId={user.uid}
                userRole={userProfile?.role}
                selectedDriverId={effectiveSelectedDriverId}
              />
            </div>
          </div>
        )}

        {/* Details View */}
        {activeTab === "details" && selectedPayment && (
          <PaymentDetails
            payment={selectedPayment}
            onEdit={() => setActiveTab("edit")}
            onBack={() => setActiveTab("history")}
          />
        )}

        {(activeTab === "new" || activeTab === "edit") && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setActiveTab(activeTab === "edit" ? "details" : "dashboard")}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <h2 className="font-bold text-xl">{activeTab === "edit" ? "Modifier Paiement" : "Nouveau Paiement"}</h2>
            </div>
            <PaymentForm
              key={activeTab === "edit" ? `edit-${selectedPayment?.id || "payment"}` : `new-${user.uid}-${effectiveSelectedDriverId || "none"}`}
              onSuccess={handlePaymentSuccess}
              initialData={activeTab === "edit" ? selectedPayment : undefined}
              drivers={effectiveDrivers}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <h2 className="font-bold text-xl">Historique Complet</h2>
            </div>
            {canChooseDriver && (
              <DriverFilter
                drivers={drivers}
                selectedDriverId={effectiveSelectedDriverId}
                onDriverChange={setSelectedDriverId}
                compact
              />
            )}
            <HistoryList
              onSelectPayment={handlePaymentSelect}
              userId={user.uid}
              userRole={userProfile?.role}
              selectedDriverId={effectiveSelectedDriverId}
            />
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-6">
            {canChooseDriver && (
              <DriverFilter
                drivers={drivers}
                selectedDriverId={effectiveSelectedDriverId}
                onDriverChange={setSelectedDriverId}
                compact
              />
            )}
            <StatsView
              selectedDriverId={effectiveSelectedDriverId}
              selectedDriverLabel={selectedDriverLabel}
            />
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <h2 className="font-bold text-xl">Documents</h2>
            </div>
            {canChooseDriver && (
              <DriverFilter
                drivers={drivers}
                selectedDriverId={effectiveSelectedDriverId}
                onDriverChange={setSelectedDriverId}
                compact
              />
            )}
            <DocumentsView
              selectedDriverId={effectiveSelectedDriverId}
              selectedDriverLabel={selectedDriverLabel}
              uploadedById={user.uid}
              uploadedByName={userProfile?.displayName || user.email || "Utilisateur"}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors -ml-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <h2 className="font-bold text-xl">Paramètres</h2>
            </div>
            <SettingsView
              key={`${user.uid}-${userProfile?.email || user.email || ""}-${userProfile?.displayName || ""}`}
              onOpenDocuments={() => setActiveTab("documents")}
              onLogout={handleLogout}
            />
          </div>
        )}

      </div>

      {/* Floating Bottom Navigation */}
      {/* Hidden when in sidebar logic if needed, but usually stays for quick access */}
      {/* We hide it on details/edit pages for cleaner view? Or keep it? */}
      {/* User didn't specify, but often easier to navigate if always there. Let's keep it but maybe hide on full input forms to avoid keyboard issues. */}
      {/* For now, sticking to previous behavior: always visible */}
      <nav className="fixed bottom-5 left-4 right-4 z-50 max-w-md mx-auto">
        <div className="rounded-[28px] border border-black/8 bg-[#1f1a16]/96 p-2 shadow-[0_22px_55px_rgba(0,0,0,0.34)] backdrop-blur-2xl flex items-center gap-2 relative">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[20px] py-3.5 transition-all duration-300 relative overflow-hidden",
              activeTab === "dashboard" || activeTab === "new" || activeTab === "edit" || activeTab === "details" ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,0,0,0.18)]" : "text-primary/70 hover:text-primary hover:bg-white/5"
            )}
          >
            <LayoutDashboard size={22} strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-wide">Accueil</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[20px] py-3.5 transition-all duration-300 relative overflow-hidden",
              activeTab === "history" || activeTab === "stats" || activeTab === "documents" ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,0,0,0.18)]" : "text-primary/70 hover:text-primary hover:bg-white/5"
            )}
          >
            <History size={22} strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-wide">Historique</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[20px] py-3.5 transition-all duration-300 relative overflow-hidden",
              activeTab === "settings" ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,0,0,0.18)]" : "text-primary/70 hover:text-primary hover:bg-white/5"
            )}
          >
            <Settings size={22} strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-wide">Paramètres</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
