"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import SignaturePad, { SignaturePadRef } from "@/frontend/components/SignaturePad";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { addPayment, addPaymentRange, updatePayment } from "@/backend/services/db-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { useAuth } from "@/frontend/contexts/AuthContext";
import { formatAmount } from "@/shared/lib/format";
import { DriverOption, Payment } from "@/shared/types";
import { buildPaymentRangePlan, PaymentType } from "@/shared/lib/payment-allocation";

const TARGET_AMOUNT = 200000;

interface PaymentFormProps {
    onSuccess: () => void;
    initialData?: Payment | null;
    drivers?: DriverOption[];
}

function getDateInputValue(date: Date | undefined) {
    if (!date) {
        return new Date().toISOString().split('T')[0];
    }

    return date.toISOString().split('T')[0];
}

function getInitialPaymentType(payment?: Payment | null): PaymentType {
    return payment?.paymentType === "range" || payment?.paymentType === "range_parent" || payment?.paymentType === "range_item"
        ? "range"
        : "weekly";
}

export default function PaymentForm({ onSuccess, initialData, drivers = [] }: PaymentFormProps) {
    const { user, userProfile } = useAuth();
    const isEditing = Boolean(initialData?.id);
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'co_manager';
    const [paymentType, setPaymentType] = useState<PaymentType>(getInitialPaymentType(initialData));
    const [amount, setAmount] = useState<string>(initialData?.amount?.toString() || "");
    const [reason, setReason] = useState<string>(initialData?.reason || "");
    const [loading, setLoading] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState<string>(
        initialData?.driverId || (!isAdmin && user ? user.uid : "")
    );
    const [date, setDate] = useState<string>(getDateInputValue(initialData?.date));
    const [rangeStartDate, setRangeStartDate] = useState<string>(getDateInputValue(initialData?.periodStart || initialData?.date));
    const [rangeEndDate, setRangeEndDate] = useState<string>(getDateInputValue(initialData?.periodEnd || initialData?.date));

    const ownerSigRef = useRef<SignaturePadRef>(null);
    const driverSigRef = useRef<SignaturePadRef>(null);

    const activePaymentType = isEditing ? "weekly" : paymentType;
    const amountNum = parseInt(amount || "0");
    const shortfall = Math.max(0, TARGET_AMOUNT - amountNum);
    const isFull = amountNum >= TARGET_AMOUNT;
    const rangePlan = activePaymentType === "range"
        ? buildPaymentRangePlan({
            startDate: new Date(`${rangeStartDate}T12:00:00`),
            endDate: new Date(`${rangeEndDate}T12:00:00`),
            totalAmount: amountNum,
            targetAmount: TARGET_AMOUNT,
        })
        : null;
    const rangeLastAllocation = rangePlan?.allocations[rangePlan.allocations.length - 1];
    const showReasonVideo = activePaymentType === "weekly"
        ? shortfall > 0
        : Boolean(rangeLastAllocation && rangeLastAllocation.shortfall > 0);
    const isRangeSubmissionBlocked = activePaymentType === "range" && (!rangePlan || !rangePlan.isValid);

    if (!isAdmin) {
        return (
            <div className="rounded-[28px] border border-black/10 bg-card p-5 text-sm text-muted-foreground shadow-[0_12px_35px_rgba(0,0,0,0.06)]">
                Les motards ne peuvent pas créer ni modifier les versements.
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        if (activePaymentType === "range" && (!rangePlan || !rangePlan.isValid)) {
            alert(rangePlan?.validationMessage || "Veuillez corriger l'intervalle avant de continuer.");
            return;
        }

        if (showReasonVideo && !reason) {
            alert("Veuillez indiquer la raison du manquant.");
            return;
        }

        if (isAdmin && !selectedDriverId) {
            alert("Veuillez sélectionner un motard.");
            return;
        }

        setLoading(true);

        const ownerSig = ownerSigRef.current?.isEmpty() ? (initialData?.ownerSignature || "") : ownerSigRef.current?.toDataURL() || "";
        const driverSig = driverSigRef.current?.isEmpty() ? (initialData?.driverSignature || "") : driverSigRef.current?.toDataURL() || "";

        // Determine driver details
        let driverName = "Inconnu";
        let finalDriverId = selectedDriverId;

        if (isAdmin) {
            const d = drivers.find(u => u.uid === selectedDriverId);
            driverName = d?.displayName || "Inconnu";
        } else {
            finalDriverId = user?.uid || "";
            driverName = userProfile?.displayName || user?.email || "Moi";
        }

        let success;

        if (initialData?.id) {
            // Update currently doesn't support date change in db-service, assume strictly for creation now or ignore.
            // If we want to support editing date, we need to update db-service too.
            // For now, MVP: only new payments support backdating.
            success = await updatePayment(initialData.id, amountNum, TARGET_AMOUNT, ownerSig, driverSig, reason);
        } else {
            if (activePaymentType === "range") {
                success = await addPaymentRange({
                    totalAmount: amountNum,
                    targetAmount: TARGET_AMOUNT,
                    ownerSignature: ownerSig,
                    driverSignature: driverSig,
                    driverId: finalDriverId,
                    driverName,
                    reason,
                    startDate: new Date(`${rangeStartDate}T12:00:00`),
                    endDate: new Date(`${rangeEndDate}T12:00:00`),
                });
            } else {
                const localDate = new Date(date + 'T12:00:00');
                success = await addPayment(amountNum, TARGET_AMOUNT, ownerSig, driverSig, finalDriverId, driverName, reason, localDate);
            }
        }

        setLoading(false);
        if (success) {
            onSuccess();
        } else {
            alert("Erreur lors de l'enregistrement");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-32">

            {isAdmin && (
                <div className="space-y-2">
                    <Label htmlFor="driver" className="text-base font-semibold text-foreground pl-1">Motard Concerné</Label>
                    <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                        <SelectTrigger className="h-12 border-black/10 bg-card">
                            <SelectValue placeholder="Choisir un motard..." />
                        </SelectTrigger>
                        <SelectContent>
                            {drivers.filter(d => d.role === 'driver').map(d => (
                                <SelectItem key={d.uid} value={d.uid}>
                                    {d.displayName || d.email}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {!isEditing && (
                <div className="space-y-3">
                    <Label className="text-base font-semibold text-foreground pl-1">Type de paiement</Label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setPaymentType("weekly")}
                            className={cn(
                                "rounded-2xl border px-4 py-4 text-left transition-all",
                                paymentType === "weekly"
                                    ? "border-primary/30 bg-primary/12 shadow-sm"
                                    : "border-black/10 bg-card hover:bg-secondary/55"
                            )}
                        >
                            <p className="text-sm font-bold text-foreground">Hebdomadaire</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Paiement simple, comme aujourd&apos;hui.
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentType("range")}
                            className={cn(
                                "rounded-2xl border px-4 py-4 text-left transition-all",
                                paymentType === "range"
                                    ? "border-primary/30 bg-primary/12 shadow-sm"
                                    : "border-black/10 bg-card hover:bg-secondary/55"
                            )}
                        >
                            <p className="text-sm font-bold text-foreground">Intervalle</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Répartit automatiquement sur plusieurs semaines.
                            </p>
                        </button>
                    </div>
                </div>
            )}

            {activePaymentType === "weekly" ? (
                <div className="space-y-2">
                    <Label htmlFor="date" className="text-base font-semibold text-foreground pl-1">Date du Versement</Label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <Input
                            id="date"
                            type="date"
                            required
                            className="h-12 border-black/10 bg-card pl-12"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                        Pour régulariser un paiement manqué, sélectionnez la date passée correspondante.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <Label className="text-base font-semibold text-foreground pl-1">Intervalle à répartir</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="range-start" className="text-sm text-muted-foreground">Date de début</Label>
                            <Input
                                id="range-start"
                                type="date"
                                required
                                className="h-12 border-black/10 bg-card"
                                value={rangeStartDate}
                                onChange={(e) => setRangeStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="range-end" className="text-sm text-muted-foreground">Date de fin</Label>
                            <Input
                                id="range-end"
                                type="date"
                                required
                                className="h-12 border-black/10 bg-card"
                                value={rangeEndDate}
                                onChange={(e) => setRangeEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                        L&apos;intervalle est découpé en semaines. Les semaines intermédiaires restent à {formatAmount(TARGET_AMOUNT)} FC et le surplus ou le manque tombe sur la dernière.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="amount" className="text-base font-semibold text-foreground pl-1">
                        {activePaymentType === "range" ? "Montant total à répartir" : "Montant du Versement"}
                    </Label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-muted-foreground font-semibold text-lg">FC</span>
                        </div>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0"
                            className="h-16 rounded-2xl border-black/10 bg-card pl-12 text-2xl font-bold shadow-sm transition-all focus:border-primary focus:ring-primary/20"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            inputMode="numeric"
                            required
                        />
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs text-muted-foreground font-medium">
                            {activePaymentType === "range" ? "Base par semaine" : "Objectif journalier"}: <strong>{formatAmount(TARGET_AMOUNT)} FC</strong>
                        </span>

                        {amountNum > 0 && (
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                                activePaymentType === "range"
                                    ? "bg-primary/18 text-foreground"
                                    : shortfall > 0
                                        ? "bg-secondary text-foreground/75"
                                        : "bg-primary/18 text-foreground"
                            )}>
                                {activePaymentType === "range"
                                    ? (rangePlan?.weekCount ? `${rangePlan.weekCount} semaine(s)` : "Intervalle")
                                    : (isFull ? "Objectif atteint" : `Manque: ${formatAmount(shortfall)} FC`)}
                            </span>
                        )}
                    </div>
                    {amountNum > 0 && (
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
                            Montant formaté: <span className="font-bold">{formatAmount(amountNum)} FC</span>
                        </div>
                    )}
                </div>

                {activePaymentType === "range" && rangePlan && (
                    <div className="space-y-3 rounded-[26px] border border-black/10 bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-foreground">Prévisualisation de la répartition</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {rangePlan.weekCount > 0
                                        ? `${rangePlan.weekCount} semaine(s) générée(s) entre le ${format(new Date(`${rangeStartDate}T12:00:00`), "d MMM yyyy", { locale: fr })} et le ${format(new Date(`${rangeEndDate}T12:00:00`), "d MMM yyyy", { locale: fr })}.`
                                        : "Choisis une plage valide pour voir la répartition."}
                                </p>
                            </div>
                            <div className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                Aperçu
                            </div>
                        </div>

                        {!rangePlan.isValid ? (
                            <div className="rounded-2xl border border-black/10 bg-secondary/70 px-4 py-3 text-sm text-foreground/80">
                                <p className="font-semibold">Répartition impossible pour l&apos;instant.</p>
                                <p className="mt-1">{rangePlan.validationMessage}</p>
                                {rangePlan.minimumAmountForLastWeekCarry > 0 && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Minimum requis pour que seules les semaines précédentes restent à {formatAmount(TARGET_AMOUNT)} FC: {formatAmount(rangePlan.minimumAmountForLastWeekCarry)} FC.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rangePlan.allocations.map((allocation) => {
                                    const isLastWeek = allocation.index === rangePlan.weekCount;

                                    return (
                                        <div key={allocation.index} className="rounded-2xl border border-black/8 bg-background/70 px-4 py-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Semaine {allocation.index}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {format(allocation.startDate, "d MMM", { locale: fr })} au {format(allocation.endDate, "d MMM yyyy", { locale: fr })}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-bold text-foreground">{formatAmount(allocation.amount)} FC</p>
                                                    <p className="text-[11px] text-muted-foreground">Cible: {formatAmount(allocation.targetAmount)} FC</p>
                                                </div>
                                            </div>
                                            {isLastWeek && (allocation.shortfall > 0 || allocation.surplus > 0) && (
                                                <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
                                                    {allocation.surplus > 0
                                                        ? `Surplus final sur cette semaine: ${formatAmount(allocation.surplus)} FC`
                                                        : `Manque final sur cette semaine: ${formatAmount(allocation.shortfall)} FC`}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Reason Field - Animated Conditionally */}
                <div className={cn("space-y-2 transition-all duration-300 overflow-hidden", showReasonVideo ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
                    <Label htmlFor="reason" className="text-base font-semibold text-foreground pl-1">
                        {activePaymentType === "range" ? "Raison du manque final" : "Raison du manquant"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="reason"
                        placeholder="Ex: Panne mécanique, Peau de police..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required={showReasonVideo}
                        className="h-12 bg-card border-border/60"
                    />
                </div>
            </div>

            <div className="grid gap-6">
                <div className="space-y-2">
                    <Label className="text-base font-semibold text-foreground pl-1">Signatures Requises {initialData && <span className="text-xs font-normal text-muted-foreground">(Laisser vide pour conserver)</span>}</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SignaturePad label="Signature Propriétaire" ref={ownerSigRef} />
                        <SignaturePad label="Signature Motard" ref={driverSigRef} />
                    </div>
                </div>
            </div>

            <Button
                type="submit"
                size="lg"
                className="w-full text-lg h-14 rounded-2xl shadow-xl shadow-primary/25 font-bold tracking-wide transition-all active:scale-[0.98]"
                disabled={loading || !amount || isRangeSubmissionBlocked}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enregistrement...
                    </>
                ) : (
                    <>
                        <Check className="mr-2 h-6 w-6" /> {initialData ? "Mettre à jour" : activePaymentType === "range" ? "Créer le lot de paiements" : "Confirmer le Versement"}
                    </>
                )}
            </Button>
        </form>
    );
}
