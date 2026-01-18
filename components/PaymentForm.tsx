"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPayment, updatePayment } from "@/lib/db-service"; // Ensure updatePayment is imported
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, UserProfile } from "@/contexts/AuthContext";

const TARGET_AMOUNT = 200000;

interface PaymentFormProps {
    onSuccess: () => void;
    initialData?: any;
    drivers?: any[]; // Allow passing drivers list
}

export default function PaymentForm({ onSuccess, initialData, drivers = [] }: PaymentFormProps) {
    const { user, userProfile } = useAuth();
    const [amount, setAmount] = useState<string>("");
    const [reason, setReason] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState<string>(initialData?.driverId || "");
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default today YYYY-MM-DD

    const ownerSigRef = useRef<SignaturePadRef>(null);
    const driverSigRef = useRef<SignaturePadRef>(null);

    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'co_manager';

    useEffect(() => {
        if (initialData) {
            setAmount(initialData.amount?.toString() || "");
            setReason(initialData.reason || "");
            setSelectedDriverId(initialData.driverId || "");
            if (initialData.date) {
                // Handle different date formats if needed, assuming Firestore Timestamp -> Date -> ISO String
                try {
                    const d = initialData.date.toDate ? initialData.date.toDate() : new Date(initialData.date);
                    setDate(d.toISOString().split('T')[0]);
                } catch (e) { console.error("Date parse error", e); }
            }
        } else {
            setAmount("");
            setReason("");
            setDate(new Date().toISOString().split('T')[0]); // Reset to today
            if (!isAdmin && user) setSelectedDriverId(user.uid);
        }
    }, [initialData, isAdmin, user]);

    const amountNum = parseInt(amount || "0");
    const shortfall = Math.max(0, TARGET_AMOUNT - amountNum);
    const isFull = amountNum >= TARGET_AMOUNT;
    const showReasonVideo = shortfall > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;
        if (shortfall > 0 && !reason) {
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
            const customDate = date ? new Date(date) : undefined;
            // Adjust time to current time to avoid timezone mess or 00:00 issues? 
            // Better to keep 00:00 or noon to ensure it falls on that day locally.
            // construct date carefully
            // new Date("2024-01-01") is UTC. "2024-01-01T12:00:00" is local.
            // input type=date gives YYYY-MM-DD.
            // new Date(date + "T12:00:00") is safer for "mid-day" logic to avoid timezone shifted to previous day?
            // Actually, let's just use `new Date(date)` which defaults to UTC 00:00, which might show as previous day in local time.
            // Best is `new Date(date + 'T12:00:00')` to be safe in the middle of the day.

            const localDate = new Date(date + 'T12:00:00');
            success = await addPayment(amountNum, TARGET_AMOUNT, ownerSig, driverSig, finalDriverId, driverName, reason, localDate);
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
                        <SelectTrigger className="h-12 bg-card border-border/60">
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
                        className="pl-12 h-12 bg-card border-border/60"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>
                <p className="text-xs text-muted-foreground pl-1">
                    Pour régulariser un paiement manqué, sélectionnez la date passée correspondante.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="amount" className="text-base font-semibold text-foreground pl-1">Montant du Versement</Label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-muted-foreground font-semibold text-lg">FC</span>
                        </div>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0"
                            className="pl-12 h-16 text-2xl font-bold rounded-2xl border-border/60 bg-card shadow-sm focus:ring-primary/20 focus:border-primary transition-all"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs text-muted-foreground font-medium">Objectif Journalier: <strong>200.000 FC</strong></span>

                        {amountNum > 0 && (
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                                shortfall > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                                {isFull ? "Objectif Atteint" : `Manque: ${shortfall.toLocaleString()} FC`}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reason Field - Animated Conditionally */}
                <div className={cn("space-y-2 transition-all duration-300 overflow-hidden", showReasonVideo ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
                    <Label htmlFor="reason" className="text-base font-semibold text-foreground pl-1">Raison du manquant <span className="text-destructive">*</span></Label>
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
                disabled={loading || !amount}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enregistrement...
                    </>
                ) : (
                    <>
                        <Check className="mr-2 h-6 w-6" /> {initialData ? "Mettre à jour" : "Confirmer le Versement"}
                    </>
                )}
            </Button>
        </form>
    );
}
