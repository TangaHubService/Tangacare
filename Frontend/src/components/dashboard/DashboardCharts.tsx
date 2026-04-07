import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
    Line,
    LineChart,
    ReferenceLine,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { formatLocalDate, formatLocalDateTime, parseLocalDate } from '../../lib/date';

// --- Types ---
export interface InventoryData {
    category: string;
    count: number;
    value: number;
}

export interface TrendData {
    date: string;
    dispensed: number;
    received: number;
}

export interface ColdChainTrendData {
    timestamp: string;
    average_temperature_c: number;
    readings: number;
    excursion_readings: number;
}

// --- Components ---

export const InventoryStatusChart: React.FC<{ data: InventoryData[] }> = ({ data }) => {
    const { isDark } = useTheme();
    const axisColor = isDark ? '#94a3b8' : '#6B7280';
    const gridColor = isDark ? '#334155' : '#E5E7EB';
    const tooltipStyle = {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#E5E7EB',
        color: isDark ? '#f8fafc' : '#111827',
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
                <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke={gridColor}
                />
                <XAxis type="number" stroke={axisColor} tick={{ fontSize: 10 }} />
                <YAxis
                    dataKey="category"
                    type="category"
                    width={80}
                    stroke={axisColor}
                    tick={{ fontSize: 10 }}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: any, name: any) => [
                        name === 'value' && typeof value === 'number'
                            ? `$${value.toLocaleString()}`
                            : value,
                        name === 'value' ? 'Stock Value' : 'Item Count',
                    ]}
                />
                <Legend />
                <Bar dataKey="count" name="Items" fill="#2563EB" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export const ConsumptionTrendChart: React.FC<{ data: TrendData[] }> = ({ data }) => {
    const { isDark } = useTheme();
    const axisColor = isDark ? '#94a3b8' : '#6B7280';
    const gridColor = isDark ? '#334155' : '#E5E7EB';
    const tooltipStyle = {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#E5E7EB',
        color: isDark ? '#f8fafc' : '#111827',
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                    <linearGradient id="colorDispensed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="date"
                    stroke={axisColor}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(str) => {
                        const date = parseLocalDate(str);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                />
                <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={35} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <Tooltip
                    labelFormatter={(label) => formatLocalDate(label)}
                    contentStyle={tooltipStyle}
                />
                <Legend />
                <Area
                    type="monotone"
                    dataKey="dispensed"
                    stackId="1"
                    stroke="#2563EB"
                    fillOpacity={1}
                    fill="url(#colorDispensed)"
                    name="Dispensed"
                />
                <Area
                    type="monotone"
                    dataKey="received"
                    stackId="1"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorReceived)"
                    name="Received"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export const ExpiryRiskChart: React.FC<{ data: any }> = ({ data }) => {
    const { isDark } = useTheme();
    const axisColor = isDark ? '#94a3b8' : '#6B7280';
    const gridColor = isDark ? '#334155' : '#E5E7EB';
    const tooltipStyle = {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#E5E7EB',
        color: isDark ? '#f8fafc' : '#111827',
    };

    // Transform backend data to chart format if needed, or assume data is ready
    // Expected data: { "0-30 days": 10, "30-60 days": 5, ... } array or object
    // Adapting to generic array for now
    const chartData = [
        { name: '0-30 Days', count: data?.days_30 || 0, fill: '#EF4444' },
        { name: '31-60 Days', count: data?.days_60 || 0, fill: '#F59E0B' },
        { name: '61-90 Days', count: data?.days_90 || 0, fill: '#10B981' },
    ];

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" stroke={axisColor} tick={{ fontSize: 10 }} />
                <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="count" name="Batches Expiring" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export const ColdChainTelemetryChart: React.FC<{ data: ColdChainTrendData[] }> = ({ data }) => {
    const { isDark } = useTheme();
    const axisColor = isDark ? '#94a3b8' : '#6B7280';
    const gridColor = isDark ? '#334155' : '#E5E7EB';
    const tooltipStyle = {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#E5E7EB',
        color: isDark ? '#f8fafc' : '#111827',
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                    dataKey="timestamp"
                    stroke={axisColor}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                        const d = parseLocalDate(value);
                        return `${d.getHours().toString().padStart(2, '0')}:00`;
                    }}
                />
                <YAxis stroke={axisColor} tick={{ fontSize: 10 }} width={35} />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatLocalDateTime(label)}
                    formatter={(value: any, name: any) => {
                        if (name === 'average_temperature_c') {
                            return [`${Number(value).toFixed(1)}°C`, 'Avg Temperature'];
                        }
                        return [value, 'Excursion Readings'];
                    }}
                />
                <ReferenceLine y={8} stroke="#F59E0B" strokeDasharray="4 4" />
                <ReferenceLine y={-15} stroke="#F59E0B" strokeDasharray="4 4" />
                <Line
                    type="monotone"
                    dataKey="average_temperature_c"
                    name="average_temperature_c"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
                <Line
                    type="monotone"
                    dataKey="excursion_readings"
                    name="excursion_readings"
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};
