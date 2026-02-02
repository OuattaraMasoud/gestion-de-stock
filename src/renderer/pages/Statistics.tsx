import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Calendar,
  Package,
  BarChart3,
  Banknote,
} from "lucide-react";
import { Sale, DashboardStats } from "../types";
import { formatCurrency } from "../utils/formatters";

const Statistics: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const [statsData, salesResult] = await Promise.all([
        window.electronAPI.getDashboardStats(),
        window.electronAPI.getSalesPaginated(1, 10),
      ]);
      setStats(statsData);
      setRecentSales(salesResult.data);
    } catch (error) {
      console.error("Erreur chargement statistiques:", error);
    } finally {
      setLoading(false);
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Statistiques</h1>
        <p className="text-gray-600 mt-1">
          Analyse détaillée de vos ventes et performances
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Ventes du jour
              </p>
              <p className="text-l font-bold text-green-600">
                {formatCurrency(stats?.ventesJour || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
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
              <p className="text-sm font-medium text-gray-600 mb-1">
                Ventes du mois
              </p>
              <p className="text-l font-bold text-blue-600">
                {formatCurrency(stats?.ventesMois || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Mois en cours</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Panier moyen
              </p>
              <p className="text-l font-bold text-purple-600">
                {formatCurrency(averagePerSale)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Par transaction</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-full">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Valeur du stock
              </p>
              <p className="text-l font-bold text-yellow-600">
                {formatCurrency(stats?.valeurStock || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
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
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Performance du jour
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Nombre de ventes</span>
                <span className="text-2xl font-bold text-gray-900">
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

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
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

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Panier moyen</span>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Dernières ventes
          </h2>
          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune vente récente
              </p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center bg-gray-50 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Vente #{sale.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(sale.date_vente!).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(sale.total || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sale.methode_paiement}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alertes et recommandations */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
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
  );
};

export default Statistics;
