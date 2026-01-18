"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { subscribeToStats } from "@/lib/db-service";
import { WeeklyStats } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

export default function StatsView() {
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
                    if (d.length > 0) setSelectedDriverId(d[0].uid);
                } catch (e) { console.error(e); }
            };
            fetchDrivers();
        } else if (userProfile) {
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

    const { global, history } = stats;

    // Prepare chart data (reverse history to show oldest first)
    const chartData = [...history].reverse().map(h => ({
        name: format(h.weekStart, "d MMM", { locale: fr }),
        paid: h.paid,
        target: h.target,
        balance: h.balance
    }));

    return (
        <div className="space-y-6 pb-24 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header / Filter */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Statistiques Détaillées</h2>
                {(userProfile?.role === 'admin' || userProfile?.role === 'co_manager') && (
                    <select
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="bg-card border border-border rounded-lg text-sm p-2 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        {drivers.map(d => (
                            <option key={d.uid} value={d.uid}>
                                {d.displayName || d.email}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Global Cards */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs uppercase tracking-wider">
                            <TrendingUp className="h-4 w-4" /> Surplus Global
                        </div>
                        <span className="text-2xl font-bold text-emerald-900">{global.totalSurplus.toLocaleString()} <span className="text-sm font-medium opacity-70">FC</span></span>
                    </CardContent>
                </Card>
                <Card className="bg-rose-50 border-rose-100 shadow-sm">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-rose-700 font-medium text-xs uppercase tracking-wider">
                            <TrendingDown className="h-4 w-4" /> Dette Globale
                        </div>
                        <span className="text-2xl font-bold text-rose-900">{global.totalDebt.toLocaleString()} <span className="text-sm font-medium opacity-70">FC</span></span>
                    </CardContent>
                </Card>
            </div>

            {/* Evolution Chart */}
            <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground px-1">Évolution Hebdomadaire</h3>
                <Card className="border-border/60 shadow-sm p-4 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#666' }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#666' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <ReferenceLine y={200000} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
                            <Bar dataKey="paid" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.paid >= entry.target ? '#10b981' : '#f43f5e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* History List */}
            <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground px-1">Historique Détaillé</h3>
                <div className="space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground bg-card rounded-2xl border border-dashed">
                            Aucune donnée disponible.
                        </div>
                    ) : (
                        history.map((week, index) => {
                            const isSurplus = week.balance >= 0;
                            return (
                                <Card key={index} className="border-border/60 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                                    <div className={cn("h-1 w-full", isSurplus ? "bg-emerald-500" : "bg-rose-500")} />
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 text-foreground font-bold">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    Semaine du {format(week.weekStart, "d MMM yyyy", { locale: fr })}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Objectif: {week.target.toLocaleString()} FC
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                isSurplus ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                                            )}>
                                                {isSurplus ? "Excédent" : "Déficit"}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Payé</p>
                                                <p className="text-lg font-bold">{week.paid.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">FC</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{isSurplus ? "Positif" : "Manque"}</p>
                                                <p className={cn("text-lg font-bold", isSurplus ? "text-emerald-600" : "text-rose-600")}>
                                                    {isSurplus ? "+" : ""}{week.balance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">FC</span>
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
