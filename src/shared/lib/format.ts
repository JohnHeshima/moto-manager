export function formatAmount(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) {
        return "0";
    }

    const absoluteValue = Math.abs(value);
    const hasDecimals = !Number.isInteger(absoluteValue);
    const [integerPart, decimalPart] = absoluteValue
        .toFixed(hasDecimals ? 2 : 0)
        .split(".");

    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const sign = value < 0 ? "-" : "";

    if (!decimalPart || Number(decimalPart) === 0) {
        return `${sign}${groupedInteger}`;
    }

    return `${sign}${groupedInteger},${decimalPart}`;
}

export function formatAmountWithCurrency(value: number | null | undefined) {
    return `${formatAmount(value)} FC`;
}
