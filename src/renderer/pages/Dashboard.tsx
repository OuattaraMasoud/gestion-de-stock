import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { DashboardStatsByDate, Product } from "../types";
import { formatCurrency } from "../utils/formatters";

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

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatsByDate | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showCustomDates, setShowCustomDates] = useState(false);

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

      // Charger les 5 produits les plus récents avec pagination
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
      // Initialiser avec aujourd'hui si pas de dates
      if (!customStartDate) {
        const today = new Date().toISOString().split("T")[0];
        setCustomStartDate(today);
        setCustomEndDate(today);
      }
    } else {
      setShowCustomDates(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculer les pourcentages de variation
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const salesOverview = [
    {
      title: "CHIFFRE D'AFFAIRES",
      value: formatCurrency(stats?.ventesPeriode || 0),
      change: calculateChange(stats?.ventesPeriode || 0, stats?.ventesPeriodePrecedente || 0),
      isPositive: (stats?.ventesPeriode || 0) >= (stats?.ventesPeriodePrecedente || 0),
      subtitle: (stats?.ventesPeriode || 0) >= (stats?.ventesPeriodePrecedente || 0) ? "vs période préc." : "vs période préc.",
    },
    {
      title: "BÉNÉFICE TOTAL",
      value: formatCurrency(stats?.profitPeriode || 0),
      change: calculateChange(stats?.profitPeriode || 0, stats?.profitPeriodePrecedente || 0),
      isPositive: (stats?.profitPeriode || 0) >= (stats?.profitPeriodePrecedente || 0),
      subtitle: (stats?.profitPeriode || 0) >= (stats?.profitPeriodePrecedente || 0) ? "vs période préc." : "vs période préc.",
    },
    {
      title: "NOMBRE DE VENTES",
      value: stats?.nbVentesPeriode || 0,
      change: calculateChange(stats?.ventesPeriode || 0, stats?.ventesPeriodePrecedente || 0),
      isPositive: (stats?.ventesPeriode || 0) >= (stats?.ventesPeriodePrecedente || 0),
      subtitle: "transactions",
    },
    {
      title: "COÛTS",
      value: formatCurrency(stats?.coutsPeriode || 0),
      change: calculateChange(stats?.coutsPeriode || 0, stats?.coutsPeriodePrecedente || 0),
      isPositive: (stats?.coutsPeriode || 0) <= (stats?.coutsPeriodePrecedente || 0),
      subtitle: (stats?.coutsPeriode || 0) <= (stats?.coutsPeriodePrecedente || 0) ? "vs période préc." : "vs période préc.",
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

  // Calculer les pourcentages pour le graphique
  const total = (stats?.ventesPeriode || 0) + (stats?.profitPeriode || 0) + (stats?.coutsPeriode || 0) + (stats?.valeurStock || 0);
  const chartData = total > 0 ? [
    { label: "Ventes", value: ((stats?.ventesPeriode || 0) / total * 100).toFixed(0), color: "bg-blue-500" },
    { label: "Bénéfice", value: ((stats?.profitPeriode || 0) / total * 100).toFixed(0), color: "bg-green-500" },
    { label: "Dépenses", value: ((stats?.valeurStock || 0) / total * 100).toFixed(0), color: "bg-purple-500" },
    { label: "Coûts", value: ((stats?.coutsPeriode || 0) / total * 100).toFixed(0), color: "bg-orange-500" },
  ] : [
    { label: "Ventes", value: "0", color: "bg-blue-500" },
    { label: "Bénéfice", value: "0", color: "bg-green-500" },
    { label: "Dépenses", value: "0", color: "bg-purple-500" },
    { label: "Coûts", value: "0", color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-600 mt-1">
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

      {/* Sales Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {salesOverview.map((item, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">{item.title}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">{item.value}</h3>
                <div className="flex items-center gap-1 mt-2">
                  {item.isPositive ? (
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${item.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {item.change}
                  </span>
                  <span className="text-xs text-gray-500">{item.subtitle}</span>
                </div>
              </div>
              {item.isPositive ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Products */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Produits récents</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{product.nom}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{product.quantite_stock}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {formatCurrency((product.prix_vente - product.prix_achat) * product.quantite_stock)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{formatCurrency(product.prix_vente)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Quantity Stock */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-gray-900">Stock faible</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{product.nom}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-red-600">{product.quantite_stock}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{formatCurrency(product.prix_vente)}</span>
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

        {/* Right Column */}
        <div className="space-y-6">
          {/* Inventory Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Aperçu inventaire</h2>
            <div className="grid grid-cols-2 gap-4">
              {inventoryCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <div key={index} className="text-center">
                    <div className={`${card.bgColor} w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-2`}>
                      <Icon className={`w-8 h-8 text-white ${card.color.replace('bg-', 'text-')}`} style={{filter: 'brightness(0.8)'}} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{card.title}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Résumé inventaire</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total produits</span>
                <span className="text-sm font-bold text-gray-900">{stats?.totalProduits || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Stock faible</span>
                <span className="text-sm font-bold text-red-600">{stats?.stockFaible || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Valeur totale</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(stats?.valeurStock || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ventes période</span>
                <span className="text-sm font-bold text-green-600">{formatCurrency(stats?.ventesPeriode || 0)}</span>
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Graphique revenus</h2>
            <div className="flex items-center justify-center py-4">
              <svg className="w-40 h-40" viewBox="0 0 200 200">
                {/* Graphique en camembert simple */}
                <circle cx="100" cy="100" r="80" fill="#FFA500" stroke="white" strokeWidth="2" />
                <path d="M 100 100 L 100 20 A 80 80 0 0 1 180 100 Z" fill="#3B82F6" stroke="white" strokeWidth="2" />
                <path d="M 100 100 L 180 100 A 80 80 0 0 1 140 173.2 Z" fill="#10B981" stroke="white" strokeWidth="2" />
                <path d="M 100 100 L 140 173.2 A 80 80 0 0 1 60 173.2 Z" fill="#8B5CF6" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <div className="space-y-2 mt-4">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
