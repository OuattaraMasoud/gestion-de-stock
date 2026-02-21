import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemsPerPageOptions?: number[];
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 10000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString('fr-FR');
};

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  itemsPerPageOptions = [10, 20, 50, 100],
  onItemsPerPageChange,
}) => {
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  if (totalItems === 0) return null;

  const handlePageInput = () => {
    const page = parseInt(pageInputValue);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setPageInputValue('');
      setShowPageInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePageInput();
    else if (e.key === 'Escape') {
      setShowPageInput(false);
      setPageInputValue('');
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-gray-600 dark:text-gray-400">
          {formatNumber((currentPage - 1) * itemsPerPage + 1)}-{formatNumber(Math.min(currentPage * itemsPerPage, totalItems))} / {formatNumber(totalItems)}
        </span>
        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 outline-none"
          >
            {itemsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}/page</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {showPageInput ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!pageInputValue) setShowPageInput(false); }}
              placeholder={`${currentPage}`}
              className="w-14 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded outline-none"
              autoFocus
            />
            <button onClick={handlePageInput} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setShowPageInput(true)}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {currentPage} / {totalPages}
          </button>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
