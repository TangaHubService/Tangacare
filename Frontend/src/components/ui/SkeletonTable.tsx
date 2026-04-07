import { useEffect, useState, type CSSProperties } from 'react';

const shimmer = `
  @keyframes skeletonShimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  @keyframes fadeInRow {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
`;

const densityMap = {
    compact: { cell: '8px 12px', height: '36px' },
    normal: { cell: '12px 16px', height: '48px' },
    relaxed: { cell: '16px 20px', height: '60px' },
};

type Density = keyof typeof densityMap;

/* ─── Skeleton cell ─────────────────────────────────────────── */
interface SkeletonCellProps {
    width?: string;
    animate?: boolean;
    delay?: number;
    align?: 'left' | 'center' | 'right';
}

function SkeletonCell({
    width = '80%',
    animate = true,
    delay = 0,
    align = 'left',
}: SkeletonCellProps) {
    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: justifyMap[align] || 'flex-start',
            }}
        >
            <div
                style={{
                    width,
                    height: '14px',
                    borderRadius: '6px',
                    background: animate
                        ? 'linear-gradient(90deg, var(--sk-cell-base) 25%, var(--sk-cell-mid) 50%, var(--sk-cell-base) 75%)'
                        : 'var(--sk-cell-base)',
                    backgroundSize: animate ? '600px 100%' : 'auto',
                    animation: animate
                        ? `skeletonShimmer 1.6s ease-in-out ${delay}s infinite`
                        : `pulse 2s ease-in-out ${delay}s infinite`,
                }}
            />
        </div>
    );
}

/* ─── Skeleton row ──────────────────────────────────────────── */
interface SkeletonRowProps {
    colCount: number;
    animate?: boolean;
    rowIndex: number;
    density: Density;
    columnAligns?: ('left' | 'center' | 'right')[];
}

function SkeletonRow({
    colCount,
    animate,
    rowIndex,
    density,
    columnAligns = [],
}: SkeletonRowProps) {
    const widths = ['85%', '60%', '75%', '50%', '70%', '90%', '55%'];
    const pad = densityMap[density]?.cell || densityMap.normal.cell;

    return (
        <tr
            style={{
                animation: `fadeInRow 0.4s ease both`,
                animationDelay: `${rowIndex * 0.06}s`,
            }}
        >
            {Array.from({ length: colCount }).map((_, ci) => (
                <td
                    key={ci}
                    style={{
                        padding: pad,
                        borderBottom: '1px solid var(--sk-border)',
                    }}
                >
                    <SkeletonCell
                        width={widths[(rowIndex + ci) % widths.length]}
                        animate={animate}
                        delay={(rowIndex * colCount + ci) * 0.04}
                        align={columnAligns[ci] || 'left'}
                    />
                </td>
            ))}
        </tr>
    );
}

/* ─── Real data row ─────────────────────────────────────────── */
interface DataRowProps {
    row: any;
    headers?: string[] | null;
    rowIndex: number;
    density: Density;
    columnAligns?: ('left' | 'center' | 'right')[];
    actions?: boolean;
    onRowClick?: (row: any, index: number) => void;
    zebra?: boolean;
}

function DataRow({
    row,
    headers,
    rowIndex,
    density,
    columnAligns = [],
    actions,
    onRowClick,
    zebra,
}: DataRowProps) {
    const pad = densityMap[density]?.cell || densityMap.normal.cell;
    const keys =
        headers && headers.length
            ? headers.map((h) => h.toLowerCase().replace(/\s+/g, '_'))
            : Object.keys(row);

    const [hovered, setHovered] = useState(false);

    return (
        <tr
            onClick={() => onRowClick?.(row, rowIndex)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                animation: `fadeInRow 0.35s ease both`,
                animationDelay: `${rowIndex * 0.04}s`,
                backgroundColor: hovered
                    ? 'var(--sk-row-hover)'
                    : zebra && rowIndex % 2 === 1
                      ? 'var(--sk-row-zebra)'
                      : 'transparent',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
            }}
        >
            {keys.map((key, ci) => (
                <td
                    key={ci}
                    style={{
                        padding: pad,
                        borderBottom: '1px solid var(--sk-border)',
                        fontSize: '14px',
                        color: 'var(--sk-body-text)',
                        textAlign: (columnAligns[ci] || 'left') as any,
                        fontFamily: "'DM Mono', 'Fira Code', monospace",
                        letterSpacing: '-0.01em',
                    }}
                >
                    {String(row[key] ?? '—')}
                </td>
            ))}
            {actions && (
                <td
                    style={{
                        padding: pad,
                        borderBottom: '1px solid var(--sk-border)',
                        textAlign: 'right',
                    }}
                >
                    <span style={{ display: 'inline-flex', gap: '6px' }}>
                        <ActionBtn label="Edit" color="#3b82f6" />
                        <ActionBtn label="Delete" color="#ef4444" />
                    </span>
                </td>
            )}
        </tr>
    );
}

