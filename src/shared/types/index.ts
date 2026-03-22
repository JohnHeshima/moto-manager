export interface Payment {
    id?: string;
    paymentType?: "weekly" | "range" | "range_parent" | "range_item";
    regularizationType?: "surplus_spread";
    amount: number;
    targetAmount: number;
    shortfall: number;
    date: Date; // Transformed from Timestamp in hooks
    weekStart: Date;
    status: 'full' | 'partial' | 'excess';
    reason?: string;
    ownerSignature?: string;
    driverSignature?: string;
    driverId?: string;
    driverName?: string;
    isDeleted?: boolean;
    createdAt?: Date; // Converted from Firestore Timestamp
    periodStart?: Date;
    periodEnd?: Date;
    allocationIndex?: number;
    allocationCount?: number;
    intervalGroupId?: string;
    parentPaymentId?: string;
    regularizedSurplus?: number;
    carriedSurplus?: number;
    comments?: Comment[];
}

export interface DriverOption {
    uid: string;
    email?: string;
    displayName?: string;
    role?: "admin" | "driver" | "co_manager";
}

export type DriverDocumentType =
    | "contract"
    | "moto_registration"
    | "insurance"
    | "license"
    | "other";

export interface DriverDocument {
    id: string;
    driverId: string;
    driverName: string;
    title: string;
    type: DriverDocumentType;
    fileName: string;
    storagePath: string;
    downloadUrl: string;
    contentType: string;
    size: number;
    uploadedAt: Date;
    uploadedById: string;
    uploadedByName: string;
    note?: string | null;
}

export interface Comment {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
}

export interface WeeklyStats {
    currentWeek: {
        paid: number;
        target: number;
        progress: number;
    };
    career: {
        totalPaid: number;
        startedAt: Date | null;
    };
    global: {
        totalSurplus: number;
        totalDebt: number;
    };
    history: {
        weekStart: Date;
        paid: number;
        target: number;
        balance: number;
    }[];
}
