"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Payment } from "@/types";
import { subscribeToPayments } from "@/lib/db-service";
import { cn } from "@/lib/utils";

export default function HistoryList({
    limit,
    onSelectPayment,
    userId,
    userRole
}: {
    limit?: number,
    onSelectPayment?: (payment: Payment) => void,
    userId?: string,
    userRole?: string
}) {
    const [payments, setPayments] = useState<Payment[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToPayments((data) => {
            setPayments(data);
        }, userId, userRole, limit || 50);
        return () => unsubscribe();
    }, [limit, userId, userRole]);

    return (
        <div className="space-y-3">
            {payments.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Aucun historique.</p>
            )}
            {payments.map((payment) => (
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
                            payment.status === 'full' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        )}>
                            {payment.status === 'full' ? <CheckCircle2 size={22} className="stroke-[2.5]" /> : <AlertCircle size={22} className="stroke-[2.5]" />}
                        </div>

                        <div>
                            <p className="font-bold text-base text-foreground tracking-tight">
                                {payment.amount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">FC</span>
                            </p>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-0.5">
                                <Clock size={12} strokeWidth={2.5} />
                                {format(payment.date, "d MMM, HH:mm", { locale: fr })}
                            </div>
                            {payment.reason && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic max-w-[120px] truncate">
                                    "{payment.reason}"
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary px-2 py-0.5 rounded-full">
                            Sem. {format(payment.weekStart, "w")}
                        </span>
                        {payment.shortfall > 0 ? (
                            <p className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                                Due: {payment.shortfall.toLocaleString()}
                            </p>
                        ) : (
                            <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Complet
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
