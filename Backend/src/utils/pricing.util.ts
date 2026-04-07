export function resolveMarkupPercent(
    productMarkupPercent: number | null | undefined,
    categoryDefaultMarkupPercent: number | null | undefined,
    facilityDefaultMarkupPercent: number | null | undefined,
    fallback: number = 20,
): number {
    const p = productMarkupPercent != null ? Number(productMarkupPercent) : null;
    const c = categoryDefaultMarkupPercent != null ? Number(categoryDefaultMarkupPercent) : null;
    const f = facilityDefaultMarkupPercent != null ? Number(facilityDefaultMarkupPercent) : null;
    if (p != null && !Number.isNaN(p)) return p;
    if (c != null && !Number.isNaN(c)) return c;
    if (f != null && !Number.isNaN(f)) return f;
    return fallback;
}