interface ActionBtnProps {
    label: string;
    color: string;
}

function ActionBtn({ label, color }: ActionBtnProps) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '3px 10px',
                fontSize: '11px',
                fontFamily: "'DM Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                border: `1px solid ${color}`,
                borderRadius: '4px',
                background: hov ? color : 'transparent',
                color: hov ? '#fff' : color,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
            }}
        >
            {label}
        </button>
    );
}

/* ─── Header cell ───────────────────────────────────────────── */
interface HeaderCellProps {
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    isAction?: boolean;
}

function HeaderCell({ label, width, align = 'left', isAction }: HeaderCellProps) {
    return (
        <th
            style={{
                width,
                padding: '10px 16px',
                textAlign: isAction ? 'right' : align,
                fontFamily: "'DM Mono', 'Fira Code', monospace",
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--sk-header-text)',
                borderBottom: '2px solid var(--sk-header-border)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
            }}
        >
            {label}
        </th>
    );
}

/* ─── MAIN EXPORT ───────────────────────────────────────────── */
export interface SkeletonTableProps {
    rows?: number;
    columns?: number;
    headers?: string[] | null;
    data?: any[] | null;
    loading?: boolean;
    columnWidths?: string[];
    columnAligns?: ('left' | 'center' | 'right')[];
    actions?: boolean;
    title?: string;
    caption?: string;
    animate?: boolean;
    density?: Density;
    zebra?: boolean;
    onRowClick?: (row: any, index: number) => void;
    emptyMessage?: string;
    className?: string;
}

