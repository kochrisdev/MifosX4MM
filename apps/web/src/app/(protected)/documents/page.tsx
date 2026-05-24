'use client';

import { FileText } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <FileText size={24} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Documents</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Document management is coming soon. KYC documents and loan agreements will appear here.
        </p>
      </div>
    </div>
  );
}
