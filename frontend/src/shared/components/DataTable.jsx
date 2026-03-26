import React from 'react';
import { RefreshCw } from 'lucide-react';
import { colors } from '../constants';

// Data Table
export function DataTable({ columns, data, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-8" style={{ borderColor: colors.border }}>
        <div className="flex items-center justify-center">
          <RefreshCw className="animate-spin" style={{ color: colors.accent }} />
          <span className="ml-2" style={{ color: colors.textSecondary }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor: colors.surface }}>
            {columns.map((col, i) => (
              <th 
                key={i} 
                className="px-6 py-4 text-left text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length} 
                className="px-6 py-12 text-center"
                style={{ color: colors.textMuted }}
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr 
                key={i} 
                className="border-t transition-colors hover:bg-gray-50"
                style={{ borderColor: colors.borderLight }}
              >
                {columns.map((col, j) => (
                  <td key={j} className="px-6 py-4 text-sm" style={{ color: colors.text }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
