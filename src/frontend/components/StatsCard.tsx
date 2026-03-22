"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { subscribeToStats } from "@/backend/services/db-service";
import { DriverOption, WeeklyStats } from "@/shared/types";
import { formatAmount } from "@/shared/lib/format";

const EMPTY_STATS: WeeklyStats = {
    currentWeek: { paid: 0, target: 200000, progress: 0 },
    career: { totalPaid: 0, startedAt: null },
    global: { totalSurplus: 0, totalDebt: 0 },
    history: []
};

export default function StatsCard({
    drivers,
    selectedDriverId,
    selectedDriverLabel,
    onDriverChange,
    canSelectDriver = true,
}: {
    drivers: DriverOption[];
    selectedDriverId: string;
    selectedDriverLabel: string;
    onDriverChange: (driverId: string) => void;
    canSelectDriver?: boolean;
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
    const { currentWeek, career, global } = displayedStats;
    const isOnTrack = currentWeek.progress >= 100;
    const showDriverSelect = canSelectDriver && drivers.length > 0;

    return (
        <Card className="relative overflow-hidden border-none bg-foreground text-background shadow-[0_25px_60px_rgba(0,0,0,0.24)] ring-1 ring-black/10">
            <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-primary/45 blur-3xl" />
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(135deg,transparent_0%,rgba(250,204,21,0.08)_45%,transparent_100%)]" />

            <CardHeader className="pb-2 relative z-10">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-medium text-background/88">
                        Cette Semaine
                    </CardTitle>
                    <span className="rounded-full border border-primary/30 bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                        {currentWeek.progress.toFixed(0)}%
                    </span>
                </div>
                {showDriverSelect && (
                    <div className="pt-2">
                        <Select value={selectedDriverId} onValueChange={onDriverChange}>
                            <SelectTrigger className="w-full rounded-2xl border-primary/20 bg-white/8 text-sm font-medium text-white ring-offset-transparent focus:ring-primary/35 focus:ring-offset-0 [&>span]:text-white">
                                <SelectValue placeholder="Choisir un motard" />
                            </SelectTrigger>
                            <SelectContent>
                                {drivers.map((driver) => (
                                    <SelectItem key={driver.uid} value={driver.uid}>
                                        {driver.displayName || driver.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <CardDescription className="text-background/66">
                    {selectedDriverLabel ? `${selectedDriverLabel} · ` : ""}Objectif: {formatAmount(currentWeek.target)} FC
                </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
                <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold tracking-tight">
                        {formatAmount(currentWeek.paid)}
                    </span>
                    <span className="text-sm font-medium text-background/60">FC</span>
                </div>

                <div className="mb-4 rounded-[24px] border border-white/10 bg-white/7 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-background/60">
                        Total versé depuis le début
                    </p>
                    <div className="mt-1 flex items-end gap-1">
                        <span className="text-2xl font-bold text-white">
                            {formatAmount(career.totalPaid)}
                        </span>
                        <span className="text-xs font-medium text-background/60">FC</span>
                    </div>
                    <p className="mt-1 text-xs text-background/60">
                        {career.startedAt
                            ? `Depuis le ${format(career.startedAt, "d MMM yyyy", { locale: fr })}`
                            : "Aucun versement enregistré."}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className={cn("h-full transition-all duration-1000 ease-out", isOnTrack ? "bg-primary" : "bg-background")}
                        style={{ width: `${Math.min(currentWeek.progress, 100)}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-primary/12 bg-primary/10 p-3">
                        <TrendingUp className="h-4 w-4 text-white" />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-background/58 truncate">Surplus Global</span>
                            <span className="text-sm font-semibold text-white">{formatAmount(global.totalSurplus)} FC</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 p-3">
                        <TrendingDown className="h-4 w-4 text-white" />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-background/58 truncate">Dette Globale</span>
                            <span className="text-sm font-semibold text-white">{formatAmount(global.totalDebt)} FC</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
