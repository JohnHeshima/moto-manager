"use client";

import { DriverOption } from "@/shared/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";

export default function DriverFilter({
    drivers,
    selectedDriverId,
    onDriverChange,
    compact = false,
}: {
    drivers: DriverOption[];
    selectedDriverId: string;
    onDriverChange: (driverId: string) => void;
    compact?: boolean;
}) {
    if (drivers.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                Aucun motard disponible pour le filtre.
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-black/10 bg-card px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        Motard sélectionné
                    </p>
                    {!compact && (
                        <p className="mt-1 text-sm text-muted-foreground">
                           Filtre rapide pour isoler les données d&apos;un seul motard
                        </p>
                    )}
                </div>
                <div className="min-w-[220px]">
                    <Select value={selectedDriverId} onValueChange={onDriverChange}>
                        <SelectTrigger className="rounded-2xl border-black/10 bg-secondary/60 text-sm font-semibold text-foreground">
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
            </div>
        </div>
    );
}
