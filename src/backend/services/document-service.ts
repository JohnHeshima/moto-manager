import {
    Timestamp,
    addDoc,
    collection,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";
import {
    getDownloadURL,
    ref,
    uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/backend/firebase/firebase";
import { DriverDocument, DriverDocumentType } from "@/shared/types";

const DRIVER_DOCUMENTS_COLLECTION = "driverDocuments";
const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
]);

function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function validateDocumentFile(file: File) {
    if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
        throw new Error("Seuls les fichiers PDF, PNG, JPG et WEBP sont autorises.");
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw new Error("Le fichier depasse la taille maximale autorisee de 15 MB.");
    }
}

export async function uploadDriverDocument({
    file,
    driverId,
    driverName,
    title,
    type,
    note,
    uploadedById,
    uploadedByName,
}: {
    file: File;
    driverId: string;
    driverName: string;
    title: string;
    type: DriverDocumentType;
    note?: string;
    uploadedById: string;
    uploadedByName: string;
}) {
    validateDocumentFile(file);

    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `driver-documents/${driverId}/${Date.now()}-${safeFileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
    });

    const downloadUrl = await getDownloadURL(storageRef);

    await addDoc(collection(db, DRIVER_DOCUMENTS_COLLECTION), {
        driverId,
        driverName,
        title,
        type,
        fileName: file.name,
        storagePath,
        downloadUrl,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        note: note || null,
        uploadedAt: Timestamp.now(),
        uploadedById,
        uploadedByName,
    });
}

export function subscribeToDriverDocuments(
    driverId: string,
    callback: (documents: DriverDocument[]) => void
) {
    const documentsQuery = query(
        collection(db, DRIVER_DOCUMENTS_COLLECTION),
        where("driverId", "==", driverId)
    );

    return onSnapshot(documentsQuery, (snapshot) => {
        const documents = snapshot.docs
            .map((docSnapshot) => {
                const data = docSnapshot.data();

                return {
                    id: docSnapshot.id,
                    driverId: data.driverId,
                    driverName: data.driverName,
                    title: data.title,
                    type: data.type,
                    fileName: data.fileName,
                    storagePath: data.storagePath,
                    downloadUrl: data.downloadUrl,
                    contentType: data.contentType,
                    size: data.size,
                    uploadedAt: data.uploadedAt?.toDate?.() || new Date(),
                    uploadedById: data.uploadedById,
                    uploadedByName: data.uploadedByName,
                    note: data.note || null,
                } as DriverDocument;
            })
            .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

        callback(documents);
    }, (error) => {
        console.error("Error subscribing to driver documents:", error);
        callback([]);
    });
}
