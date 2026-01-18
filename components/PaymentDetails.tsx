"use client";

import { useRef, useState, useEffect } from "react";
import { format, isSameWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Payment, Comment } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit2, Calendar, Banknote, FileSignature, AlertTriangle, CheckCircle2, Trash2, Clock, MessageSquare, Send, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { deletePayment, addPaymentComment, updateDriverSignature, subscribeToPayment } from "@/lib/db-service";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";

interface PaymentDetailsProps {
    payment: Payment;
    onEdit: () => void;
    onBack: () => void;
}

export default function PaymentDetails({ payment, onEdit, onBack }: PaymentDetailsProps) {
    const { user, userProfile } = useAuth();
    const [currentPayment, setCurrentPayment] = useState<Payment>(payment);
    const [isDeleting, setIsDeleting] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isSigning, setIsSigning] = useState(false);
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
        if (!newComment.trim() || !user || !currentPayment.id) return;

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
        if (sigRef.current?.isEmpty() || !currentPayment.id) return;
        const signature = sigRef.current?.toDataURL();
        if (signature) {
            await updateDriverSignature(currentPayment.id, signature);
            setIsSigning(false);
        }
    };

    // Check if payment was made late (Regularization)
    const isRegularization = currentPayment.createdAt && !isSameWeek(currentPayment.date, currentPayment.createdAt, { weekStartsOn: 1 });

    const sortedComments = currentPayment.comments?.sort((a, b) =>
        (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()) -
        (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime())
    ) || [];

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
                    currentPayment.status === 'full' ? "bg-emerald-500" : "bg-rose-500"
                )} />
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Montant Versé</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-foreground">{currentPayment.amount.toLocaleString()}</span>
                                <span className="text-sm font-medium text-muted-foreground">FC</span>
                            </div>
                        </div>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            currentPayment.status === 'full'
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                            {currentPayment.status === 'full' ? "Complet" : "Incomplet"}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
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
                            <p className="font-medium">{currentPayment.targetAmount.toLocaleString()} FC</p>
                        </div>
                    </div>

                    {currentPayment.shortfall > 0 && (
                        <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-rose-700 font-bold">
                                <AlertTriangle className="h-4 w-4" />
                                Manquant: {currentPayment.shortfall.toLocaleString()} FC
                            </div>
                            {currentPayment.reason && (
                                <div className="text-sm text-rose-900/80 italic border-l-2 border-rose-200 pl-3">
                                    "{currentPayment.reason}"
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signature Motard</Label>
                            {/* Allow driver to sign if missing */}
                            {userProfile?.role === 'driver' && !currentPayment.driverSignature && !isSigning && (
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
                                currentPayment.driverSignature ? "border-emerald-200 bg-emerald-50/30" : "border-border"
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
                            currentPayment.ownerSignature ? "border-emerald-200 bg-emerald-50/30" : "border-border"
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
                                            <span className="font-semibold text-xs text-primary">{comment.authorName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {(() => {
                                                    const date = comment.createdAt instanceof Date
                                                        ? comment.createdAt
                                                        : new Date(comment.createdAt as any);
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

                        <div className="flex gap-2">
                            <Input
                                placeholder="Ajouter une observation..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="h-9 text-sm"
                            />
                            <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddComment} disabled={!newComment.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(userProfile?.role === 'admin' || userProfile?.role === 'co_manager') ? (
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
                        <Edit2 className="mr-2 h-5 w-5" /> Modifier
                    </Button>
                </div>
            ) : (
                /* Driver View - No Edit Button */
                <Button variant="outline" size="lg" disabled className="w-full text-lg h-14 rounded-2xl shadow-lg border-dashed opacity-70">
                    Modification restreinte
                </Button>
            )}
        </div>
    );
}
