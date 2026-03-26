import React from 'react';
import { RefreshCw } from 'lucide-react';
import { colors } from '../../constants/colors';

function DataTable({ columns, data, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: colors.textMuted }}>
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              className="transition-colors hover:bg-slate-50"
              style={{ borderBottom: `1px solid ${colors.border}` }}
            >
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className="px-4 py-3 text-sm"
                  style={{ color: colors.text }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(DataTable);
