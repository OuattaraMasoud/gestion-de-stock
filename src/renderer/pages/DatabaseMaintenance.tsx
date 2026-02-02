import React, { useEffect, useState } from "react";
import {
  Database,
  HardDrive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";

interface DatabaseStats {
  totalSize: number;
  tables: { name: string; count: number }[];
  oldestData: {
    auditLog?: string;
    sale?: string;
  };
}

const DatabaseMaintenance: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  const [auditLogsRetention, setAuditLogsRetention] = useState(90);
  const [salesRetention, setSalesRetention] = useState(365);
  const [purchasesRetention, setPurchasesRetention] = useState(365);
  const [repairing, setRepairing] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getDatabaseStats();
      setStats(data);
    } catch (error) {
      console.error("Erreur chargement stats:", error);
      showErrorToast("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handlePurge = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir purger les anciennes données ? Cette action est irréversible."
      )
    ) {
      return;
    }

    setPurging(true);
    try {
      const result = await window.electronAPI.purgeOldData({
        auditLogsRetentionDays: auditLogsRetention,
        salesRetentionDays: salesRetention,
        purchasesRetentionDays: purchasesRetention,
        enabled: true,
      });

      if (result.success) {
        showSuccessToast(result.message);
        loadStats();
      } else {
        showErrorToast(result.message);
      }
    } catch (error) {
      console.error("Erreur purge:", error);
      showErrorToast("Erreur lors de la purge");
    } finally {
      setPurging(false);
    }
  };

  const handleRepairDatabase = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir réparer la base de données ?\n\n" +
        "Cette opération va :\n" +
        "1. Supprimer les tables FTS5 corrompues\n" +
        "2. Recréer les tables FTS5\n" +
        "3. Nettoyer la base de données\n\n" +
        "Une sauvegarde sera automatiquement créée avant la réparation."
      )
    ) {
      return;
    }

    setRepairing(true);
    try {
      const result = await window.electronAPI.repairDatabase();

      if (result.success) {
        showSuccessToast(result.message);
        if (result.backupPath) {
          alert(`Base de données réparée avec succès !\n\nSauvegarde créée : ${result.backupPath}`);
        }
        loadStats();
      } else {
        showErrorToast(result.message);
        if (result.backupPath) {
          alert(`Erreur lors de la réparation.\n\nUne sauvegarde a été créée : ${result.backupPath}\n\nContactez le support technique.`);
        }
      }
    } catch (error) {
      console.error("Erreur réparation:", error);
      showErrorToast("Erreur lors de la réparation de la base de données");
    } finally {
      setRepairing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("fr-FR");
  };

  const getTableCount = (tableName: string) => {
    return stats?.tables.find((t) => t.name === tableName)?.count || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Maintenance de la Base de Données
            </h1>
            <p className="text-gray-600 mt-1">
              Gérez et optimisez votre base de données pour de meilleures performances
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Taille totale</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatBytes(stats?.totalSize || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="card shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-3 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Nombre de tables</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.tables.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="card shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Audit logs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getTableCount("audit_logs").toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card shadow-lg">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-orange-600 to-red-600 p-3 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ventes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getTableCount("ventes").toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Réparation de la base de données */}
        {(user?.role === "admin" || user?.role === "gestionnaire") && (
          <div className="card shadow-lg">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
              <div className="bg-red-600 p-3 rounded-xl shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Réparation de la Base de Données</h2>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium mb-1">
                      Quand utiliser la réparation ?
                    </p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                      <li>Erreur "database disk image is malformed"</li>
                      <li>Erreur "SQLITE_CORRUPT_VTAB"</li>
                      <li>Problèmes de recherche FTS</li>
                      <li>Application qui ne répond plus</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium mb-1">
                      Ce que fait la réparation :
                    </p>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>Supprime les tables FTS5 corrompues</li>
                      <li>Recrée les tables FTS5</li>
                      <li>Nettoie la base de données (VACUUM)</li>
                      <li>Crée automatiquement une sauvegarde</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRepairDatabase}
                disabled={repairing}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 w-full justify-center"
              >
                {repairing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Réparation en cours...
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    Réparer la Base de Données
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Détails par table */}
        <div className="card shadow-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Détails par Table
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom de la table
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre d'entrées
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats?.tables.map((table) => (
                  <tr key={table.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {table.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {table.count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {table.count > 100000 ? (
                        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          Gros volume
                        </span>
                      ) : table.count > 10000 ? (
                        <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full text-xs font-medium">
                          <Settings className="w-4 h-4" />
                          Volume moyen
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Données les plus anciennes */}
        <div className="card shadow-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
            <div className="bg-orange-600 p-3 rounded-xl shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Données les Plus Anciennes
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Dernier audit log
                </p>
                <p className="text-xs text-gray-600">
                  {formatDate(stats?.oldestData.auditLog || "")}
                </p>
              </div>
              {stats?.oldestData.auditLog && (
                <div className="text-xs text-orange-600 font-medium">
                  {(() => {
                    const daysAgo = Math.floor(
                      (Date.now() - new Date(stats.oldestData.auditLog).getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return `${daysAgo} jours`;
                  })()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Dernière vente</p>
                <p className="text-xs text-gray-600">
                  {formatDate(stats?.oldestData.sale || "")}
                </p>
              </div>
              {stats?.oldestData.sale && (
                <div className="text-xs text-orange-600 font-medium">
                  {(() => {
                    const daysAgo = Math.floor(
                      (Date.now() - new Date(stats.oldestData.sale).getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return `${daysAgo} jours`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configuration de la purge */}
        {(user?.role === "admin" || user?.role === "gestionnaire") && (
          <div className="card shadow-lg">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
              <div className="bg-red-600 p-3 rounded-xl shadow-lg">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Purge Automatique</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rétention des logs d'audit (jours)
                </label>
                <input
                  type="number"
                  value={auditLogsRetention}
                  onChange={(e) => setAuditLogsRetention(Number(e.target.value))}
                  min="7"
                  max="365"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les logs d'audit plus anciens seront supprimés
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rétention des ventes archivées (jours)
                </label>
                <input
                  type="number"
                  value={salesRetention}
                  onChange={(e) => setSalesRetention(Number(e.target.value))}
                  min="30"
                  max="1825"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les ventes archivées plus anciennes seront supprimées
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rétention des achats (jours)
                </label>
                <input
                  type="number"
                  value={purchasesRetention}
                  onChange={(e) => setPurchasesRetention(Number(e.target.value))}
                  min="30"
                  max="1825"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Les achats plus anciens seront supprimés
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handlePurge}
                  disabled={purging}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {purging ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Purge en cours...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Purger les anciennes données
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default DatabaseMaintenance;
