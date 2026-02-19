import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Database } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  itemsPerPageOptions?: number[];
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

// Seuil pour le mode "large dataset"
const LARGE_DATASET_THRESHOLD = 10000;
const MAX_PAGE_FOR_DIRECT_NAV = 1000;

// Formater les grands nombres (1000000 → 1M, 1000 → 1K)
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
  const [showGoToPage, setShowGoToPage] = useState(false);
  const [goToPageValue, setGoToPageValue] = useState('');

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Mode large dataset: pas de numéros de page, juste prev/next
  const isLargeDataset = totalItems > LARGE_DATASET_THRESHOLD;
  const showPageNumbers = totalPages <= MAX_PAGE_FOR_DIRECT_NAV && !isLargeDataset;

  const getPageNumbers = () => {
    if (!showPageNumbers) return [];

    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPageValue);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setGoToPageValue('');
      setShowGoToPage(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    } else if (e.key === 'Escape') {
      setShowGoToPage(false);
      setGoToPageValue('');
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-wrap gap-2">
      {/* Informations */}
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Affichage de <span className="font-medium">{formatNumber(startItem)}</span> à{' '}
          <span className="font-medium">{formatNumber(endItem)}</span> sur{' '}
          <span className="font-medium">{formatNumber(totalItems)}</span> résultat(s)
        </p>

        {/* Indicateur de grand dataset */}
        {isLargeDataset && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs">
            <Database className="w-3 h-3" />
            <span>Grand volume</span>
          </div>
        )}

        {/* Sélecteur d'éléments par page */}
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Éléments par page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="input-field py-1 text-sm w-20"
            >
              {itemsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Contrôles de pagination */}
      <div className="flex items-center gap-2">
        {/* Première page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Première page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Page précédente */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Page précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Numéros de page OU indicateur de position */}
        {showPageNumbers ? (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="px-3 py-2 text-gray-500 dark:text-gray-400">...</span>
                ) : (
                  <button
                    onClick={() => onPageChange(page as number)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          // Mode large dataset: afficher position actuelle avec saut rapide
          <div className="flex items-center gap-2">
            {showGoToPage ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={goToPageValue}
                  onChange={(e) => setGoToPageValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (!goToPageValue) setShowGoToPage(false);
                  }}
                  placeholder={`1-${formatNumber(totalPages)}`}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleGoToPage}
                  className="px-2 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowGoToPage(true)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition-colors"
                title="Cliquer pour aller à une page"
              >
                Page {formatNumber(currentPage)} / {formatNumber(totalPages)}
              </button>
            )}
          </div>
        )}

        {/* Page suivante */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Page suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Dernière page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Dernière page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
