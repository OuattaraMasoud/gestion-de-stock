import React, { useEffect, useState } from "react";
import {
  Database,
  RefreshCw,
  Trash2,
  Clock,
  HardDrive,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import type { Backup } from "../types";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";
import ConfirmDialog from "../components/ConfirmDialog";

const Backup: React.FC = () => {
  const { user } = useAuthStore();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteFilename, setPendingDeleteFilename] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<Backup | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }
    loadBackups();
  }, [user]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getBackups();
      setBackups(data);
    } catch (error) {
      console.error("Erreur chargement backups:", error);
      showErrorToast("Erreur lors du chargement des sauvegardes");
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await window.electronAPI.backupDatabase();
      showSuccessToast("Sauvegarde créée avec succès");
      loadBackups();
    } catch (error) {
      console.error("Erreur backup:", error);
      showErrorToast("Erreur lors de la création de la sauvegarde");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = (backup: Backup) => {
    setPendingRestoreBackup(backup);
    setRestoreConfirmOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreBackup) return;
    const backup = pendingRestoreBackup;
    const isDev = import.meta.env.DEV;
    setRestoreConfirmOpen(false);
    setPendingRestoreBackup(null);
    setRestoring(true);
    try {
      await window.electronAPI.restoreDatabase(backup.path);
      showSuccessToast("Base de données restaurée avec succès");

      setTimeout(async () => {
        if (isDev) {
          alert(
            "Restauration terminée. Veuillez relancer 'npm run dev' manuellement.",
          );
          window.close();
        } else {
          await window.electronAPI.relaunchApp();
        }
      }, 1000);
    } catch (error) {
      console.error("Erreur restauration:", error);
      showErrorToast("Erreur lors de la restauration");
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = (filename: string) => {
    setPendingDeleteFilename(filename);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteFilename) return;
    setConfirmOpen(false);
    setPendingDeleteFilename(null);
    try {
      await window.electronAPI.deleteBackup(pendingDeleteFilename);
      showSuccessToast("Sauvegarde supprimée avec succès");
      loadBackups();
    } catch (error) {
      console.error("Erreur suppression backup:", error);
      showErrorToast("Erreur lors de la suppression");
    }
  };

  if (user?.role !== "admin") {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Accès refusé
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Cette fonctionnalité est réservée aux administrateurs
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Sauvegardes
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Gérer les sauvegardes et restaurations de la base de données
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {backingUp ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Créer une sauvegarde
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Database className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                À propos des sauvegardes
              </h3>
              <p className="text-sm text-blue-800">
                Les sauvegardes sont stockées localement sur votre ordinateur.
                Vous pouvez créer des sauvegardes avant des modifications
                importantes et les restaurer si nécessaire.
                {import.meta.env.DEV && (
                  <span className="font-semibold">
                    {" "}
                    ⚠️ En développement, vous devrez relancer "npm run dev"
                    après une restauration.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Liste des sauvegardes */}
        <div className="card shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Sauvegardes disponibles
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {backups.length} sauvegarde(s)
                </p>
              </div>
            </div>
            <button
              onClick={loadBackups}
              disabled={loading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Actualiser la liste"
            >
              <RefreshCw
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucune sauvegarde
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Créez votre première sauvegarde pour sécuriser vos données
              </p>
              <button onClick={handleBackup} className="btn-primary">
                <Database className="w-5 h-5 mr-2" />
                Créer une sauvegarde
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="bg-linear-to-br bg-gray-50  dark:bg-gray-600 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Database className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {backup.filename}
                          </h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {backup.formattedDate}
                          </div>
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-4 h-4" />
                            {backup.formattedSize}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={restoring}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                        title="Restaurer"
                      >
                        <Upload className="w-4 h-4" />
                        Restaurer
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm font-medium transition-all flex items-center gap-1"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert restauration */}
        {restoring && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  Restauration en cours
                </h3>
                <p className="text-sm text-yellow-800">
                  {import.meta.env.DEV
                    ? "L'application va se fermer. Vous devrez relancer 'npm run dev' manuellement."
                    : "L'application va redémarrer automatiquement."}
                </p>
              </div>
            </div>
          </div>
        )}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Êtes-vous sûr de vouloir supprimer cette sauvegarde ?"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteFilename(null); }}
      />
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        message={`Restaurer la base de données depuis la sauvegarde du ${pendingRestoreBackup?.formattedDate ?? ""} ? L'application sera redémarrée.`}
        onConfirm={handleConfirmRestore}
        onCancel={() => { setRestoreConfirmOpen(false); setPendingRestoreBackup(null); }}
      />
      </div>
    </ProtectedRoute>
  );
};

export default Backup;
