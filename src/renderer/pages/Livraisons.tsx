import React, { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Eye,
} from "lucide-react";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { showErrorToast, showSuccessToast } from "../utils/toast";

interface Livraison {
  id: number;
  vente_id: number;
  client_id?: number;
  client_nom?: string;
  client_nom_full?: string;
  adresse_livraison?: string;
  date_prevue?: string;
  date_livraison?: string;
  statut: "en_attente" | "en_cours" | "livree" | "annulee";
  notes?: string;
  livreur?: string;
  vente_total?: number;
  created_at?: string;
}

const Livraisons: React.FC = () => {
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLivraison, setSelectedLivraison] = useState<Livraison | null>(
    null,
  );
  const [ventes, setVentes] = useState<any[]>([]);
  const [venteSearch, setVenteSearch] = useState("");
  const [formData, setFormData] = useState({
    vente_id: "",
    adresse_livraison: "",
    date_prevue: "",
    livreur: "",
    notes: "",
  });

  const loadLivraisons = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getLivraisons(
        currentPage,
        itemsPerPage,
        statutFilter || undefined,
      );
      setLivraisons(result.data);
      setTotalItems(result.total);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des livraisons");
    } finally {
      setLoading(false);
    }
  };

  const loadVentes = async () => {
    try {
      const result = await window.electronAPI.getSales();
      setVentes(result);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
    }
  };

  const filteredVentes = ventes.filter((v) => {
    if (!venteSearch) return true;
    const search = venteSearch.toLowerCase();
    return (
      String(v.id).includes(search) ||
      (v.client_nom && v.client_nom.toLowerCase().includes(search))
    );
  });

  useEffect(() => {
    loadLivraisons();
  }, [currentPage, itemsPerPage, statutFilter]);

  useEffect(() => {
    if (showCreateModal) {
      loadVentes();
    }
  }, [showCreateModal]);

  const handleCreate = async () => {
    if (!formData.vente_id) {
      showErrorToast("Veuillez sélectionner une vente");
      return;
    }

    try {
      const vente = ventes.find((v) => v.id === parseInt(formData.vente_id));
      await window.electronAPI.createLivraison({
        vente_id: parseInt(formData.vente_id),
        client_id: vente?.client_id,
        client_nom: vente?.client_nom,
        adresse_livraison: formData.adresse_livraison,
        date_prevue: formData.date_prevue || null,
        livreur: formData.livreur,
        notes: formData.notes,
      });
      showSuccessToast("Livraison créée avec succès");
      setShowCreateModal(false);
      setVenteSearch("");
      setFormData({
        vente_id: "",
        adresse_livraison: "",
        date_prevue: "",
        livreur: "",
        notes: "",
      });
      loadLivraisons();
    } catch (error) {
      showErrorToast("Erreur lors de la création de la livraison");
    }
  };

  const handleUpdateStatut = async (id: number, statut: string) => {
    try {
      const livraison = livraisons.find((l) => l.id === id);
      await window.electronAPI.updateLivraison(id, {
        ...livraison,
        statut,
      });
      showSuccessToast("Statut mis à jour");
      loadLivraisons();
    } catch (error) {
      showErrorToast("Erreur lors de la mise à jour");
    }
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "en_attente":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
      case "en_cours":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
            <Truck className="w-3 h-3" /> En cours
          </span>
        );
      case "livree":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Livrée
          </span>
        );
      case "annulee":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Annulée
          </span>
        );
      default:
        return statut;
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Livraisons
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalItems} livraison(s)
          </p>
        </div>
        {/* <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle livraison
        </button> */}
      </div>

      <div className="card">
        <div className="flex gap-4 items-end flex-wrap mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtrer par statut
            </label>
            <select
              value={statutFilter}
              onChange={(e) => {
                setStatutFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="livree">Livrée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : livraisons.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune livraison
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Créez une nouvelle livraison pour commencer
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Vente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Adresse
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date prévue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Livreur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {livraisons.map((livraison) => (
                  <tr
                    key={livraison.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      #{livraison.id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">
                          Vente #{livraison.vente_id}
                        </span>
                        {livraison.vente_total && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(livraison.vente_total)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.client_nom_full || livraison.client_nom || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="truncate">
                          {livraison.adresse_livraison || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.date_prevue ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(livraison.date_prevue).toLocaleDateString(
                            "fr-FR",
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.livreur ? (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-gray-400" />
                          {livraison.livreur}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatutBadge(livraison.statut)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedLivraison(livraison);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {livraison.statut === "en_attente" && (
                          <button
                            onClick={() =>
                              handleUpdateStatut(livraison.id, "en_cours")
                            }
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Démarrer
                          </button>
                        )}
                        {livraison.statut === "en_cours" && (
                          <button
                            onClick={() =>
                              handleUpdateStatut(livraison.id, "livree")
                            }
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Livrer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            itemsPerPageOptions={[10, 20, 50]}
            onItemsPerPageChange={(n) => {
              setItemsPerPage(n);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Nouvelle livraison</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Vente *
                </label>
                <input
                  type="text"
                  value={venteSearch}
                  onChange={(e) => setVenteSearch(e.target.value)}
                  className="input-field mb-1"
                  placeholder="Rechercher par n° ou client..."
                />
                <select
                  value={formData.vente_id}
                  onChange={(e) => {
                    const vente = ventes.find(
                      (v) => v.id === parseInt(e.target.value),
                    );
                    setFormData({
                      ...formData,
                      vente_id: e.target.value,
                      adresse_livraison:
                        vente?.client_adresse || formData.adresse_livraison,
                    });
                  }}
                  className="input-field"
                  size={5}
                >
                  <option value="">-- Sélectionner une vente --</option>
                  {filteredVentes.map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.id} — {v.client_nom || "Comptoir"} —{" "}
                      {formatCurrency(v.total)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Adresse de livraison
                </label>
                <textarea
                  value={formData.adresse_livraison}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adresse_livraison: e.target.value,
                    })
                  }
                  className="input-field"
                  rows={2}
                  placeholder="Adresse complète..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date prévue
                  </label>
                  <input
                    type="date"
                    value={formData.date_prevue}
                    onChange={(e) =>
                      setFormData({ ...formData, date_prevue: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Livreur
                  </label>
                  <input
                    type="text"
                    value={formData.livreur}
                    onChange={(e) =>
                      setFormData({ ...formData, livreur: e.target.value })
                    }
                    className="input-field"
                    placeholder="Nom du livreur"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="input-field"
                  rows={2}
                  placeholder="Instructions particulières..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setVenteSearch("");
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button onClick={handleCreate} className="btn-primary flex-1">
                Créer la livraison
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedLivraison && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Détails livraison #{selectedLivraison.id}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLivraison(null);
                }}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Vente</span>
                <span className="font-medium">
                  #{selectedLivraison.vente_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">
                  {selectedLivraison.client_nom_full ||
                    selectedLivraison.client_nom ||
                    "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(selectedLivraison.vente_total || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Adresse</span>
                <span className="font-medium text-right max-w-[60%]">
                  {selectedLivraison.adresse_livraison || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Date prévue</span>
                <span className="font-medium">
                  {selectedLivraison.date_prevue
                    ? new Date(
                        selectedLivraison.date_prevue,
                      ).toLocaleDateString("fr-FR")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Livreur</span>
                <span className="font-medium">
                  {selectedLivraison.livreur || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Statut</span>
                {getStatutBadge(selectedLivraison.statut)}
              </div>
              {selectedLivraison.notes && (
                <div>
                  <span className="text-gray-500 block mb-1">Notes</span>
                  <p className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    {selectedLivraison.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLivraison(null);
                }}
                className="btn-secondary flex-1"
              >
                Fermer
              </button>
              {selectedLivraison.statut === "en_attente" && (
                <button
                  onClick={() => {
                    handleUpdateStatut(selectedLivraison.id, "en_cours");
                    setShowDetailModal(false);
                    setSelectedLivraison(null);
                  }}
                  className="btn-primary flex-1"
                >
                  Démarrer la livraison
                </button>
              )}
              {selectedLivraison.statut === "en_cours" && (
                <button
                  onClick={() => {
                    handleUpdateStatut(selectedLivraison.id, "livree");
                    setShowDetailModal(false);
                    setSelectedLivraison(null);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex-1 hover:bg-green-700"
                >
                  Marquer comme livrée
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Livraisons;
