'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Settings size={24} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Settings</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Organisation settings, branch management, and user administration will appear here.
        </p>
      </div>
    </div>
  );
}
