export interface Payment {
    id?: string;
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
    comments?: Comment[];
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
