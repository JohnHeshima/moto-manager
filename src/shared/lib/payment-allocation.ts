const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type PaymentType = "weekly" | "range";

export interface PaymentRangeAllocation {
    index: number;
    startDate: Date;
    endDate: Date;
    weekStart: Date;
    amount: number;
    targetAmount: number;
    shortfall: number;
    surplus: number;
}

export interface PaymentRangePlan {
    weekCount: number;
    minimumAmountForLastWeekCarry: number;
    allocations: PaymentRangeAllocation[];
    lastWeekAmount: number;
    isValid: boolean;
    validationMessage?: string;
}

function atMidday(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function getInclusiveDayCount(startDate: Date, endDate: Date) {
    return Math.floor((atMidday(endDate).getTime() - atMidday(startDate).getTime()) / DAY_IN_MS) + 1;
}

function getRangeWeekCount(totalDays: number) {
    if (totalDays <= 7) {
        return 1;
    }

    const fullWeeks = Math.floor(totalDays / 7);
    const remainderDays = totalDays % 7;

    if (remainderDays === 0) {
        return fullWeeks;
    }

    // Small remainders are merged into the final generated week to match the business example.
    return remainderDays <= 3 ? fullWeeks : fullWeeks + 1;
}

export function buildPaymentRangePlan({
    startDate,
    endDate,
    totalAmount,
    targetAmount,
}: {
    startDate: Date;
    endDate: Date;
    totalAmount: number;
    targetAmount: number;
}): PaymentRangePlan {
    const normalizedStartDate = atMidday(startDate);
    const normalizedEndDate = atMidday(endDate);

    if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
        return {
            weekCount: 0,
            minimumAmountForLastWeekCarry: 0,
            allocations: [],
            lastWeekAmount: 0,
            isValid: false,
            validationMessage: "La date de fin doit être supérieure ou égale à la date de début.",
        };
    }

    const totalDays = getInclusiveDayCount(normalizedStartDate, normalizedEndDate);
    const weekCount = getRangeWeekCount(totalDays);
    const minimumAmountForLastWeekCarry = Math.max(0, (weekCount - 1) * targetAmount);

    if (totalAmount < minimumAmountForLastWeekCarry) {
        return {
            weekCount,
            minimumAmountForLastWeekCarry,
            allocations: [],
            lastWeekAmount: 0,
            isValid: false,
            validationMessage: `Pour garder le manque uniquement sur la dernière semaine, le montant doit être au moins de ${minimumAmountForLastWeekCarry.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FC.`,
        };
    }

    const allocations: PaymentRangeAllocation[] = [];
    const lastWeekAmount = totalAmount - minimumAmountForLastWeekCarry;

    for (let index = 0; index < weekCount; index += 1) {
        const start = addDays(normalizedStartDate, index * 7);
        const end = index === weekCount - 1 ? normalizedEndDate : addDays(start, 6);
        const amount = index === weekCount - 1 ? lastWeekAmount : targetAmount;
        const shortfall = Math.max(0, targetAmount - amount);
        const surplus = Math.max(0, amount - targetAmount);

        allocations.push({
            index: index + 1,
            startDate: start,
            endDate: end,
            weekStart: start,
            amount,
            targetAmount,
            shortfall,
            surplus,
        });
    }

    return {
        weekCount,
        minimumAmountForLastWeekCarry,
        allocations,
        lastWeekAmount,
        isValid: true,
    };
}
