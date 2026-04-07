export const toSentenceCase = (value?: string | null): string => {
    const normalized = String(value ?? '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    if (!normalized) return '';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
