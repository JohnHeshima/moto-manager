import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    query,
    onSnapshot,
    Timestamp,
    where,
    doc,
    writeBatch
} from "firebase/firestore";
import { db } from "@/backend/firebase/firebase";
import { Comment, Payment, WeeklyStats } from "@/shared/types";
import { buildPaymentRangePlan } from "@/shared/lib/payment-allocation";

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
            paymentType: "weekly",
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
    limitCount = 50,
    selectedDriverId?: string
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
            periodStart: (doc.data().periodStart as Timestamp | undefined)?.toDate?.(),
            periodEnd: (doc.data().periodEnd as Timestamp | undefined)?.toDate?.(),
        })) as Payment[];

        // Filter out deleted
        payments = payments.filter(p => !p.isDeleted);
        payments = payments.filter(p => p.paymentType !== "range_item");

        // Admin/co-manager can force a specific driver filter from the UI.
        if (selectedDriverId) {
            payments = payments.filter(p => p.driverId === selectedDriverId);
        } else if (role === 'driver' && userId) {
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
        const payments = snapshot.docs
            .map(doc => ({
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(),
                weekStart: doc.data().weekStart?.toDate?.() || null,
                createdAt: doc.data().createdAt?.toDate?.() || null,
                isDeleted: doc.data().isDeleted || false,
            }) as Payment)
            .filter(payment => !payment.isDeleted && payment.paymentType !== "range_parent") as Payment[];

        // Group by Week
        const weeks: { [key: string]: number } = {};
        let currentWeekTotal = 0;
        let totalPaid = 0;
        let startedAt: Date | null = null;

        // Find current week start
        const now = new Date();
        const currentWeekStart = getWeekStartDate(now).toISOString();

        payments.forEach(p => {
            const paymentDate = p.date || p.createdAt || new Date();
            const paymentWeekStart = p.weekStart || getWeekStartDate(paymentDate);
            const weekKey = paymentWeekStart.toISOString();
            weeks[weekKey] = (weeks[weekKey] || 0) + (p.amount || 0);
            totalPaid += (p.amount || 0);

            if (!startedAt || paymentDate < startedAt) {
                startedAt = paymentDate;
            }

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
            career: {
                totalPaid,
                startedAt
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

function normalizeCommentDate(value: Timestamp | Date | string) {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "string") {
        return new Date(value);
    }

    return value.toDate();
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
        const paymentRef = doc(db, PAYMENTS_COLLECTION, id);
        const paymentSnapshot = await getDoc(paymentRef);

        if (!paymentSnapshot.exists()) {
            return false;
        }

        const deletedAt = Timestamp.now();
        const batch = writeBatch(db);
        batch.update(paymentRef, {
            isDeleted: true,
            deletedAt,
            deletedBy: adminId
        });

        const paymentData = paymentSnapshot.data() as Payment;
        if (paymentData.paymentType === "range_parent") {
            const childPaymentsSnapshot = await getDocs(
                query(collection(db, PAYMENTS_COLLECTION), where("parentPaymentId", "==", id))
            );

            childPaymentsSnapshot.docs.forEach((childDoc) => {
                batch.update(childDoc.ref, {
                    isDeleted: true,
                    deletedAt,
                    deletedBy: adminId
                });
            });
        }

        await batch.commit();
        return true;
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
                periodStart: data.periodStart?.toDate?.(),
                periodEnd: data.periodEnd?.toDate?.(),
                comments: data.comments?.map((c: Comment & { createdAt: Timestamp | Date | string }) => ({
                    ...c,
                    createdAt: normalizeCommentDate(c.createdAt)
                }))
            } as Payment);
        } else {
            callback(null);
        }
    });
};

export const subscribeToChildPayments = (
    parentPaymentId: string,
    callback: (payments: Payment[]) => void
) => {
    const childPaymentsQuery = query(
        collection(db, PAYMENTS_COLLECTION),
        where("parentPaymentId", "==", parentPaymentId)
    );

    return onSnapshot(childPaymentsQuery, (snapshot) => {
        const childPayments = snapshot.docs
            .map((paymentDoc) => {
                const data = paymentDoc.data();
                return {
                    id: paymentDoc.id,
                    ...data,
                    date: data.date?.toDate?.() || new Date(),
                    weekStart: data.weekStart?.toDate?.() || new Date(),
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    periodStart: data.periodStart?.toDate?.(),
                    periodEnd: data.periodEnd?.toDate?.(),
                } as Payment;
            })
            .filter((payment) => !payment.isDeleted)
            .sort((a, b) => {
                const allocationDelta = (a.allocationIndex || 0) - (b.allocationIndex || 0);
                if (allocationDelta !== 0) {
                    return allocationDelta;
                }

                return a.date.getTime() - b.date.getTime();
            });

        callback(childPayments);
    });
};

