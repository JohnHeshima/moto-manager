"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Payment } from "@/shared/types";
import { subscribeToPayments } from "@/backend/services/db-service";
import { cn } from "@/shared/lib/utils";
import { formatAmount } from "@/shared/lib/format";

export default function HistoryList({
    limit,
    onSelectPayment,
    userId,
    userRole,
    selectedDriverId
}: {
    limit?: number,
    onSelectPayment?: (payment: Payment) => void,
    userId?: string,
    userRole?: string,
    selectedDriverId?: string
}) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const requiresDriverSelection = userRole === "admin" || userRole === "co_manager";

    useEffect(() => {
        if (requiresDriverSelection && !selectedDriverId) {
            return;
        }

        const unsubscribe = subscribeToPayments((data) => {
            setPayments(data);
        }, userId, userRole, limit || 50, selectedDriverId);
        return () => unsubscribe();
    }, [limit, userId, userRole, selectedDriverId, requiresDriverSelection]);

    const displayedPayments = requiresDriverSelection && !selectedDriverId ? [] : payments;

    return (
        <div className="space-y-3">
            {displayedPayments.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Aucun historique.</p>
            )}
            {displayedPayments.map((payment) => {
                const isRangeParent = payment.paymentType === "range_parent";

                return (
                    <div
                        key={payment.id}
                        onClick={() => onSelectPayment && onSelectPayment(payment)}
                        className={cn(
                            "p-4 rounded-2xl bg-card border border-border/40 shadow-sm flex items-center justify-between group transition-all",
                            onSelectPayment ? "cursor-pointer hover:border-primary/50 hover:bg-muted/50 active:scale-[0.99]" : ""
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                payment.status === 'full' ? 'bg-primary/18 text-foreground' : 'bg-secondary text-foreground/75'
                            )}>
                                {payment.status === 'full' ? <CheckCircle2 size={22} className="stroke-[2.5]" /> : <AlertCircle size={22} className="stroke-[2.5]" />}
                            </div>

                            <div>
                                <p className="font-bold text-base text-foreground tracking-tight">
                                    {formatAmount(payment.amount)} <span className="text-xs font-normal text-muted-foreground">FC</span>
                                </p>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-0.5">
                                    <Clock size={12} strokeWidth={2.5} />
                                    {isRangeParent && payment.periodStart && payment.periodEnd
                                        ? `${format(payment.periodStart, "d MMM", { locale: fr })} - ${format(payment.periodEnd, "d MMM yyyy", { locale: fr })}`
                                        : format(payment.date, "d MMM, HH:mm", { locale: fr })}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {isRangeParent ? `Lot ${payment.allocationCount || 0} semaines` : `Sem. ${format(payment.weekStart, "w")}`}
                                    </span>
                                    {isRangeParent && (
                                        <span className="rounded-full bg-primary/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                                            Paiement principal
                                        </span>
                                    )}
                                </div>
                                {payment.reason && (
                                    <p className="text-[10px] text-muted-foreground mt-1 italic max-w-[180px] truncate">
                                        &quot;{payment.reason}&quot;
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1">
                            {payment.shortfall > 0 ? (
                                <p className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-foreground/75">
                                    Reste: {formatAmount(payment.shortfall)}
                                </p>
                            ) : (
                                <p className="rounded-full bg-primary/18 px-2 py-0.5 text-xs font-bold text-foreground">
                                    Complet
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
