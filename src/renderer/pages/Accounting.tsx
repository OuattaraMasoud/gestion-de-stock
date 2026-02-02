import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { AccountingEntry } from '../types';
import { formatCurrency } from '../utils/formatters';
import Pagination from '../components/Pagination';

const Accounting: React.FC = () => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [treasury, setTreasury] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalEntrees, setTotalEntrees] = useState(0);
  const [totalSorties, setTotalSorties] = useState(0);

  useEffect(() => {
    loadTreasury();
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage, itemsPerPage]);

  const loadTreasury = async () => {
    try {
      const treasuryData = await window.electronAPI.getTreasury();
      setTreasury(treasuryData.total);
    } catch (error) {
      console.error('Erreur chargement trésorerie:', error);
    }
  };

  const loadData = async (filterStartDate?: string, filterEndDate?: string) => {
    try {
      setLoading(true);
      const result = await window.electronAPI.getAccountingEntriesPaginated(
        currentPage,
        itemsPerPage,
        filterStartDate || (startDate || undefined),
        filterEndDate || (endDate || undefined)
      );
      setEntries(result.data);
      setTotalItems(result.total);
      setTotalEntrees(result.totalEntrees);
      setTotalSorties(result.totalSorties);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilter = async () => {
    if (!startDate || !endDate) {
      alert('Veuillez sélectionner une période');
      return;
    }
    setCurrentPage(1);
    loadData(startDate, endDate);
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    loadData(undefined, undefined);
  };

  // Pagination - maintenant côté serveur
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'vente': 'Vente',
      'achat': 'Achat',
      'paiement_client': 'Paiement Client',
      'paiement_fournisseur': 'Paiement Fournisseur',
      'depense': 'Dépense',
      'autre': 'Autre',
    };
    return labels[type] || type;
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Comptabilité</h1>
        <p className="text-gray-600 mt-1">Gestion de la trésorerie et des mouvements financiers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Trésorerie</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(treasury)}</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Entrées {startDate && endDate ? '(période)' : ''}</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalEntrees)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100">Total Sorties {startDate && endDate ? '(période)' : ''}</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalSorties)}</p>
            </div>
            <TrendingDown className="w-12 h-12 text-red-200" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <button onClick={handleDateFilter} className="btn-primary">
            <Calendar className="w-5 h-5" />
            Filtrer
          </button>
          {(startDate || endDate) && (
            <button onClick={handleResetFilter} className="btn-secondary">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Journal des mouvements */}
      <div className="card overflow-hidden">
        <h2 className="text-xl font-bold text-gray-900 mb-4 px-6 pt-6">
          Journal des mouvements
          {loading && <span className="ml-2 text-sm font-normal text-gray-500">Chargement...</span>}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Méthode
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(entry.created_at!).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.type_mouvement === 'entree'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {getTypeLabel(entry.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entry.methode_paiement || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                    <span className={entry.type_mouvement === 'entree' ? 'text-green-600' : 'text-red-600'}>
                      {entry.type_mouvement === 'entree' ? '+' : '-'} {formatCurrency(entry.montant)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemsPerPageOptions={[20, 50, 100]}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
    </div>
  );
};

export default Accounting;