export const addPaymentRange = async ({
    totalAmount,
    targetAmount,
    ownerSignature,
    driverSignature,
    driverId,
    driverName,
    reason,
    startDate,
    endDate,
}: {
    totalAmount: number;
    targetAmount: number;
    ownerSignature: string;
    driverSignature: string;
    driverId: string;
    driverName: string;
    reason?: string;
    startDate: Date;
    endDate: Date;
}) => {
    try {
        const paymentPlan = buildPaymentRangePlan({
            startDate,
            endDate,
            totalAmount,
            targetAmount,
        });

        if (!paymentPlan.isValid) {
            throw new Error(paymentPlan.validationMessage || "Intervalle de paiement invalide.");
        }

        const intervalGroupId = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `range-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const paymentsCollection = collection(db, PAYMENTS_COLLECTION);
        const parentPaymentRef = doc(paymentsCollection);
        const periodStartTimestamp = Timestamp.fromDate(startDate);
        const periodEndTimestamp = Timestamp.fromDate(endDate);
        const createdAt = Timestamp.now();
        const parentTargetAmount = paymentPlan.weekCount * targetAmount;
        const parentShortfall = Math.max(0, parentTargetAmount - totalAmount);
        const parentStatus = parentShortfall === 0
            ? (totalAmount > parentTargetAmount ? "excess" : "full")
            : "partial";
        const batch = writeBatch(db);

        batch.set(parentPaymentRef, {
            paymentType: "range_parent",
            amount: totalAmount,
            targetAmount: parentTargetAmount,
            shortfall: parentShortfall,
            status: parentStatus,
            date: periodStartTimestamp,
            weekStart: Timestamp.fromDate(getWeekStartDate(startDate)),
            ownerSignature,
            driverSignature,
            driverId,
            driverName,
            reason: reason || null,
            periodStart: periodStartTimestamp,
            periodEnd: periodEndTimestamp,
            allocationCount: paymentPlan.weekCount,
            intervalGroupId,
            createdAt,
        });

        paymentPlan.allocations.forEach((allocation) => {
            const status = allocation.shortfall === 0
                ? (allocation.amount > allocation.targetAmount ? "excess" : "full")
                : "partial";
            const childPaymentRef = doc(paymentsCollection);

            batch.set(childPaymentRef, {
                paymentType: "range_item",
                parentPaymentId: parentPaymentRef.id,
                amount: allocation.amount,
                targetAmount: allocation.targetAmount,
                shortfall: allocation.shortfall,
                status,
                date: Timestamp.fromDate(allocation.startDate),
                weekStart: Timestamp.fromDate(allocation.weekStart),
                ownerSignature,
                driverSignature,
                driverId,
                driverName,
                reason: allocation.index === paymentPlan.weekCount ? (reason || null) : null,
                periodStart: periodStartTimestamp,
                periodEnd: periodEndTimestamp,
                allocationIndex: allocation.index,
                allocationCount: paymentPlan.weekCount,
                intervalGroupId,
                createdAt,
            });
        });

        await batch.commit();

        return true;
    } catch (error) {
        console.error("Error adding payment range:", error);
        return false;
    }
};

export const convertPaymentToRange = async ({
    paymentId,
    startDate,
    endDate,
}: {
    paymentId: string;
    startDate: Date;
    endDate: Date;
}) => {
    try {
        const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
        const paymentSnapshot = await getDoc(paymentRef);

        if (!paymentSnapshot.exists()) {
            throw new Error("Paiement introuvable.");
        }

        const paymentData = paymentSnapshot.data() as Payment;
        const targetAmount = paymentData.targetAmount || 200000;
        const paymentPlan = buildPaymentRangePlan({
            startDate,
            endDate,
            totalAmount: paymentData.amount,
            targetAmount,
        });

        if (!paymentPlan.isValid) {
            throw new Error(paymentPlan.validationMessage || "Conversion impossible.");
        }

        const intervalGroupId = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `range-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const paymentsCollection = collection(db, PAYMENTS_COLLECTION);
        const periodStartTimestamp = Timestamp.fromDate(startDate);
        const periodEndTimestamp = Timestamp.fromDate(endDate);
        const createdAt = paymentSnapshot.data().createdAt || Timestamp.now();
        const parentTargetAmount = paymentPlan.weekCount * targetAmount;
        const parentShortfall = Math.max(0, parentTargetAmount - paymentData.amount);
        const parentStatus = parentShortfall === 0
            ? (paymentData.amount > parentTargetAmount ? "excess" : "full")
            : "partial";
        const batch = writeBatch(db);

        batch.update(paymentRef, {
            paymentType: "range_parent",
            targetAmount: parentTargetAmount,
            shortfall: parentShortfall,
            status: parentStatus,
            date: periodStartTimestamp,
            weekStart: Timestamp.fromDate(getWeekStartDate(startDate)),
            periodStart: periodStartTimestamp,
            periodEnd: periodEndTimestamp,
            allocationCount: paymentPlan.weekCount,
            intervalGroupId,
            updatedAt: Timestamp.now(),
        });

        paymentPlan.allocations.forEach((allocation) => {
            const status = allocation.shortfall === 0
                ? (allocation.amount > allocation.targetAmount ? "excess" : "full")
                : "partial";
            const childPaymentRef = doc(paymentsCollection);

            batch.set(childPaymentRef, {
                paymentType: "range_item",
                parentPaymentId: paymentId,
                amount: allocation.amount,
                targetAmount: allocation.targetAmount,
                shortfall: allocation.shortfall,
                status,
                date: Timestamp.fromDate(allocation.startDate),
                weekStart: Timestamp.fromDate(allocation.weekStart),
                ownerSignature: paymentData.ownerSignature || "",
                driverSignature: paymentData.driverSignature || "",
                driverId: paymentData.driverId || "",
                driverName: paymentData.driverName || "Inconnu",
                reason: allocation.index === paymentPlan.weekCount ? (paymentData.reason || null) : null,
                periodStart: periodStartTimestamp,
                periodEnd: periodEndTimestamp,
                allocationIndex: allocation.index,
                allocationCount: paymentPlan.weekCount,
                intervalGroupId,
                createdAt,
            });
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error converting payment to range:", error);
        return false;
    }
};
