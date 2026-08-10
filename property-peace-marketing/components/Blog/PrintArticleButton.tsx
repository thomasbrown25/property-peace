'use client';

import { FiPrinter } from 'react-icons/fi';

export default function PrintArticleButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="article-print-button inline-flex items-center gap-2 rounded-none border border-[#E5E5E5] bg-white px-4 py-2 text-sm font-semibold text-primary-main transition-colors hover:border-green-300 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
      aria-label="Print this article"
    >
      <FiPrinter className="h-4 w-4" aria-hidden="true" />
      Print article
    </button>
  );
}
