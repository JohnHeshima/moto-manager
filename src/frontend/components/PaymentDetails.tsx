"use client";

import { useRef, useState, useEffect } from "react";
import { format, isSameWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Payment } from "@/shared/types";
import { Button } from "@/frontend/components/ui/button";
import { Card, CardContent, CardHeader } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { ArrowLeft, Edit2, Calendar, Banknote, AlertTriangle, Trash2, Clock, MessageSquare, Send, PenTool, Layers3, Loader2, WandSparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/frontend/contexts/AuthContext";
import { deletePayment, addPaymentComment, updateDriverSignature, subscribeToPayment, subscribeToChildPayments, regularizePaymentSurplus } from "@/backend/services/db-service";
import SignaturePad, { SignaturePadRef } from "@/frontend/components/SignaturePad";
import { formatAmount } from "@/shared/lib/format";
import {
    SURPLUS_REGULARIZATION_THRESHOLD,
    buildSurplusRegularizationPlan,
    shouldRegularizeWeeklySurplus,
} from "@/shared/lib/payment-allocation";

interface PaymentDetailsProps {
    payment: Payment;
    onEdit: () => void;
    onBack: () => void;
}

function coerceDate(value: unknown) {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
    }

    return new Date(NaN);
}

export default function PaymentDetails({ payment, onEdit, onBack }: PaymentDetailsProps) {
    const { user, userProfile } = useAuth();
    const [currentPayment, setCurrentPayment] = useState<Payment>(payment);
    const [isDeleting, setIsDeleting] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isSigning, setIsSigning] = useState(false);
    const [childPayments, setChildPayments] = useState<Payment[]>([]);
    const [isConvertOpen, setIsConvertOpen] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const sigRef = useRef<SignaturePadRef>(null);

    // Subscribe to real-time updates for this specific payment
    useEffect(() => {
        if (!payment.id) return;
        const unsubscribe = subscribeToPayment(payment.id, (updatedPayment) => {
            if (updatedPayment) {
                setCurrentPayment(updatedPayment);
            }
        });
        return () => unsubscribe();
    }, [payment.id]);

    useEffect(() => {
        if (!currentPayment.id || currentPayment.paymentType !== "range_parent") {
            return;
        }

        const unsubscribe = subscribeToChildPayments(currentPayment.id, setChildPayments, user?.uid, userProfile?.role);
        return () => unsubscribe();
    }, [currentPayment.id, currentPayment.paymentType, user?.uid, userProfile?.role]);


    const handleDelete = async () => {
        if (!currentPayment.id || !user) return;
        if (!confirm("Êtes-vous sûr de vouloir supprimer ce paiement ?")) return;

        setIsDeleting(true);
        const success = await deletePayment(currentPayment.id, user.uid);
        if (success) {
            onBack();
        } else {
            alert("Erreur lors de la suppression");
            setIsDeleting(false);
        }
    };

    const handleAddComment = async () => {
        if (!canCommentOnPayment || !newComment.trim() || !user || !currentPayment.id) return;

        const success = await addPaymentComment(currentPayment.id, {
            text: newComment,
            authorId: user.uid,
            authorName: userProfile?.displayName || user.email || "Utilisateur"
        });

        if (success) {
            setNewComment("");
        }
    };

    const handleSign = async () => {
        if (!canSignCurrentPayment || sigRef.current?.isEmpty() || !currentPayment.id) return;
        const signature = sigRef.current?.toDataURL();
        if (signature) {
            await updateDriverSignature(currentPayment.id, signature);
            setIsSigning(false);
        }
    };

    // Check if payment was made late (Regularization)
    const isRegularization = currentPayment.paymentType !== "range_parent"
        && currentPayment.createdAt
        && !isSameWeek(currentPayment.date, currentPayment.createdAt, { weekStartsOn: 1 });
    const isRangeParent = currentPayment.paymentType === "range_parent";
    const canManagePayment = userProfile?.role === 'admin' || userProfile?.role === 'co_manager';
    const isDriverReadonlyView = userProfile?.role === "driver";
    const canCommentOnPayment = canManagePayment || (userProfile?.role === "driver" && currentPayment.driverId === user?.uid);
    const canSignCurrentPayment = userProfile?.role === 'driver'
        && currentPayment.driverId === user?.uid
        && !currentPayment.driverSignature;
    const currentSurplus = Math.max(0, currentPayment.amount - currentPayment.targetAmount);
    const canConvertLegacyPayment = !isRangeParent
        && (currentPayment.paymentType === "weekly" || !currentPayment.paymentType)
        && shouldRegularizeWeeklySurplus({
            amount: currentPayment.amount,
            targetAmount: currentPayment.targetAmount,
        });
    const regularizationPlan = canConvertLegacyPayment
        ? buildSurplusRegularizationPlan({
            startDate: currentPayment.weekStart || currentPayment.date,
            totalAmount: currentPayment.amount,
            targetAmount: currentPayment.targetAmount,
        })
        : null;
    const displayedChildPayments = isRangeParent ? childPayments : [];
    const statusLabel = currentPayment.status === "excess"
        ? "Surplus"
        : currentPayment.status === "full"
            ? "Complet"
            : "Incomplet";

    const sortedComments = [...(currentPayment.comments || [])].sort((a, b) =>
        coerceDate(b.createdAt).getTime() - coerceDate(a.createdAt).getTime()
    );

    const handleConvertToRange = async () => {
        if (!currentPayment.id) {
            return;
        }

        setIsConverting(true);
        const success = await regularizePaymentSurplus({
            paymentId: currentPayment.id,
        });

        setIsConverting(false);

        if (success) {
            setIsConvertOpen(false);
        } else {
            alert("Impossible de regulariser ce surplus pour l'instant.");
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h2 className="font-bold text-xl">Détails du Paiement</h2>
            </div>

            <Card className="border-border/50 shadow-md overflow-hidden">
                <div className={cn(
                    "h-2 w-full",
                    currentPayment.status === "full"
                        ? "bg-primary"
                        : currentPayment.status === "excess"
                            ? "bg-emerald-500"
                            : "bg-foreground"
                )} />
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Montant Versé</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-foreground">{formatAmount(currentPayment.amount)}</span>
                                <span className="text-sm font-medium text-muted-foreground">FC</span>
                            </div>
                        </div>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            currentPayment.status === "full"
                                ? "border-primary/30 bg-primary/18 text-foreground"
                                : currentPayment.status === "excess"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-black/10 bg-secondary text-foreground/75"
                        )}>
                            {statusLabel}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isDriverReadonlyView && (
                        <div className="rounded-2xl border border-black/8 bg-secondary/55 px-4 py-3 text-sm text-muted-foreground">
                            Ce versement est en lecture seule. Le motard peut seulement ajouter un commentaire et sa signature.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {isRegularization ? (
                            <>
                                <div className="space-y-1 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 -ml-2">
                                    <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider">
                                        <Calendar className="h-3.5 w-3.5" /> Semaine du
                                    </div>
                                    <p className="font-medium text-amber-900">{format(currentPayment.weekStart, "d MMMM yyyy", { locale: fr })}</p>
                                    <p className="text-xs text-amber-700/70">Période concernée</p>
                                </div>
                                <div className="space-y-1 p-2">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                        <Clock className="h-3.5 w-3.5" /> Versé le
                                    </div>
                                    <p className="font-medium">{currentPayment.createdAt ? format(currentPayment.createdAt, "d MMMM yyyy", { locale: fr }) : "N/A"}</p>
                                    <p className="text-xs text-muted-foreground">Date réelle</p>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                    <Calendar className="h-3.5 w-3.5" /> Date
                                </div>
                                <p className="font-medium">{format(currentPayment.date, "d MMMM yyyy", { locale: fr })}</p>
                                <p className="text-xs text-muted-foreground">{format(currentPayment.date, "HH:mm", { locale: fr })}</p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                                <Banknote className="h-3.5 w-3.5" /> Objectif
                            </div>
                            <p className="font-medium">{formatAmount(currentPayment.targetAmount)} FC</p>
                        </div>
                    </div>

                    {isRangeParent && currentPayment.periodStart && currentPayment.periodEnd && (
                        <div className="rounded-xl border border-black/8 bg-secondary/55 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Paiement par intervalle</p>
                            <p className="mt-2 text-sm text-foreground">
                                Plage: {format(currentPayment.periodStart, "d MMM yyyy", { locale: fr })} au {format(currentPayment.periodEnd, "d MMM yyyy", { locale: fr })}
                            </p>
                            {currentPayment.allocationCount && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Ce paiement principal regroupe {currentPayment.allocationCount} semaine(s) subdivisée(s).
                                </p>
                            )}
                        </div>
                    )}

                    {isRangeParent && (
                        <div className="space-y-3 rounded-[24px] border border-black/8 bg-card p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Layers3 className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-sm font-bold text-foreground">Sous-montants subdivisés</p>
                                </div>
                                <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                    Trace
                                </span>
                            </div>

                            {displayedChildPayments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-center text-muted-foreground">
                                    Aucun sous-montant enregistré pour ce lot.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayedChildPayments.map((childPayment) => (
                                        <div key={childPayment.id} className="rounded-2xl border border-black/8 bg-background/70 px-4 py-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">
                                                        Semaine {childPayment.allocationIndex || 1}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {childPayment.periodStart && childPayment.periodEnd
                                                            ? `${format(childPayment.date, "d MMM", { locale: fr })} · lot ${format(childPayment.periodStart, "d MMM", { locale: fr })} au ${format(childPayment.periodEnd, "d MMM yyyy", { locale: fr })}`
                                                            : format(childPayment.date, "d MMM yyyy", { locale: fr })}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-bold text-foreground">
                                                        {formatAmount(childPayment.amount)} FC
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Cible: {formatAmount(childPayment.targetAmount)} FC
                                                    </p>
                                                </div>
                                            </div>
                                            {(childPayment.shortfall > 0 || childPayment.amount > childPayment.targetAmount) && (
                                                <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
                                                    {childPayment.shortfall > 0
                                                        ? `Manque appliqué sur cette semaine: ${formatAmount(childPayment.shortfall)} FC`
                                                        : `Surplus appliqué sur cette semaine: ${formatAmount(childPayment.amount - childPayment.targetAmount)} FC`}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {currentPayment.regularizationType === "surplus_spread" && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            Ce paiement a ete regularise automatiquement sur {currentPayment.allocationCount || 0} semaines consecutives.
                            {typeof currentPayment.regularizedSurplus === "number" && (
                                <span className="font-semibold"> Surplus initial traite: {formatAmount(currentPayment.regularizedSurplus)} FC.</span>
                            )}
                        </div>
                    )}

                    {currentSurplus > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-emerald-800">
                                <AlertTriangle className="h-4 w-4" />
                                Surplus constate: {formatAmount(currentSurplus)} FC
                            </div>
                            <p className="text-sm text-emerald-800/80">
                                {canConvertLegacyPayment
                                    ? `Ce surplus depasse le plafond de ${formatAmount(SURPLUS_REGULARIZATION_THRESHOLD)} FC pour une seule semaine. Une regularisation sur les semaines suivantes est recommandee.`
                                    : "Ce surplus reste dans la marge autorisee pour une seule semaine."}
                            </p>
                        </div>
                    )}

                    {currentPayment.shortfall > 0 && (
                        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-3">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                Manquant: {formatAmount(currentPayment.shortfall)} FC
                            </div>
                            {currentPayment.reason && (
                                <div className="border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/80">
                                    &quot;{currentPayment.reason}&quot;
                                </div>
                            )}
                        </div>
                    )}

                    {canManagePayment && canConvertLegacyPayment && (
                        <div className="space-y-3 rounded-[24px] border border-black/8 bg-card p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-foreground">Regulariser ce surplus automatiquement</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Cette operation garde ce paiement comme trace principale, puis repartit automatiquement le surplus sur les semaines suivantes.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isConvertOpen ? "outline" : "default"}
                                    onClick={() => setIsConvertOpen((open) => !open)}
                                >
                                    <WandSparkles className="mr-2 h-4 w-4" />
                                    {isConvertOpen ? "Fermer" : "Voir la regularisation"}
                                </Button>
                            </div>

                            {isConvertOpen && regularizationPlan && (
                                <div className="space-y-4 rounded-2xl border border-black/8 bg-background/70 p-4">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-black/8 bg-card px-4 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Surplus initial</p>
                                            <p className="mt-2 text-lg font-bold text-foreground">{formatAmount(regularizationPlan.sourceSurplus)} FC</p>
                                        </div>
                                        <div className="rounded-2xl border border-black/8 bg-card px-4 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Semaines couvrees</p>
                                            <p className="mt-2 text-lg font-bold text-foreground">{regularizationPlan.weekCount}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Du {format(regularizationPlan.periodStart, "d MMM", { locale: fr })} au {format(regularizationPlan.periodEnd, "d MMM yyyy", { locale: fr })}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-black/8 bg-card px-4 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Surplus final conserve</p>
                                            <p className="mt-2 text-lg font-bold text-foreground">{formatAmount(regularizationPlan.carriedSurplus)} FC</p>
                                            <p className="text-xs text-muted-foreground">Toujours inferieur au plafond hebdomadaire.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 rounded-2xl border border-black/8 bg-card p-3">
                                        {regularizationPlan.allocations.map((allocation) => (
                                            <div key={allocation.index} className="flex items-center justify-between gap-3 rounded-xl bg-background/80 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Semaine {allocation.index}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(allocation.startDate, "d MMM", { locale: fr })} au {format(allocation.endDate, "d MMM yyyy", { locale: fr })}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-foreground">{formatAmount(allocation.amount)} FC</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {allocation.surplus > 0
                                                            ? `Surplus final: ${formatAmount(allocation.surplus)} FC`
                                                            : "Objectif couvert"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-3">
                                        <p className="text-xs text-muted-foreground">
                                            Le paiement principal est conserve, puis le surplus est ventile sur les semaines suivantes.
                                        </p>
                                        <Button type="button" onClick={handleConvertToRange} disabled={isConverting}>
                                            {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Appliquer la regularisation
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signature Motard</Label>
                            {/* Allow driver to sign if missing */}
                            {canSignCurrentPayment && !isSigning && (
                                <Button variant="outline" size="sm" onClick={() => setIsSigning(true)} className="h-7 text-xs">
                                    <PenTool className="h-3 w-3 mr-1" /> Signer
                                </Button>
                            )}
                        </div>

                        {isSigning ? (
                            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <SignaturePad label="Votre Signature" ref={sigRef} />
                                <div className="flex gap-2">
                                    <Button onClick={handleSign} size="sm" className="w-full">Confirmer</Button>
                                    <Button onClick={() => setIsSigning(false)} variant="ghost" size="sm" className="w-full">Annuler</Button>
                                </div>
                            </div>
                        ) : (
                            <div className={cn(
                                "h-16 rounded-xl border border-dashed flex items-center justify-center bg-muted/20",
                                currentPayment.driverSignature ? "border-primary/25 bg-primary/10" : "border-border"
                            )}>
                                {currentPayment.driverSignature ? (
                                    <img src={currentPayment.driverSignature} alt="Signature Motard" className="h-full object-contain mix-blend-multiply opacity-80" />
                                ) : (
                                    <span className="text-xs text-muted-foreground/50 italic flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Non signé
                                    </span>
                                )}
                            </div>
                        )}

                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-2 block">Signature Propriétaire</Label>
                        <div className={cn(
                            "h-16 rounded-xl border border-dashed flex items-center justify-center bg-muted/20",
                            currentPayment.ownerSignature ? "border-primary/25 bg-primary/10" : "border-border"
                        )}>
                            {currentPayment.ownerSignature ? (
                                <img src={currentPayment.ownerSignature} alt="Signature Propriétaire" className="h-full object-contain mix-blend-multiply opacity-80" />
                            ) : (
                                <span className="text-xs text-muted-foreground/50 italic">En attente</span>
                            )}
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="pt-4 border-t border-border/40 space-y-4">
                        <div className="flex items-center gap-2 text-foreground font-semibold">
                            <MessageSquare className="h-4 w-4" /> Commentaires
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-muted">
                            {sortedComments.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic text-center py-2">Aucun commentaire</p>
                            ) : (
                                sortedComments.map((comment, index) => (
                                    <div key={comment.id || index} className="bg-muted/30 p-2 rounded-lg text-sm border border-border/50">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-xs text-foreground">{comment.authorName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {(() => {
                                                    const date = coerceDate(comment.createdAt);
                                                    return !isNaN(date.getTime())
                                                        ? format(date, "d MMM HH:mm", { locale: fr })
                                                        : "";
                                                })()}
                                            </span>
                                        </div>
                                        <p className="text-foreground/90">{comment.text}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {canCommentOnPayment ? (
                            <div className="flex gap-2">
                                <Input
                                    placeholder={canManagePayment ? "Ajouter une observation..." : "Ajouter un commentaire..."}
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="h-9 text-sm"
                                />
                                <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddComment} disabled={!newComment.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Les commentaires sont indisponibles pour ce paiement.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {canManagePayment ? (
                <div className="flex gap-4">
                    <Button
                        variant="destructive"
                        size="lg"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-14 w-14 rounded-2xl shadow-lg p-0 flex items-center justify-center shrink-0"
                    >
                        {isDeleting ? <span className="animate-spin">...</span> : <Trash2 className="h-6 w-6" />}
                    </Button>
                    <Button onClick={onEdit} size="lg" className="flex-1 text-lg h-14 rounded-2xl shadow-lg shadow-primary/20 font-bold">
                        <Edit2 className="mr-2 h-5 w-5" /> {isRangeParent ? "Modifier le lot" : "Modifier"}
                    </Button>
                </div>
            ) : (
                /* Driver View - No Edit Button */
                <Button variant="outline" size="lg" disabled className="w-full text-lg h-14 rounded-2xl shadow-lg border-dashed opacity-70">
                    {canSignCurrentPayment || canCommentOnPayment ? "Commentaire et signature uniquement" : "Paiement verrouille"}
                </Button>
            )}
        </div>
    );
}
