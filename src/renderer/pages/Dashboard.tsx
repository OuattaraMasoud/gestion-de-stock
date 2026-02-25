import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  DollarSign,
  Truck,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  X,
} from "lucide-react";
import { DashboardStatsByDate, Product } from "../types";
import { formatCurrency } from "../utils/formatters";
import Pagination from "../components/Pagination";

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

// Modal affichant les détails d'une carte du dashboard
const DashboardDetailModal: React.FC<{
  type: string;
  data: any[];
  onClose: () => void;
}> = ({ type, data, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const titles: Record<string, string> = {
    ventes: "Détail Ventes Totales",
    benefice: "Détail Bénéfice",
    nb_ventes: "Détail Ventes",
    couts: "Détail Coûts",
  };

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [type, data.length]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{titles[type] || "Détail"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {data.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucune donnée pour cette période</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                  {type === "nb_ventes" ? (
                    <>
                      <th className="py-2 text-left">Vente</th>
                      <th className="py-2 text-left">Client</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-center">Articles</th>
                      <th className="py-2 text-center">Statut</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 text-left">Produit</th>
                      <th className="py-2 text-right">Quantité</th>
                      <th className="py-2 text-right">
                        {type === "ventes" ? "CA Généré" : type === "benefice" ? "Bénéfice" : "Coût Total"}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {type === "nb_ventes"
                  ? paginatedData.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2 text-gray-900 dark:text-white">#{row.id}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{row.client_nom || "—"}</td>
                        <td className="py-2 text-right font-semibold text-blue-600">{formatCurrency(row.total)}</td>
                        <td className="py-2 text-center text-gray-600 dark:text-gray-400">{row.nb_articles}</td>
                        <td className="py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.statut_paiement === "paye" ? "bg-green-100 text-green-700" :
                            row.statut_paiement === "partiel" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {row.statut_paiement === "paye" ? "Payé" : row.statut_paiement === "partiel" ? "Partiel" : "Impayé"}
                          </span>
                        </td>
                      </tr>
                    ))
                  : paginatedData.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2 text-gray-900 dark:text-white">{row.nom}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{row.quantite_vendue}</td>
                        <td className="py-2 text-right font-semibold text-blue-600">
                          {formatCurrency(row.ca_genere ?? row.benefice_genere ?? row.cout_total ?? 0)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </div>
        {data.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={data.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            itemsPerPageOptions={[10, 20, 50, 100]}
            onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatsByDate | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Modal card details
  const [cardDetailType, setCardDetailType] = useState<string | null>(null);
  const [cardDetailData, setCardDetailData] = useState<any[]>([]);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(selectedPeriod, customStartDate, customEndDate);

      const [statsData, lowStock] = await Promise.all([
        window.electronAPI.getDashboardStatsByDate(start, end),
        window.electronAPI.getLowStockProducts(),
      ]);
      setStats(statsData);
      setLowStockProducts(lowStock);

      const recentProductsResult = await window.electronAPI.getProductsPaginated(1, 5);
      setRecentProducts(recentProductsResult.data);
    } catch (error) {
      console.error("Erreur chargement dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
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

  const handleCardClick = async (type: string) => {
    if (!stats) return;
    const { start, end } = getDateRange(selectedPeriod, customStartDate, customEndDate);
    setCardDetailType(type);
    setCardDetailLoading(true);
    setCardDetailData([]);
    try {
      const data = await window.electronAPI.getDashboardCardDetails(type, start, end);
      setCardDetailData(data);
    } catch (error) {
      console.error("Erreur card details:", error);
    } finally {
      setCardDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const salesOverview = [
    {
      title: "VENTES TOTALES",
      value: formatCurrency(stats?.ventesPeriode || 0),
      change: calculateChange(stats?.ventesPeriode || 0, stats?.ventesPeriodePrecedente || 0),
      isPositive: (stats?.ventesPeriode || 0) >= (stats?.ventesPeriodePrecedente || 0),
      subtitle: "vs période préc.",
      gradient: "from-blue-500 to-blue-600",
      cardType: "ventes",
    },
    {
      title: "BÉNÉFICE TOTAL",
      value: formatCurrency(stats?.profitPeriode || 0),
      change: calculateChange(stats?.profitPeriode || 0, stats?.profitPeriodePrecedente || 0),
      isPositive: (stats?.profitPeriode || 0) >= (stats?.profitPeriodePrecedente || 0),
      subtitle: "vs période préc.",
      gradient: "from-green-500 to-green-600",
      cardType: "benefice",
    },
    {
      title: "NOMBRE DE VENTES",
      value: stats?.nbVentesPeriode || 0,
      change: calculateChange(stats?.ventesPeriode || 0, stats?.ventesPeriodePrecedente || 0),
      isPositive: (stats?.ventesPeriode || 0) >= (stats?.ventesPeriodePrecedente || 0),
      subtitle: "transactions",
      gradient: "from-purple-500 to-purple-600",
      cardType: "nb_ventes",
    },
    {
      title: "COÛTS",
      value: formatCurrency(stats?.coutsPeriode || 0),
      change: calculateChange(stats?.coutsPeriode || 0, stats?.coutsPeriodePrecedente || 0),
      isPositive: (stats?.coutsPeriode || 0) <= (stats?.coutsPeriodePrecedente || 0),
      subtitle: "vs période préc.",
      gradient: "from-orange-500 to-orange-600",
      cardType: "couts",
    },
  ];

  const inventoryCards = [
    {
      title: "Quantité",
      value: stats?.totalProduits || 0,
      icon: Package,
      color: "bg-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      title: "Revenus",
      value: formatCurrency(stats?.ventesPeriode || 0),
      icon: DollarSign,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "Fournisseurs",
      value: stats?.nbFournisseurs || 0,
      icon: Truck,
      color: "bg-green-500",
      bgColor: "bg-green-50",
    },
    {
      title: "Clients",
      value: stats?.nbClients || 0,
      icon: Users,
      color: "bg-yellow-500",
      bgColor: "bg-yellow-50",
    },
  ];

  const caisse = stats?.caisseOuverte;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {selectedPeriod === "custom" && customStartDate && customEndDate
              ? `Du ${new Date(customStartDate).toLocaleDateString("fr-FR")} au ${new Date(customEndDate).toLocaleDateString("fr-FR")}`
              : periodLabels[selectedPeriod]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
              className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer pr-8"
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
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sales Overview — cartes cliquables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {salesOverview.map((item, index) => (
          <div
            key={index}
            onClick={() => handleCardClick(item.cardType)}
            className={`card bg-gradient-to-br ${item.gradient} text-white cursor-pointer hover:opacity-90 transition-opacity`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-white/80 uppercase">{item.title}</p>
                <h3 className="text-2xl font-bold text-white mt-2">{item.value}</h3>
                <div className="flex items-center gap-1 mt-2">
                  {item.isPositive ? (
                    <ArrowUpRight className="w-4 h-4 text-white/80" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-white/80" />
                  )}
                  <span className="text-xs font-medium text-white/90">{item.change}</span>
                  <span className="text-xs text-white/70">{item.subtitle}</span>
                </div>
              </div>
              {item.isPositive ? (
                <TrendingUp className="w-5 h-5 text-white/80" />
              ) : (
                <TrendingDown className="w-5 h-5 text-white/80" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Section Résultat Global */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">
          Résultat Global — {periodLabels[selectedPeriod]}
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-blue-600 font-medium">Ventes totales (CA)</span>
            <span className="text-sm font-bold text-blue-600">{formatCurrency(stats?.ventesPeriode || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-orange-500">Total des remises</span>
            <span className="text-sm font-semibold text-orange-500">− {formatCurrency(stats?.totalRemisesPeriode || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-red-500">Total crédits accordés</span>
            <span className="text-sm font-semibold text-red-500">− {formatCurrency(stats?.totalCreditsAccordes || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-green-600">Total crédits soldés</span>
            <span className="text-sm font-semibold text-green-600">+ {formatCurrency(stats?.totalCreditsSoldes || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-red-500">Total dépenses</span>
            <span className="text-sm font-semibold text-red-500">− {formatCurrency(stats?.totalDepensesPeriode || 0)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20 rounded px-2">
            <span className="text-sm font-bold text-purple-700 dark:text-purple-300">Résultat TTC (CA − remises − dépenses)</span>
            <span className={`text-sm font-bold ${(stats?.resultatTTC || 0) >= 0 ? "text-purple-700 dark:text-purple-300" : "text-red-600"}`}>
              {formatCurrency(stats?.resultatTTC || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 bg-green-50 dark:bg-green-900/20 rounded px-2">
            <span className="text-sm font-bold text-green-800 dark:text-green-300">Bénéfice net (CA − coûts − remises − dépenses)</span>
            <span className={`text-sm font-bold ${(stats?.beneficeNet || 0) >= 0 ? "text-green-800 dark:text-green-300" : "text-red-600"}`}>
              {formatCurrency(stats?.beneficeNet || 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Products */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Produits récents</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profit total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prix</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{product.nom}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{product.quantite_stock}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {formatCurrency((product.prix_vente - product.prix_achat) * product.quantite_stock)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(product.prix_vente)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Quantity Stock */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Stock faible</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prix</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{product.nom}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-red-600">{product.quantite_stock}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(product.prix_vente)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          Stock bas
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* État de la Caisse */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">État de la Caisse</h2>
            {caisse ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Statut</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">Ouverte</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fonds d'ouverture</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(caisse.fonds_roulement)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Date ouverture</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(caisse.date_ouverture).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-500">Fermée</span>
                <p className="text-xs text-gray-500 mt-2">Aucune caisse ouverte</p>
              </div>
            )}
          </div>

          {/* Aperçu inventaire */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Aperçu inventaire</h2>
            <div className="grid grid-cols-2 gap-4">
              {inventoryCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <div key={index} className="text-center">
                    <div className={`${card.bgColor} w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-2`}>
                      <Icon className={`w-8 h-8 text-white ${card.color.replace("bg-", "text-")}`} style={{ filter: "brightness(0.8)" }} />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.title}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Résumé inventaire */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Résumé inventaire</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total produits</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats?.totalProduits || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Stock faible</span>
                <span className="text-sm font-bold text-red-600">{stats?.stockFaible || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Valeur totale</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.valeurStock || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Ventes période</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(stats?.ventesPeriode || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal détails carte */}
      {cardDetailType && (
        <DashboardDetailModal
          type={cardDetailType}
          data={cardDetailLoading ? [] : cardDetailData}
          onClose={() => { setCardDetailType(null); setCardDetailData([]); }}
        />
      )}
      {cardDetailLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
