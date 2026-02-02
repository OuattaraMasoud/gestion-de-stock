import React, { useEffect, useState } from "react";
import {
  Shield,
  Search,
  User,
  Database,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { AuditLog } from "../types";
import Pagination from "../components/Pagination";
import ProtectedRoute from "../components/ProtectedRoute";

const Audit: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const loadAuditLogs = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
    filtersOverride?: any,
  ) => {
    try {
      const filters: any = filtersOverride || {};
      if (!filtersOverride && startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      if (!filtersOverride && selectedTable) {
        filters.table = selectedTable;
      }
      if (!filtersOverride && searchQuery.trim()) {
        filters.search = searchQuery;
      }

      const result = await window.electronAPI.getAuditLogsPaginated(
        page,
        limit,
        Object.keys(filters).length > 0 ? filters : undefined,
      );
      setAuditLogs(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement logs d'audit:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    loadAuditLogs();
  }, [startDate, endDate, selectedTable, searchQuery]);

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setSelectedTable("");
    loadAuditLogs();
  };

  // Pas de filtre côté client car la recherche est faite côté serveur
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLogs = auditLogs;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getActionIcon = (action: string) => {
    if (action.includes("créer") || action.includes("create")) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (
      action.includes("modifier") ||
      action.includes("update") ||
      action.includes("edit")
    ) {
      return <RefreshCw className="w-5 h-5 text-blue-600" />;
    }
    if (action.includes("supprimer") || action.includes("delete")) {
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
    return <Info className="w-5 h-5 text-gray-600" />;
  };

  const getActionBadge = (action: string) => {
    if (action.includes("créer") || action.includes("create")) {
      return "bg-green-100 text-green-700 border-green-200";
    }
    if (
      action.includes("modifier") ||
      action.includes("update") ||
      action.includes("edit")
    ) {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    if (action.includes("supprimer") || action.includes("delete")) {
      return "bg-red-100 text-red-700 border-red-200";
    }
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const tables = [
    "produits",
    "categories",
    "ventes",
    "achats",
    "clients",
    "fournisseurs",
    "serveurs",
    "utilisateurs",
    "factures",
    "paiements",
  ];

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
              Journal d'Audit
            </h1>
            <p className="mt-2 text-gray-600">
              {auditLogs.length} action(s) enregistrée(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadAuditLogs()}
              className="btn-primary flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="card">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="flex-1 min-w-37.5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="input-field"
              >
                <option value="">Toutes les tables</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-37.5">
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
            <div className="flex-1 min-w-[150px]">
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
            <button
              onClick={handleResetFilters}
              disabled={
                !searchQuery && !selectedTable && !startDate && !endDate
              }
              className="btn-secondary"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Liste des logs */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID Enregistrement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Détails
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(log.created_at || "").toLocaleString("fr-FR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {log.utilisateur_nom}
                          </p>
                          <p className="text-xs text-gray-500">
                            {log.utilisateur_email} • {log.utilisateur_role}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold border ${getActionBadge(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 font-medium">
                          {log.table_cible || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {log.enregistrement_id || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {log.details || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Voir détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {auditLogs.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucun log d'audit
                </h3>
                <p className="text-gray-600">
                  Les actions effectuées sur la plateforme apparaîtront ici.
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {auditLogs.length > 0 && (
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

        {/* Modal détails du log */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
              <div className="bg-blue-600 f text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Détails de l'action</h2>
                  <p className="text-blue-100 mt-1">
                    {new Date(selectedLog.created_at || "").toLocaleString(
                      "fr-FR",
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  {getActionIcon(selectedLog.action)}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${getActionBadge(selectedLog.action)}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Utilisateur
                    </p>
                    <p className="font-semibold text-gray-900">
                      {selectedLog.utilisateur_nom}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedLog.utilisateur_email}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedLog.utilisateur_role}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Table cible
                    </p>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">
                        {selectedLog.table_cible || "-"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      ID: {selectedLog.enregistrement_id || "-"}
                    </p>
                  </div>
                </div>

                {selectedLog.adresse_ip && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      Adresse IP
                    </p>
                    <p className="font-mono text-sm text-gray-900">
                      {selectedLog.adresse_ip}
                    </p>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                      User Agent
                    </p>
                    <p className="text-sm text-gray-600 break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Détails complets
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap font-mono bg-white p-4 rounded border">
                    {selectedLog.details || "Aucun détail disponible"}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="btn-primary w-full"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default Audit;
