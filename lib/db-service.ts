import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    limit,
    where,
    doc
} from "firebase/firestore";
import { db } from "./firebase";
import { Payment, WeeklyStats } from "@/types";

const PAYMENTS_COLLECTION = "payments";

export const addPayment = async (
    amount: number,
    targetAmount: number,
    ownerSignature: string,
    driverSignature: string,
    driverId: string,
    driverName: string,
    reason?: string,
    customDate?: Date
) => {
    try {
        const shortfall = Math.max(0, targetAmount - amount);
        const status = shortfall === 0 ? 'full' : (amount > targetAmount ? 'excess' : 'partial');

        const paymentDate = customDate ? Timestamp.fromDate(customDate) : Timestamp.now();
        const dateObj = customDate || new Date();

        await addDoc(collection(db, PAYMENTS_COLLECTION), {
            amount,
            targetAmount,
            shortfall,
            status,
            date: paymentDate,
            weekStart: getWeekStartDate(dateObj),
            ownerSignature,
            driverSignature,
            driverId,
            driverName,
            reason: reason || null,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error adding payment:", error);
        return false;
    }
};

export const subscribeToPayments = (
    callback: (payments: Payment[]) => void,
    userId?: string,
    role?: string,
    limitCount = 50
) => {
    const q = query(collection(db, PAYMENTS_COLLECTION)); // Base query

    // We will apply client-side filtering for isDeleted and driverId/Role to avoid complex index requirements for this MVP
    // If data grows, we must add proper composite indexes.

    return onSnapshot(q, (snapshot) => {
        let payments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate(),
            weekStart: (doc.data().weekStart as Timestamp).toDate(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as Payment[];

        // Filter out deleted
        payments = payments.filter(p => !(p as any).isDeleted);

        // Filter by Role/User (Implementation moved from Firestore Query to here to allow flexible sorting + filtering without index)
        if (role === 'driver' && userId) {
            payments = payments.filter(p => p.driverId === userId);
        }

        // Sort descending
        payments.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        // Limit
        payments = payments.slice(0, limitCount);

        callback(payments);
    });
};

export const subscribeToStats = (callback: (stats: WeeklyStats) => void, driverId?: string) => {
    let q = query(collection(db, PAYMENTS_COLLECTION));

    if (driverId) {
        q = query(collection(db, PAYMENTS_COLLECTION), where("driverId", "==", driverId));
    }

    return onSnapshot(q, (snapshot) => {
        const payments = snapshot.docs.map(doc => ({ ...doc.data(), date: doc.data().date.toDate() })) as Payment[];

        // Group by Week
        const weeks: { [key: string]: number } = {};
        let currentWeekTotal = 0;

        // Find current week start
        const now = new Date();
        const currentWeekStart = getWeekStartDate(now).toISOString();

        payments.forEach(p => {
            const weekKey = getWeekStartDate(p.date || (p as any).createdAt?.toDate()).toISOString();
            weeks[weekKey] = (weeks[weekKey] || 0) + (p.amount || 0);

            if (weekKey === currentWeekStart) {
                currentWeekTotal += (p.amount || 0);
            }
        });

        const WEEKLY_TARGET = 200000;
        let totalSurplus = 0;
        let totalDebt = 0;

        const history: { weekStart: Date, paid: number, target: number, balance: number }[] = [];

        Object.entries(weeks).forEach(([week, total]) => {
            const weekDate = new Date(week);
            const balance = total - WEEKLY_TARGET; // postive = surplus, negative = debt

            if (total > WEEKLY_TARGET) {
                totalSurplus += (total - WEEKLY_TARGET);
            } else {
                totalDebt += (WEEKLY_TARGET - total);
            }

            history.push({
                weekStart: weekDate,
                paid: total,
                target: WEEKLY_TARGET,
                balance: balance
            });
        });

        // Sort history descending (newest week first)
        history.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

        callback({
            currentWeek: {
                paid: currentWeekTotal,
                target: WEEKLY_TARGET,
                progress: (currentWeekTotal / WEEKLY_TARGET) * 100
            },
            global: {
                totalSurplus,
                totalDebt
            },
            history
        });
    });
};

function getWeekStartDate(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
}

// verifying export
export const updatePayment = async (
    id: string,
    amount: number,
    targetAmount: number,
    ownerSignature: string,
    driverSignature: string,
    reason?: string
) => {
    try {
        const shortfall = Math.max(0, targetAmount - amount);
        const status = shortfall === 0 ? 'full' : (amount > targetAmount ? 'excess' : 'partial');

        const { doc, updateDoc } = await import("firebase/firestore");

        await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
            amount,
            targetAmount,
            shortfall,
            status,
            ownerSignature,
            driverSignature,
            reason: reason || null,
            updatedAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error updating payment:", error);
        return false;
    }
};

export const deletePayment = async (id: string, adminId: string) => {
    try {
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, PAYMENTS_COLLECTION, id), {
            isDeleted: true,
            deletedAt: Timestamp.now(),
            deletedBy: adminId
        });
    } catch (error) {
        console.error("Error deleting payment:", error);
        return false;
    }
};

export const addPaymentComment = async (
    paymentId: string,
    comment: { text: string; authorId: string; authorName: string }
) => {
    try {
        const { doc, updateDoc, arrayUnion, Timestamp } = await import("firebase/firestore");
        const newComment = {
            id: Math.random().toString(36).substr(2, 9),
            ...comment,
            createdAt: Timestamp.now()
        };

        await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId), {
            comments: arrayUnion(newComment)
        });
        return true;
    } catch (error) {
        console.error("Error adding comment:", error);
        return false;
    }
};

export const updateDriverSignature = async (paymentId: string, signature: string) => {
    try {
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId), {
            driverSignature: signature
        });
        return true;
    } catch (error) {
        console.error("Error updating signature:", error);
        return false;
    }
};
export const subscribeToPayment = (id: string, callback: (payment: Payment | null) => void) => {
    return onSnapshot(doc(db, PAYMENTS_COLLECTION, id), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            callback({
                id: snapshot.id,
                ...data,
                date: data.date?.toDate(),
                weekStart: data.weekStart?.toDate(),
                createdAt: data.createdAt?.toDate(),
                comments: data.comments?.map((c: any) => ({
                    ...c,
                    createdAt: c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt)
                }))
            } as Payment);
        } else {
            callback(null);
        }
    });
};


