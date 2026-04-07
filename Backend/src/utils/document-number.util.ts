export function generateDocumentNumber(prefix: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const rand = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');

    return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}-${rand}`;
}
