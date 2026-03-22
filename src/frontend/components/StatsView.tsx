"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { subscribeToStats } from "@/backend/services/db-service";
import { WeeklyStats } from "@/shared/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatAmount } from "@/shared/lib/format";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const EMPTY_STATS: WeeklyStats = {
    currentWeek: { paid: 0, target: 200000, progress: 0 },
    career: { totalPaid: 0, startedAt: null },
    global: { totalSurplus: 0, totalDebt: 0 },
    history: []
};

export default function StatsView({
    selectedDriverId,
    selectedDriverLabel,
}: {
    selectedDriverId: string;
    selectedDriverLabel: string;
}) {
    const [stats, setStats] = useState<WeeklyStats>(EMPTY_STATS);

    useEffect(() => {
        if (!selectedDriverId) {
            return;
        }

        const unsubscribe = subscribeToStats((data) => {
            setStats(data);
        }, selectedDriverId);
        return () => unsubscribe();
    }, [selectedDriverId]);

    const displayedStats = selectedDriverId ? stats : EMPTY_STATS;
    const { career, global, history } = displayedStats;
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
            </div>

            <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                    <CardDescription>Total versé depuis le premier jour d&apos;activité</CardDescription>
                    <CardTitle className="text-3xl">
                        {formatAmount(career.totalPaid)} <span className="text-sm font-medium text-muted-foreground">FC</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                    {career.startedAt
                        ? `${selectedDriverLabel || "Motard"} actif depuis le ${format(career.startedAt, "d MMMM yyyy", { locale: fr })}.`
                        : "Aucun versement enregistré pour ce motard."}
                </CardContent>
            </Card>

            {/* Global Cards */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="border-primary/25 bg-primary/18 shadow-sm">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs uppercase tracking-wider">
                            <TrendingUp className="h-4 w-4" /> Surplus Global
                        </div>
                        <span className="text-2xl font-bold text-foreground">{formatAmount(global.totalSurplus)} <span className="text-sm font-medium opacity-70">FC</span></span>
                    </CardContent>
                </Card>
                <Card className="border-black/8 bg-card shadow-sm">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs uppercase tracking-wider">
                            <TrendingDown className="h-4 w-4" /> Dette Globale
                        </div>
                        <span className="text-2xl font-bold text-foreground">{formatAmount(global.totalDebt)} <span className="text-sm font-medium opacity-70">FC</span></span>
                    </CardContent>
                </Card>
            </div>

            {/* Evolution Chart */}
            <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground px-1">Évolution Hebdomadaire</h3>
                <Card className="h-[300px] border-black/8 p-4 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                            <CartesianGrid stroke="#d6d3d1" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#57534e' }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                width={56}
                                tick={{ fontSize: 10, fill: '#57534e' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => formatAmount(Number(value))}
                            />
                            <Tooltip
                                formatter={(value) => [`${formatAmount(Number(value ?? 0))} FC`, "Versé"]}
                                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 16px 35px rgba(0,0,0,0.12)', backgroundColor: '#fffdf7' }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <ReferenceLine y={200000} stroke="#78716c" strokeDasharray="3 3" label={{ value: 'Objectif', position: 'right', fontSize: 10, fill: '#78716c' }} />
                            <Bar dataKey="paid" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.paid >= entry.target ? '#facc15' : '#111111'} />
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
                                    <div className={cn("h-1 w-full", isSurplus ? "bg-primary" : "bg-foreground")} />
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 text-foreground font-bold">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    Semaine du {format(week.weekStart, "d MMM yyyy", { locale: fr })}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Objectif: {formatAmount(week.target)} FC
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                isSurplus ? "border-primary/30 bg-primary/18 text-foreground" : "border-black/10 bg-secondary/75 text-foreground"
                                            )}>
                                                {isSurplus ? "Excédent" : "Déficit"}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Payé</p>
                                                <p className="text-lg font-bold">{formatAmount(week.paid)} <span className="text-xs font-normal text-muted-foreground">FC</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{isSurplus ? "Positif" : "Manque"}</p>
                                                <p className={cn("text-lg font-bold", isSurplus ? "text-foreground" : "text-foreground/80")}>
                                                    {isSurplus ? "+" : ""}{formatAmount(week.balance)} <span className="text-xs font-normal text-muted-foreground">FC</span>
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
