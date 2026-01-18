"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToStats } from "@/lib/db-service";
import { WeeklyStats } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export default function StatsCard() {
    const { userProfile } = useAuth();
    const [stats, setStats] = useState<WeeklyStats>({
        currentWeek: { paid: 0, target: 200000, progress: 0 },
        global: { totalSurplus: 0, totalDebt: 0 },
        history: []
    });

    // Admin Driver Filter
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>("");

    // Fetch Drivers for Admin
    useEffect(() => {
        if (userProfile?.role === 'admin' || userProfile?.role === 'co_manager') {
            const fetchDrivers = async () => {
                try {
                    const { collection, getDocs } = await import("firebase/firestore");
                    const { db } = await import("@/lib/firebase");
                    const snap = await getDocs(collection(db, "users"));
                    const d = snap.docs.map(doc => doc.data()).filter(u => u.role === 'driver');
                    setDrivers(d);
                    if (d.length > 0) setSelectedDriverId(d[0].uid); // Default to first driver
                } catch (e) { console.error(e); }
            };
            fetchDrivers();
        } else if (userProfile) {
            // For driver, strict filter on themselves
            setSelectedDriverId(userProfile.uid);
        }
    }, [userProfile]);

    useEffect(() => {
        if (!selectedDriverId) return;

        const unsubscribe = subscribeToStats((data) => {
            setStats(data);
        }, selectedDriverId);
        return () => unsubscribe();
    }, [selectedDriverId]);

    const { currentWeek, global } = stats;
    const isOnTrack = currentWeek.progress >= 100;

    return (
        <Card className="border-none shadow-xl bg-primary text-primary-foreground overflow-hidden relative ring-1 ring-white/10">
            <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <CardHeader className="pb-2 relative z-10">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-medium text-primary-foreground/90 flex flex-col gap-1">
                        Cette Semaine
                        {(userProfile?.role === 'admin' || userProfile?.role === 'co_manager') && (
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                className="text-xs bg-white/20 border-none rounded text-white p-1 mt-1 cursor-pointer outline-none focus:ring-1 focus:ring-white/50"
                            >
                                {drivers.map(d => (
                                    <option key={d.uid} value={d.uid} className="text-black">
                                        {d.displayName || d.email}
                                    </option>
                                ))}
                            </select>
                        )}
                    </CardTitle>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full text-white font-bold">
                        {currentWeek.progress.toFixed(0)}%
                    </span>
                </div>
                <CardDescription className="text-primary-foreground/70">
                    Objectif: {currentWeek.target.toLocaleString()} FC
                </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
                <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold tracking-tight">
                        {currentWeek.paid.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-primary-foreground/70">FC</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden mb-4">
                    <div
                        className={cn("h-full transition-all duration-1000 ease-out", isOnTrack ? "bg-emerald-400" : "bg-white")}
                        style={{ width: `${Math.min(currentWeek.progress, 100)}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg border border-white/10">
                        <TrendingUp className="text-emerald-300 w-4 h-4" />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] text-primary-foreground/70 uppercase tracking-wider font-bold truncate">Surplus Global</span>
                            <span className="text-sm font-semibold text-white">{global.totalSurplus.toLocaleString()} FC</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg border border-white/10">
                        <TrendingDown className="text-rose-300 w-4 h-4" />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] text-primary-foreground/70 uppercase tracking-wider font-bold truncate">Dette Globale</span>
                            <span className="text-sm font-semibold text-white">{global.totalDebt.toLocaleString()} FC</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
