import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  TrendingUp,
  Calendar,
  Package,
  BarChart3,
  Banknote,
  Users,
  Star,
  Search,
  X,
  Phone,
  Mail,
  ShoppingBag,
  CreditCard,
  Eye,
} from "lucide-react";
import { Sale, DashboardStats } from "../types";
import { formatCurrency } from "../utils/formatters";

interface TopProduct {
  product_id: number;
  nom: string;
  quantite_vendue: number;
  chiffre_affaires: number;
  marge: number;
}

interface TopClient {
  client_id: number;
  nom: string;
  telephone?: string;
  chiffre_affaires: number;
  nb_achats: number;
  solde_du: number;
}

type PeriodType = "today" | "thisWeek" | "thisMonth" | "lastMonth";

const periodLabels: Record<PeriodType, string> = {
  today: "Aujourd'hui",
  thisWeek: "Cette semaine",
  thisMonth: "Ce mois",
  lastMonth: "Mois dernier",
};

const getDateRange = (period: PeriodType): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  switch (period) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "thisWeek": {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return { start: formatDate(startOfWeek), end: formatDate(today) };
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
    default:
      return { start: formatDate(today), end: formatDate(today) };
  }
};

const Statistics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"stats" | "clients">("stats");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");

  // Clients tab state
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientStats, setClientStats] = useState<any>(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientStatsLoading, setClientStatsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client period filter
  const [clientPeriod, setClientPeriod] = useState<PeriodType | "custom">("thisMonth");
  const [clientCustomStart, setClientCustomStart] = useState("");
  const [clientCustomEnd, setClientCustomEnd] = useState("");

  // Sale detail modal
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod]);

  const loadStatistics = async () => {
    try {
      const { start, end } = getDateRange(selectedPeriod);
      const [statsData, salesResult, topProductsData, topClientsData] = await Promise.all([
        window.electronAPI.getDashboardStats(),
        window.electronAPI.getSalesPaginated(1, 10),
        window.electronAPI.getTopProducts(10, start, end),
        window.electronAPI.getTopClients(10, start, end),
      ]);
      setStats(statsData);
      setRecentSales(salesResult.data);
      setTopProducts(topProductsData);
      setTopClients(topClientsData);
    } catch (error) {
      console.error("Erreur chargement statistiques:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSearch = useCallback((query: string) => {
    setClientSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setClientSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setClientSearchLoading(true);
      try {
        const result = await window.electronAPI.getClientsPaginated(1, 10, query);
        setClientSearchResults(result.data);
      } catch (error) {
        console.error("Erreur recherche clients:", error);
      } finally {
        setClientSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectClient = (client: any) => {
    setSelectedClientId(client.id);
    setClientSearch(client.nom);
    setClientSearchResults([]);
  };

  const handleClearClient = () => {
    setSelectedClientId(null);
    setClientSearch("");
    setClientSearchResults([]);
    setClientStats(null);
  };

  const handleViewSaleDetail = async (saleId: number) => {
    setSaleDetailLoading(true);
    setShowSaleDetailModal(true);
    setSelectedSaleDetail(null);
    try {
      const data = await window.electronAPI.getVenteDetails(saleId);
      setSelectedSaleDetail(data);
    } catch (error) {
      console.error("Erreur chargement détails vente:", error);
    } finally {
      setSaleDetailLoading(false);
    }
  };

  // Load / reload client stats when client or period changes
  useEffect(() => {
    if (selectedClientId === null) return;
    if (clientPeriod === "custom" && (!clientCustomStart || !clientCustomEnd)) return;

    let startDate: string | undefined;
    let endDate: string | undefined;
    if (clientPeriod === "custom") {
      startDate = clientCustomStart;
      endDate = clientCustomEnd;
    } else {
      const { start, end } = getDateRange(clientPeriod as PeriodType);
      startDate = start;
      endDate = end;
    }

    setClientStatsLoading(true);
    window.electronAPI
      .getClientStats(selectedClientId, startDate, endDate)
      .then(setClientStats)
      .catch((e) => console.error("Erreur chargement stats client:", e))
      .finally(() => setClientStatsLoading(false));
  }, [selectedClientId, clientPeriod, clientCustomStart, clientCustomEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const averagePerSale =
    stats?.nbVentesJour && stats.nbVentesJour > 0
      ? Number(stats.ventesJour) / Number(stats.nbVentesJour)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistiques</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analyse détaillée de vos ventes et performances
          </p>
        </div>
        {/* Onglets */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "stats"
                ? "bg-white dark:bg-gray-800 shadow text-blue-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Ventes
            </span>
          </button>
          <button
            onClick={() => setActiveTab("clients")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "clients"
                ? "bg-white dark:bg-gray-800 shadow text-blue-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Clients
            </span>
          </button>
        </div>
      </div>

      {activeTab === "clients" ? (
        /* ===== Onglet Clients ===== */
        <div className="space-y-6">
          {/* Barre de recherche */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Statistiques par client
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => handleClientSearch(e.target.value)}
                placeholder="Rechercher un client (nom, téléphone)..."
                className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
              {clientSearch && (
                <button
                  onClick={handleClearClient}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtre par période */}
            {selectedClientId !== null && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">Période :</span>
                <select
                  value={clientPeriod}
                  onChange={(e) => setClientPeriod(e.target.value as PeriodType | "custom")}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                >
                  {Object.entries(periodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  <option value="custom">Personnalisé</option>
                </select>
                {clientPeriod === "custom" && (
                  <>
                    <input
                      type="date"
                      value={clientCustomStart}
                      onChange={(e) => setClientCustomStart(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                    />
                    <span className="text-gray-400 text-sm">→</span>
                    <input
                      type="date"
                      value={clientCustomEnd}
                      onChange={(e) => setClientCustomEnd(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                    />
                  </>
                )}
              </div>
            )}

            {/* Résultats de recherche */}
            {clientSearchLoading && (
              <div className="mt-3 text-center text-gray-500 text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
            {clientSearchResults.length > 0 && (
              <div className="mt-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {clientSearchResults.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {client.nom?.charAt(0) || "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{client.nom}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {client.telephone || client.email || "Pas de contact"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dashboard client */}
          {clientStatsLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {clientStats && !clientStatsLoading && (
            <div className="space-y-6">
              {/* Carte info client */}
              <div className="card border-l-4 border-blue-500">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                    {clientStats.client?.nom?.charAt(0) || "C"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {clientStats.client?.nom}
                    </h3>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {clientStats.client?.telephone && (
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-3.5 h-3.5" />
                          {clientStats.client.telephone}
                        </span>
                      )}
                      {clientStats.client?.email && (
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-3.5 h-3.5" />
                          {clientStats.client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nb ventes</p>
                  <p className="text-2xl font-bold text-blue-600">{clientStats.nb_ventes ?? 0}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total achats</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(clientStats.total_achats ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Montant payé</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(clientStats.total_paye ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total dettes</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(clientStats.total_dettes ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Reste à payer</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(clientStats.reste_a_payer ?? 0)}</p>
                </div>
              </div>

              {/* Tableau ventes récentes */}
              {clientStats.recentSales && clientStats.recentSales.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    Ventes récentes (10 dernières)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium text-right">Montant</th>
                          <th className="py-2 pr-4 font-medium text-center">Statut</th>
                          <th className="py-2 pr-4 font-medium text-center">Articles</th>
                          <th className="py-2 pr-4 font-medium text-center">Livré</th>
                          <th className="py-2 font-medium text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {clientStats.recentSales.map((sale: any) => (
                          <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                              {new Date(sale.date_vente).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(sale.total ?? 0)}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                sale.statut_paiement === "paye"
                                  ? "bg-green-100 text-green-700"
                                  : sale.statut_paiement === "partiel"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-red-100 text-red-700"
                              }`}>
                                <CreditCard className="w-3 h-3" />
                                {sale.statut_paiement === "paye"
                                  ? "Payé"
                                  : sale.statut_paiement === "partiel"
                                    ? "Partiel"
                                    : "Impayé"}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-center text-gray-600 dark:text-gray-400">
                              {sale.nb_articles ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              <span className={`text-xs font-medium ${
                                sale.livre ? "text-green-600" : "text-gray-400"
                              }`}>
                                {sale.livre ? "✓" : "—"}
                              </span>
                            </td>
                            <td className="py-2.5 text-center">
                              <button
                                onClick={() => handleViewSaleDetail(sale.id)}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                                title="Voir le détail"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!clientStats && !clientStatsLoading && !clientSearch && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-8 mb-4">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Recherchez un client pour voir ses statistiques
              </p>
            </div>
          )}
        </div>
      ) : (
      /* ===== Onglet Stats (contenu existant) ===== */
      <div className="space-y-8">

      {/* Stats principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Ventes du jour
              </p>
              <p className="text-l font-bold text-green-600">
                {formatCurrency(stats?.ventesJour || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats?.nbVentesJour} transaction(s)
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-full">
              <Banknote className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Ventes du mois
              </p>
              <p className="text-l font-bold text-blue-600">
                {formatCurrency(stats?.ventesMois || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mois en cours</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Panier moyen
              </p>
              <p className="text-l font-bold text-purple-600">
                {formatCurrency(averagePerSale)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Par transaction</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-full">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Valeur du stock
              </p>
              <p className="text-l font-bold text-yellow-600">
                {formatCurrency(stats?.valeurStock || 0)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats?.totalProduits} produits
              </p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-full">
              <Package className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques et analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance du jour */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Performance du jour
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Nombre de ventes</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.nbVentesJour}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      ((stats?.nbVentesJour || 0) / 50) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Chiffre d'affaires
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.ventesJour || 0)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(
                      ((stats?.ventesJour || 0) / 1000) * 100,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Panier moyen</span>
                <span className="text-2xl font-bold text-purple-600">
                  {formatCurrency(averagePerSale)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min((averagePerSale / 100) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Dernières ventes */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Dernières ventes
          </h2>
          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Aucune vente récente
              </p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Vente #{sale.id}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(sale.date_vente!).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(sale.total || 0)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sale.methode_paiement}
                      </p>
                    </div>
                    <button
                      onClick={() => handleViewSaleDetail(sale.id!)}
                      className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors shrink-0"
                      title="Voir le détail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500" />
          Top Performances
        </h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as PeriodType)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(periodLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Top 10 Produits
          </h3>
          <div className="space-y-2">
            {topProducts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Aucune donnée pour cette période
              </p>
            ) : (
              topProducts.map((product, index) => (
                <div
                  key={product.product_id}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? "bg-yellow-100 text-yellow-700" :
                    index === 1 ? "bg-gray-200 text-gray-700" :
                    index === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.nom}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.quantite_vendue} vendus • Marge: {formatCurrency(product.marge)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">
                      {formatCurrency(product.chiffre_affaires)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            Top 10 Clients
          </h3>
          <div className="space-y-2">
            {topClients.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Aucune donnée pour cette période
              </p>
            ) : (
              topClients.map((client, index) => (
                <div
                  key={client.client_id}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? "bg-yellow-100 text-yellow-700" :
                    index === 1 ? "bg-gray-200 text-gray-700" :
                    index === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {client.nom}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {client.nb_achats} achat(s) • {client.telephone || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      {formatCurrency(client.chiffre_affaires)}
                    </p>
                    {client.solde_du > 0 && (
                      <p className="text-xs text-red-500">
                        Dette: {formatCurrency(client.solde_du)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alertes et recommandations */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Alertes et Recommandations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.stockFaible && stats.stockFaible > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-1">
                Stock faible
              </p>
              <p className="text-2xl font-bold text-red-600">
                {stats.stockFaible}
              </p>
              <p className="text-xs text-red-700 mt-1">
                Produits à réapprovisionner
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 mb-1">
                Stock OK
              </p>
              <p className="text-2xl font-bold text-green-600">✓</p>
              <p className="text-xs text-green-700 mt-1">
                Tous les stocks sont suffisants
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">
              Total produits
            </p>
            <p className="text-2xl font-bold text-blue-600">
              {stats?.totalProduits}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Références en catalogue
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-800 mb-1">
              Investissement stock
            </p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats?.valeurStock || 0)}
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Valeur totale du stock
            </p>
          </div>
        </div>
      </div>
      </div>
      )}

      {/* Modal détail d'une vente */}
      {showSaleDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                {selectedSaleDetail ? `Vente #${selectedSaleDetail.id}` : "Détail de la vente"}
              </h2>
              <button
                onClick={() => { setShowSaleDetailModal(false); setSelectedSaleDetail(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saleDetailLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedSaleDetail ? (
              <>
                <div className="flex justify-between text-sm mb-4 text-gray-600 dark:text-gray-400">
                  <span>
                    {new Date(selectedSaleDetail.date_vente).toLocaleString("fr-FR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold">{selectedSaleDetail.methode_paiement}</span>
                </div>
                <div className="overflow-y-auto max-h-64 border border-gray-100 dark:border-gray-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-3 text-left font-medium">Produit</th>
                        <th className="py-2 px-3 text-center font-medium w-12">Qté</th>
                        <th className="py-2 px-3 text-right font-medium">Prix U.</th>
                        <th className="py-2 px-3 text-right font-medium">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {selectedSaleDetail.items?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.nom_produit}</td>
                          <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{item.quantite}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrency(item.prix_unitaire)}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(item.sous_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(selectedSaleDetail.total ?? 0)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