export function SkeletonTable({
    rows = 5,
    columns = 4,
    headers,
    data,
    loading,
    columnWidths = [],
    columnAligns = [],
    actions = false,
    title,
    caption,
    animate = true,
    density = 'normal',
    zebra = true,
    onRowClick,
    emptyMessage = 'No data available.',
    className = '',
}: SkeletonTableProps) {
    const readDarkMode = () =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const [isDark, setIsDark] = useState(readDarkMode);

    useEffect(() => {
        setIsDark(readDarkMode());

        if (typeof document === 'undefined') return;
        const observer = new MutationObserver(() => setIsDark(readDarkMode()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    const colCount = headers?.length || (data?.[0] ? Object.keys(data[0]).length : columns);
    const effectiveCols = actions ? colCount + 1 : colCount;

    const isLoading = loading !== undefined ? loading : !data;

    const isEmpty = !isLoading && Array.isArray(data) && data.length === 0;

    const headersToShow = headers ? (actions ? [...headers, 'Actions'] : headers) : null;

    const themeVars: CSSProperties = {
        ['--sk-bg' as string]: isDark ? '#0f172a' : '#ffffff',
        ['--sk-border' as string]: isDark ? '#1e293b' : '#f0f0f0',
        ['--sk-header-bg' as string]: isDark ? '#111827' : '#fafafa',
        ['--sk-header-border' as string]: isDark ? '#334155' : '#e8e8ef',
        ['--sk-header-text' as string]: isDark ? '#94a3b8' : '#8a8a9a',
        ['--sk-title-text' as string]: isDark ? '#e2e8f0' : '#111111',
        ['--sk-caption-text' as string]: isDark ? '#94a3b8' : '#999999',
        ['--sk-loading-text' as string]: isDark ? '#94a3b8' : '#bbbbbb',
        ['--sk-dot' as string]: isDark ? '#38bdf8' : '#94a3b8',
        ['--sk-body-text' as string]: isDark ? '#d1d5db' : '#2d2d2d',
        ['--sk-row-hover' as string]: isDark ? '#1e293b' : '#f0f7ff',
        ['--sk-row-zebra' as string]: isDark ? '#111827' : '#fafafa',
        ['--sk-cell-base' as string]: isDark ? '#1f2937' : '#e8e8e8',
        ['--sk-cell-mid' as string]: isDark ? '#334155' : '#f5f5f5',
    };

    return (
        <>
            <style>{shimmer}</style>
            <div
                className={className}
                style={{
                    ...themeVars,
                    width: '100%',
                    fontFamily: "'DM Mono', 'Fira Code', monospace",
                    borderRadius: '12px',
                    border: '1px solid var(--sk-header-border)',
                    overflow: 'hidden',
                    boxShadow: isDark
                        ? '0 1px 3px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.35)'
                        : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                    background: 'var(--sk-bg)',
                }}
            >
                {/* ── Title bar ── */}
                {(title || caption) && (
                    <div
                        style={{
                            padding: '16px 20px 14px',
                            borderBottom: '1px solid var(--sk-border)',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '12px',
                            flexWrap: 'wrap',
                        }}
                    >
                        {title && (
                            <span
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: 'var(--sk-title-text)',
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {title}
                            </span>
                        )}
                        {caption && (
                            <span
                                style={{
                                    fontSize: '12px',
                                    color: 'var(--sk-caption-text)',
                                    fontWeight: 400,
                                }}
                            >
                                {caption}
                            </span>
                        )}
                        {isLoading && (
                            <span
                                style={{
                                    marginLeft: 'auto',
                                    fontSize: '11px',
                                    color: 'var(--sk-loading-text)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                <span
                                    style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: 'var(--sk-dot)',
                                        display: 'inline-block',
                                        animation: 'pulse 1.2s ease-in-out infinite',
                                    }}
                                />
                                Loading…
                            </span>
                        )}
                    </div>
                )}

                {/* ── Table ── */}
                <div style={{ overflowX: 'auto' }}>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            tableLayout: columnWidths.length ? 'fixed' : 'auto',
                        }}
                    >
                        {/* Header */}
                        {headersToShow && (
                            <thead>
                                <tr style={{ background: 'var(--sk-header-bg)' }}>
                                    {headersToShow.map((h, i) => (
                                        <HeaderCell
                                            key={i}
                                            label={h}
                                            width={columnWidths[i]}
                                            align={columnAligns[i]}
                                            isAction={actions && i === headersToShow.length - 1}
                                        />
                                    ))}
                                </tr>
                            </thead>
                        )}

                        {/* Skeleton header (no headers provided) */}
                        {!headersToShow && isLoading && (
                            <thead>
                                <tr style={{ background: 'var(--sk-header-bg)' }}>
                                    {Array.from({ length: effectiveCols }).map((_, i) => (
                                        <th
                                            key={i}
                                            style={{
                                                padding: '10px 16px',
                                                borderBottom: '2px solid var(--sk-header-border)',
                                                width: columnWidths[i],
                                            }}
                                        >
                                            <SkeletonCell
                                                width="60%"
                                                animate={animate}
                                                delay={i * 0.08}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}

                        {/* Skeleton or real data header when data is shown but no headers prop */}
                        {!headersToShow && !isLoading && data && data.length > 0 && (
                            <thead>
                                <tr style={{ background: 'var(--sk-header-bg)' }}>
                                    {Object.keys(data[0]).map((k, i) => (
                                        <HeaderCell
                                            key={i}
                                            label={k.replace(/_/g, ' ')}
                                            width={columnWidths[i]}
                                            align={columnAligns[i]}
                                        />
                                    ))}
                                    {actions && <HeaderCell label="Actions" isAction />}
                                </tr>
                            </thead>
                        )}

                        <tbody>
                            {isLoading ? (
                                Array.from({ length: rows }).map((_, ri) => (
                                    <SkeletonRow
                                        key={ri}
                                        colCount={effectiveCols}
                                        animate={animate}
                                        rowIndex={ri}
                                        density={density}
                                        columnAligns={columnAligns}
                                    />
                                ))
                            ) : isEmpty ? (
                                <tr>
                                    <td
                                        colSpan={effectiveCols}
                                        style={{
                                            padding: '48px 20px',
                                            textAlign: 'center',
                                            color: 'var(--sk-loading-text)',
                                            fontSize: '14px',
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                data?.map((row, ri) => (
                                    <DataRow
                                        key={ri}
                                        row={row}
                                        headers={headers}
                                        rowIndex={ri}
                                        density={density}
                                        columnAligns={columnAligns}
                                        actions={actions}
                                        onRowClick={onRowClick}
                                        zebra={zebra}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Footer row count ── */}
                {!isLoading && !isEmpty && data && (
                    <div
                        style={{
                            padding: '10px 20px',
                            borderTop: '1px solid var(--sk-border)',
                            fontSize: '11px',
                            color: 'var(--sk-loading-text)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {data.length} {data.length === 1 ? 'row' : 'rows'}
                    </div>
                )}
            </div>
        </>
    );
}

/* ================================================================
   DEMO — shows all major use-cases in one screen.
   ================================================================ */
const DEMO_DATA = [
    {
        id: 'USR-001',
        name: 'Amara Nwosu',
        role: 'Engineer',
        status: 'Active',
        joined: '2023-01-12',
    },
    {
        id: 'USR-002',
        name: 'Kenji Tanaka',
        role: 'Designer',
        status: 'Active',
        joined: '2023-03-08',
    },
    {
        id: 'USR-003',
        name: 'Lena Fischer',
        role: 'Product',
        status: 'Inactive',
        joined: '2022-11-30',
    },
    {
        id: 'USR-004',
        name: 'Carlos Ruiz',
        role: 'Engineer',
        status: 'Active',
        joined: '2024-02-14',
    },
    {
        id: 'USR-005',
        name: 'Yemi Adeyemi',
        role: 'Marketing',
        status: 'Active',
        joined: '2023-07-22',
    },
];

export function SkeletonTableDemo() {
    const [phase, setPhase] = useState(0); // 0=loading, 1=data, 2=empty, 3=actions

    const phases = [
        { label: 'Loading', desc: 'Pure skeleton' },
        { label: 'With Data', desc: 'Real rows + header auto-generated' },
        { label: 'Empty State', desc: 'No results' },
        { label: 'With Actions', desc: 'Action buttons column' },
    ];

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#f5f4f0',
                padding: '40px 24px',
                fontFamily: "'DM Mono', monospace",
            }}
        >
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                {/* Title */}
                <div style={{ marginBottom: '32px' }}>
                    <h1
                        style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: '#111',
                            letterSpacing: '-0.04em',
                            margin: 0,
                        }}
                    >
                        SkeletonTable
                    </h1>
                    <p style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
                        Master reusable table component — drop anywhere in your React project
                    </p>
                </div>

                {/* Phase switcher */}
                <div
                    style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}
                >
                    {phases.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => setPhase(i)}
                            style={{
                                padding: '7px 14px',
                                fontSize: '11px',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                border: '1px solid',
                                borderColor: phase === i ? '#111' : '#d0d0d0',
                                borderRadius: '6px',
                                background: phase === i ? '#111' : '#fff',
                                color: phase === i ? '#fff' : '#555',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <p
                    style={{
                        fontSize: '12px',
                        color: '#aaa',
                        marginBottom: '20px',
                        marginTop: '-12px',
                    }}
                >
                    → {phases[phase].desc}
                </p>

                {/* Demo tables */}
                {phase === 0 && (
                    <SkeletonTable
                        title="Users"
                        caption="loading from API…"
                        rows={6}
                        columns={5}
                        animate
                    />
                )}

                {phase === 1 && (
                    <SkeletonTable
                        title="Users"
                        caption="5 records"
                        data={DEMO_DATA}
                        headers={['ID', 'Name', 'Role', 'Status', 'Joined']}
                        columnAligns={['left', 'left', 'left', 'center', 'right']}
                        density="normal"
                        zebra
                        onRowClick={(row) => alert(`Clicked: ${row.name}`)}
                    />
                )}

                {phase === 2 && (
                    <SkeletonTable
                        title="Search Results"
                        data={[]}
                        headers={['ID', 'Name', 'Role', 'Status', 'Joined']}
                        emptyMessage="No users match your filters."
                    />
                )}

                {phase === 3 && (
                    <SkeletonTable
                        title="Users"
                        caption="with action column"
                        data={DEMO_DATA}
                        headers={['ID', 'Name', 'Role', 'Status', 'Joined']}
                        columnAligns={['left', 'left', 'left', 'center', 'right']}
                        actions
                        density="normal"
                    />
                )}
            </div>
        </div>
    );
}
