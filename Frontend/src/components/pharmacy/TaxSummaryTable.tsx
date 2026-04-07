import { useRuntimeConfig } from '../../context/RuntimeConfigContext';

interface TaxDetail {
    tax_rate: number;
    taxable_amount: number;
    tax_amount: number;
}

interface TaxSummaryTableProps {
    data: TaxDetail[];
    totalTaxable: number;
    totalVat: number;
}

export const TaxSummaryTable = ({ data, totalTaxable, totalVat }: TaxSummaryTableProps) => {
    const { formatMoney } = useRuntimeConfig();
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tax / VAT Summary
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="tc-table w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/50">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Tax Rate (%)
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                                Taxable Amount
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                                VAT Amount
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {data.map((item, index) => (
                            <tr
                                key={index}
                                className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap">
                                    {(item.tax_rate * 100).toFixed(0)}%
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right whitespace-nowrap">
                                    {formatMoney(item.taxable_amount)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right whitespace-nowrap">
                                    {formatMoney(item.tax_amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50 dark:bg-slate-800/50 font-bold">
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                Total
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right">
                                {formatMoney(totalTaxable)}
                            </td>
                            <td className="px-6 py-4 text-sm text-blue-600 dark:text-blue-400 text-right">
                                {formatMoney(totalVat)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {data.length === 0 && (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                    No tax data available for the selected period.
                </div>
            )}
        </div>
    );
};
