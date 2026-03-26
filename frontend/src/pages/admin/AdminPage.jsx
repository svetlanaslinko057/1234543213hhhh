import React from 'react';
import { colors } from '../../constants/colors';

// Placeholder - admin functionality
export default function AdminPage() {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>
        System Admin
      </h2>
      <p style={{ color: colors.textSecondary }}>
        Manage API keys, proxies, and providers
      </p>
    </div>
  );
}
