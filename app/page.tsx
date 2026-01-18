"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Wallet, History, PlusCircle, LayoutDashboard, Menu, BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PaymentForm from "@/components/PaymentForm";
import HistoryList from "@/components/HistoryList";
import StatsCard from "@/components/StatsCard";
import PaymentDetails from "@/components/PaymentDetails";
import Sidebar from "@/components/Sidebar";
import StatsView from "@/components/StatsView";
import { Payment } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "new" | "details" | "edit" | "stats">("dashboard");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user && (userProfile?.role === 'admin' || userProfile?.role === 'co_manager')) {
      const fetchDrivers = async () => {
        // Fetch all users for simplicity so admin can select anyone
        try {
          const userQuery = query(collection(db, "users"));
          const snap = await getDocs(userQuery);
          setDrivers(snap.docs.map(d => d.data()));
        } catch (e) { console.error(e); }
      };
      fetchDrivers();
    }
  }, [user, loading, router, userProfile]);

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

  // Close sidebar when tab changes effectively handled by Sidebar component mostly, but good to be safe
  const handleNavigate = (tab: any) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <main className="min-h-screen bg-background pb-28 text-foreground">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentTab={activeTab}
        onNavigate={handleNavigate}
      />

      {/* Header - Modern Fintech Style */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-5">
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
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-xs ring-4 ring-background shadow-lg">
            {(userProfile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="px-5 pt-6 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

        {activeTab === "dashboard" && (
          <div className="space-y-8">
            <StatsCard />

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-semibold text-foreground">Accès Rapide</h2>
              </div>
              {(userProfile?.role === 'admin' || userProfile?.role === 'co_manager') && (
                <button
                  onClick={() => { setSelectedPayment(null); setActiveTab("new"); }}
                  className="w-full relative overflow-hidden flex items-center gap-5 p-5 rounded-3xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                >
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
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
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-semibold text-foreground">Activité Récente</h2>
                <button onClick={() => setActiveTab("history")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  Tout voir
                </button>
              </div>
              <HistoryList
                limit={3}
                onSelectPayment={handlePaymentSelect}
                userId={user.uid}
                userRole={userProfile?.role}
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
              onSuccess={handlePaymentSuccess}
              initialData={activeTab === "edit" ? selectedPayment : undefined}
              drivers={drivers}
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
            <HistoryList
              onSelectPayment={handlePaymentSelect}
              userId={user.uid}
              userRole={userProfile?.role}
            />
          </div>
        )}

        {activeTab === "stats" && (
          <StatsView />
        )}

      </div>

      {/* Floating Bottom Navigation */}
      {/* Hidden when in sidebar logic if needed, but usually stays for quick access */}
      {/* We hide it on details/edit pages for cleaner view? Or keep it? */}
      {/* User didn't specify, but often easier to navigate if always there. Let's keep it but maybe hide on full input forms to avoid keyboard issues. */}
      {/* For now, sticking to previous behavior: always visible */}
      <nav className="fixed bottom-6 left-6 right-6 z-50 max-w-md mx-auto">
        <div className="bg-foreground/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-1.5 flex justify-between items-center relative">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-300 relative overflow-hidden",
              activeTab === "dashboard" || activeTab === "new" || activeTab === "edit" || activeTab === "details" ? "text-white bg-white/10" : "text-white/50 hover:text-white/80 hover:bg-white/5"
            )}
          >
            <LayoutDashboard size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold tracking-wide">Accueil</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all duration-300 relative overflow-hidden",
              activeTab === "history" || activeTab === "stats" ? "text-white bg-white/10" : "text-white/50 hover:text-white/80 hover:bg-white/5"
            )}
          >
            <History size={22} strokeWidth={2.5} />
            <span className="text-[10px] font-bold tracking-wide">Historique</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
