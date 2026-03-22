"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/components/ui/card";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Button } from "@/frontend/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { subscribeToDriverDocuments, uploadDriverDocument } from "@/backend/services/document-service";
import { DriverDocument, DriverDocumentType } from "@/shared/types";
import { Download, FileImage, FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";

const DOCUMENT_TYPE_OPTIONS: Array<{ value: DriverDocumentType; label: string }> = [
    { value: "contract", label: "Contrat signé" },
    { value: "moto_registration", label: "Document moto" },
    { value: "insurance", label: "Assurance" },
    { value: "license", label: "Permis / pièce" },
    { value: "other", label: "Autre document" },
];

function formatFileSize(size: number) {
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (size >= 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${size} B`;
}

function documentTypeLabel(type: DriverDocumentType) {
    return DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label || "Document";
}

export default function DocumentsView({
    selectedDriverId,
    selectedDriverLabel,
    uploadedById,
    uploadedByName,
}: {
    selectedDriverId: string;
    selectedDriverLabel: string;
    uploadedById: string;
    uploadedByName: string;
}) {
    const [documents, setDocuments] = useState<DriverDocument[]>([]);
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [documentType, setDocumentType] = useState<DriverDocumentType>("contract");
    const [note, setNote] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        setIsCreateFormOpen(false);
        setError("");
        setSuccess("");

        if (!selectedDriverId) {
            setDocuments([]);
            return;
        }

        const unsubscribe = subscribeToDriverDocuments(selectedDriverId, setDocuments);
        return () => unsubscribe();
    }, [selectedDriverId]);

    const acceptedTypes = useMemo(() => "application/pdf,image/png,image/jpeg,image/webp", []);

    const handleUpload = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!selectedDriverId) {
            setError("Choisis d'abord le motard concerné.");
            return;
        }

        if (!selectedFile) {
            setError("Sélectionne un fichier PDF ou image.");
            return;
        }

        setIsUploading(true);
        setError("");
        setSuccess("");

        try {
            await uploadDriverDocument({
                file: selectedFile,
                driverId: selectedDriverId,
                driverName: selectedDriverLabel || "Motard",
                title: title.trim() || selectedFile.name,
                type: documentType,
                note: note.trim(),
                uploadedById,
                uploadedByName,
            });

            setTitle("");
            setDocumentType("contract");
            setNote("");
            setSelectedFile(null);
            setFileInputKey((currentKey) => currentKey + 1);
            setIsCreateFormOpen(false);
            setSuccess("Document enregistré avec succès.");
        } catch (uploadError: unknown) {
            const message = uploadError instanceof Error ? uploadError.message : "Échec de l'envoi du document.";
            setError(message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
                <div className="px-1">
                    <h2 className="text-base font-semibold text-foreground">Documents enregistrés</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Historique des fichiers attachés à {selectedDriverLabel || "ce motard"}.
                    </p>
                </div>

                {!selectedDriverId ? (
                    <Card className="border-dashed border-border/60">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Sélectionne d&apos;abord un motard pour voir ses documents.
                        </CardContent>
                    </Card>
                ) : documents.length === 0 ? (
                    <Card className="border-dashed border-border/60">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Aucun document chargé pour ce motard.
                        </CardContent>
                    </Card>
                ) : (
                    documents.map((document) => {
                        const isImage = document.contentType.startsWith("image/");

                        return (
                            <Card key={document.id} className="border-border/60 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                {isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-foreground truncate">{document.title}</p>
                                                <p className="text-sm text-muted-foreground truncate">{document.fileName}</p>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                    <span className="rounded-full bg-secondary px-2 py-1 font-medium text-secondary-foreground">
                                                        {documentTypeLabel(document.type)}
                                                    </span>
                                                    <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                                                        {formatFileSize(document.size)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <a
                                            href={document.downloadUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                                        >
                                            <Download className="h-4 w-4" />
                                            Ouvrir
                                        </a>
                                    </div>

                                    <div className="mt-4 text-xs text-muted-foreground space-y-1">
                                        <p>Ajouté le {format(document.uploadedAt, "d MMM yyyy à HH:mm", { locale: fr })}</p>
                                        <p>Par {document.uploadedByName}</p>
                                        {document.note && <p className="text-foreground/80">{document.note}</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-secondary/65 to-card">
                    <CardTitle className="flex items-center justify-between gap-3 text-xl">
                        <span className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Ajouter un document
                        </span>
                        <Button
                            type="button"
                            variant={isCreateFormOpen ? "outline" : "default"}
                            className="rounded-2xl"
                            disabled={!selectedDriverId}
                            onClick={() => {
                                setError("");
                                setSuccess("");
                                setIsCreateFormOpen((open) => !open);
                            }}
                        >
                            {isCreateFormOpen ? "Fermer" : documents.length > 0 ? "Ajouter un autre document" : "Ajouter un document"}
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        Ouvre le formulaire seulement quand tu veux charger un nouveau fichier pour {selectedDriverLabel || "ce motard"}.
                    </CardDescription>
                </CardHeader>

                {(error || success) && (
                    <CardContent className="pt-6 pb-0">
                        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
                        {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}
                    </CardContent>
                )}

                {isCreateFormOpen && (
                    <CardContent className="pt-6">
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="document-title">Titre du document</Label>
                                <Input
                                    id="document-title"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Ex: Contrat 2026, Carte rose de la moto..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type de document</Label>
                                <Select value={documentType} onValueChange={(value) => setDocumentType(value as DriverDocumentType)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choisir un type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="document-note">Note</Label>
                                <Input
                                    id="document-note"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Détail utile sur ce document"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="document-file">Fichier</Label>
                                <Input
                                    key={fileInputKey}
                                    id="document-file"
                                    type="file"
                                    accept={acceptedTypes}
                                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Formats supportes: PDF, PNG, JPG, WEBP. Taille max: 15 MB.
                                </p>
                            </div>

                            <Button type="submit" className="w-full h-11 rounded-2xl" disabled={isUploading || !selectedDriverId}>
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Ajouter le document
                            </Button>
                        </form>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
