import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, ShoppingCart, Package, Percent } from 'lucide-react';
import { AccountingEntry } from '../types';
import { formatCurrency } from '../utils/formatters';
import Pagination from '../components/Pagination';

interface ProfitStats {
  chiffreAffaires: number;
  coutMarchandises: number;
  beneficeBrut: number;
  margePercent: number;
  nbVentes: number;
  nbProduitsVendus: number;
  totalAchats: number;
}

type PeriodType = "today" | "yesterday" | "last3days" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

const periodLabels: Record<PeriodType, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  last3days: "3 derniers jours",
  thisWeek: "Cette semaine",
  lastWeek: "Semaine dernière",
  thisMonth: "Ce mois",
  lastMonth: "Mois dernier",
  custom: "Personnalisé",
};

const getDateRange = (period: PeriodType, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  switch (period) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: formatDate(yesterday), end: formatDate(yesterday) };
    }
    case "last3days": {
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      return { start: formatDate(threeDaysAgo), end: formatDate(today) };
    }
    case "thisWeek": {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return { start: formatDate(startOfWeek), end: formatDate(today) };
    }
    case "lastWeek": {
      const startOfLastWeek = new Date(today);
      const day = startOfLastWeek.getDay();
      const diff = startOfLastWeek.getDate() - day + (day === 0 ? -6 : 1) - 7;
      startOfLastWeek.setDate(diff);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      return { start: formatDate(startOfLastWeek), end: formatDate(endOfLastWeek) };
    }
    case "thisMonth": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(startOfMonth), end: formatDate(today) };
    }
    case "lastMonth": {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) };
    }
    case "custom":
      return { start: customStart || formatDate(today), end: customEnd || formatDate(today) };
    default:
      return { start: formatDate(today), end: formatDate(today) };
  }
};

const Accounting: React.FC = () => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [treasury, setTreasury] = useState<number>(0);
  const [profitStats, setProfitStats] = useState<ProfitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalEntrees, setTotalEntrees] = useState(0);
  const [totalSorties, setTotalSorties] = useState(0);

  useEffect(() => {
    loadTreasury();
  }, []);

  useEffect(() => {
    loadAllData();
  }, [selectedPeriod, customStartDate, customEndDate, currentPage, itemsPerPage]);

  const loadTreasury = async () => {
    try {
      const treasuryData = await window.electronAPI.getTreasury();
      setTreasury(treasuryData.total);
    } catch (error) {
      console.error('Erreur chargement trésorerie:', error);
    }
  };

  const loadAllData = async () => {
    const { start, end } = getDateRange(selectedPeriod, customStartDate, customEndDate);

    try {
      setLoading(true);
      const [statsResult, entriesResult] = await Promise.all([
        window.electronAPI.getProfitStats(start, end),
        window.electronAPI.getAccountingEntriesPaginated(currentPage, itemsPerPage, start, end)
      ]);

      setProfitStats(statsResult);
      setEntries(entriesResult.data);
      setTotalItems(entriesResult.total);
      setTotalEntrees(entriesResult.totalEntrees);
      setTotalSorties(entriesResult.totalSorties);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
    setCurrentPage(1);
    if (period === "custom") {
      setShowCustomDates(true);
      if (!customStartDate) {
        const today = new Date().toISOString().split("T")[0];
        setCustomStartDate(today);
        setCustomEndDate(today);
      }
    } else {
      setShowCustomDates(false);
    }
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
      {/* Header avec filtre de période */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comptabilité</h1>
          <p className="text-gray-600 mt-1">
            {selectedPeriod === "custom" && customStartDate && customEndDate
              ? `Du ${new Date(customStartDate).toLocaleDateString("fr-FR")} au ${new Date(customEndDate).toLocaleDateString("fr-FR")}`
              : periodLabels[selectedPeriod]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <Calendar className="w-4 h-4 text-gray-500 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
              className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none cursor-pointer pr-8"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {showCustomDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistiques de Profit */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.chiffreAffaires || 0)}</p>
              <p className="text-blue-200 text-xs mt-1">{profitStats?.nbVentes || 0} ventes • {profitStats?.nbProduitsVendus || 0} produits</p>
            </div>
            <ShoppingCart className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Coût Marchandises</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.coutMarchandises || 0)}</p>
              <p className="text-orange-200 text-xs mt-1">Prix d'achat des produits vendus</p>
            </div>
            <Package className="w-10 h-10 text-orange-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Bénéfice Brut</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.beneficeBrut || 0)}</p>
              <p className="text-green-200 text-xs mt-1">CA - Coût marchandises</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Marge Bénéficiaire</p>
              <p className="text-2xl font-bold mt-1">{(profitStats?.margePercent || 0).toFixed(1)}%</p>
              <p className="text-purple-200 text-xs mt-1">Bénéfice / CA × 100</p>
            </div>
            <Percent className="w-10 h-10 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Trésorerie et Mouvements */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Trésorerie (Caisse)</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(treasury)}</p>
              <p className="text-emerald-200 text-xs mt-1">Entrées - Sorties (tout temps)</p>
            </div>
            <DollarSign className="w-10 h-10 text-emerald-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm">Total Entrées</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalEntrees)}</p>
              <p className="text-cyan-200 text-xs mt-1">Ventes + Paiements clients</p>
            </div>
            <TrendingUp className="w-10 h-10 text-cyan-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Sorties</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalSorties)}</p>
              <p className="text-red-200 text-xs mt-1">Achats + Paiements fournisseurs</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-200" />
          </div>
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
