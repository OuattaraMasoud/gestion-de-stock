import React, { useEffect, useState } from "react";
import {
  User,
  Plus,
  Edit,
  Trash2,
  Phone,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Server } from "../types";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";

const Servers: React.FC = () => {
  const { user } = useAuthStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Server>({
    nom: "",
    telephone: "",
    actif: true,
  });

  useEffect(() => {
    loadServers();
  }, [currentPage, itemsPerPage]);

  const loadServers = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
  ) => {
    try {
      const result = await window.electronAPI.getServersPaginated(page, limit);
      setServers(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement serveurs:", error);
      showErrorToast("Erreur lors du chargement des serveurs");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (server?: Server) => {
    if (server) {
      setEditingServer(server);
      setFormData(server);
    } else {
      setEditingServer(null);
      setFormData({
        nom: "",
        telephone: "",
        actif: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingServer(null);
    setFormData({
      nom: "",
      telephone: "",
      actif: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nom.trim()) {
      showErrorToast("Le nom du serveur est requis");
      return;
    }

    try {
      const serverData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      if (editingServer) {
        await window.electronAPI.updateServer(editingServer.id!, serverData);
        showSuccessToast("Serveur modifié avec succès");
      } else {
        await window.electronAPI.createServer(serverData);
        showSuccessToast("Serveur créé avec succès");
      }
      handleCloseModal();
      loadServers();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast(
        editingServer
          ? "Erreur lors de la modification"
          : "Erreur lors de la création",
      );
    }
  };

  const handleDelete = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteId === null) return;
    setConfirmOpen(false);
    setPendingDeleteId(null);
    try {
      await window.electronAPI.deleteServer(pendingDeleteId, user?.id, user?.nom);
      showSuccessToast("Serveur supprimé avec succès");
      loadServers();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast("Erreur lors de la suppression");
    }
  };

  const toggleActive = async (server: Server) => {
    try {
      await window.electronAPI.updateServer(server.id!, {
        ...server,
        actif: !server.actif,
      });
      showSuccessToast(
        `Serveur ${!server.actif ? "activé" : "désactivé"} avec succès`,
      );
      loadServers();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast("Erreur lors de la modification");
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedServers = servers;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Serveurs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{totalItems} serveur(s)</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-5 h-5" />
          Nouveau Serveur
        </button>
      </div>

      {/* Liste des serveurs */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Serveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedServers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${server.actif ? "bg-blue-100 text-blue-600" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {server.nom}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {server.telephone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        {server.telephone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(server)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                        server.actif
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {server.actif ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Actif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Inactif
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(server)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(server.id!)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {servers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun serveur
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Commencez par ajouter votre premier serveur.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {servers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemsPerPageOptions={[10, 20, 50, 100]}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="text-2xl font-bold">
                {editingServer ? "Modifier le serveur" : "Nouveau serveur"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-white hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du serveur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData({ ...formData, nom: e.target.value })
                  }
                  className="input-field"
                  required
                  autoFocus
                />
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) =>
                    setFormData({ ...formData, telephone: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              {/* Actif */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.actif}
                  onChange={(e) =>
                    setFormData({ ...formData, actif: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="actif"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Serveur actif (peut être sélectionné à la caisse)
                </label>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingServer ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Êtes-vous sûr de vouloir supprimer ce serveur ?"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
};

export default Servers;
