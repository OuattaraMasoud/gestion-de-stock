import React, { useEffect, useState } from "react";
import {
  UserCircle,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X,
  Tag,
  Search,
  Save,
  Eye,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Client, ClientPrice, Product } from "../types";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatCurrency } from "../utils/formatters";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";

const Clients: React.FC = () => {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [formData, setFormData] = useState<Client>({
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    ville: "",
  });

  const [showPricesModal, setShowPricesModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPrices, setClientPrices] = useState<ClientPrice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [pricesLoading, setPricesLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<number, string>>(
    {},
  );

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: "", onConfirm: () => {} });

  // Client details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [clientStats, setClientStats] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, [currentPage, itemsPerPage]);

  const loadClients = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
  ) => {
    try {
      const result = await window.electronAPI.getClientsPaginated(page, limit);
      setClients(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
      showErrorToast("Erreur lors du chargement des clients");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData(client);
    } else {
      setEditingClient(null);
      setFormData({
        nom: "",
        telephone: "",
        email: "",
        adresse: "",
        ville: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({
      nom: "",
      telephone: "",
      email: "",
      adresse: "",
      ville: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nom.trim()) {
      showErrorToast("Le nom du client est requis");
      return;
    }

    try {
      const clientData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      if (editingClient) {
        await window.electronAPI.updateClient(editingClient.id!, clientData);
        showSuccessToast("Client modifié avec succès");
      } else {
        await window.electronAPI.createClient(clientData);
        showSuccessToast("Client créé avec succès");
      }
      handleCloseModal();
      loadClients();
    } catch (error: any) {
      console.error("Erreur:", error);
      if (
        error?.message?.includes("UNIQUE constraint failed") ||
        error?.message?.includes("telephone")
      ) {
        showErrorToast("Un client avec ce numéro de téléphone existe déjà");
      } else {
        showErrorToast(
          editingClient
            ? "Erreur lors de la modification"
            : "Erreur lors de la création",
        );
      }
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Êtes-vous sûr de vouloir supprimer ce client ?",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await window.electronAPI.deleteClient(id, user?.id, user?.nom);
          showSuccessToast("Client supprimé avec succès");
          loadClients();
        } catch (error: any) {
          console.error("Erreur:", error);
          showErrorToast(error.message || "Erreur lors de la suppression");
        }
      },
    });
  };

  const handleOpenPricesModal = async (client: Client) => {
    setSelectedClient(client);
    setShowPricesModal(true);
    setPricesLoading(true);
    setSearchProduct("");
    setEditingPrices({});

    try {
      const [pricesData, productsData] = await Promise.all([
        window.electronAPI.getClientPrices(client.id!),
        window.electronAPI.getProducts(),
      ]);
      setClientPrices(pricesData as ClientPrice[]);
      setProducts(productsData as Product[]);
    } catch (error) {
      console.error("Erreur chargement prix:", error);
      showErrorToast("Erreur lors du chargement des prix");
    } finally {
      setPricesLoading(false);
    }
  };

  const handleClosePricesModal = () => {
    setShowPricesModal(false);
    setSelectedClient(null);
    setClientPrices([]);
    setProducts([]);
    setSearchProduct("");
    setEditingPrices({});
  };

  const handlePriceChange = (productId: number, value: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleSavePrice = async (productId: number) => {
    const priceValue = editingPrices[productId];
    if (!priceValue || isNaN(parseFloat(priceValue))) {
      showErrorToast("Veuillez entrer un prix valide");
      return;
    }

    try {
      const existingPrice = clientPrices.find(
        (p) => p.produit_id === productId,
      );

      if (existingPrice) {
        await window.electronAPI.updateClientPrice(existingPrice.id!, {
          prix_personnalise: parseFloat(priceValue),
        } as any);
      } else {
        await window.electronAPI.createClientPrice({
          client_id: selectedClient!.id!,
          produit_id: productId,
          prix_personnalise: parseFloat(priceValue),
        });
      }

      const pricesData = await window.electronAPI.getClientPrices(
        selectedClient!.id!,
      );
      setClientPrices(pricesData as ClientPrice[]);
      setEditingPrices((prev) => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });

      showSuccessToast("Prix enregistré avec succès");
    } catch (error) {
      console.error("Erreur sauvegarde prix:", error);
      showErrorToast("Erreur lors de la sauvegarde du prix");
    }
  };

  const handleDeletePrice = (priceId: number, productId: number) => {
    setConfirmDialog({
      isOpen: true,
      message: "Supprimer ce prix personnalisé ?",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await window.electronAPI.deleteClientPrice(priceId);
          setClientPrices((prev) => prev.filter((p) => p.id !== priceId));
          setEditingPrices((prev) => {
            const updated = { ...prev };
            delete updated[productId];
            return updated;
          });
          showSuccessToast("Prix supprimé avec succès");
        } catch (error) {
          console.error("Erreur suppression prix:", error);
          showErrorToast("Erreur lors de la suppression du prix");
        }
      },
    });
  };

  const handleOpenDetailsModal = async (client: Client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
    setDetailsLoading(true);

    try {
      const stats = await window.electronAPI.getClientStats(client.id!);
      setClientStats(stats);
    } catch (error) {
      console.error("Erreur chargement stats client:", error);
      showErrorToast("Erreur lors du chargement des statistiques");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setClientStats(null);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.nom.toLowerCase().includes(searchProduct.toLowerCase()) ||
      (product.code_barre &&
        product.code_barre.toLowerCase().includes(searchProduct.toLowerCase())),
  );

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedClients = clients;

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Clients
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalItems} client(s)
          </p>
        </div>
        {user?.role !== "caissier" && (
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5" />
            Nouveau Client
          </button>
        )}
      </div>

      {/* Liste des clients */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Solde Dû
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedClients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {client.nom}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {client.telephone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-4 h-4" />
                          {client.telephone}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-4 h-4" />
                          {client.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        {client.adresse && <div>{client.adresse}</div>}
                        {client.ville && <div>{client.ville}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold ${
                        (client.solde_du || 0) > 0 
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {(client.solde_du || 0) > 0 ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      {formatCurrency(client.solde_du || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenDetailsModal(client)}
                        className="text-green-600 hover:text-green-900"
                        title="Voir les détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenPricesModal(client)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Prix personnalisés"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(client)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user?.role !== "caissier" && (
                        <button
                          onClick={() => handleDelete(client.id!)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {clients.length === 0 && (
            <div className="text-center py-12">
              <UserCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun client
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Commencez par ajouter votre premier client.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {clients.length > 0 && (
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
                {editingClient ? "Modifier le client" : "Nouveau client"}
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
                  Nom du client <span className="text-red-500">*</span>
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

              {/* Téléphone et Email */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) =>
                    setFormData({ ...formData, adresse: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              {/* Ville */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ville
                </label>
                <input
                  type="text"
                  value={formData.ville}
                  onChange={(e) =>
                    setFormData({ ...formData, ville: e.target.value })
                  }
                  className="input-field"
                />
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
                  {editingClient ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Prix Personnalisés */}
      {showPricesModal && selectedClient && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content">
            <div className="bg-linear-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="text-2xl font-bold">
                Prix personnalisés - {selectedClient.nom}
              </h2>
              <button
                onClick={handleClosePricesModal}
                className="text-white hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 mr-2 pr-1" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              {pricesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Prix standard
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Prix personnalisé
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredProducts.map((product) => {
                        const clientPrice = clientPrices.find(
                          (p) => p.produit_id === product.id,
                        );
                        const currentPrice =
                          editingPrices[product.id!] !== undefined
                            ? editingPrices[product.id!]
                            : clientPrice?.prix_personnalise?.toString() || "";

                        return (
                          <tr
                            key={product.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {product.nom}
                              </div>
                              {product.code_barre && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {product.code_barre}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {formatCurrency(product.prix_vente)}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={currentPrice}
                                onChange={(e) =>
                                  handlePriceChange(product.id!, e.target.value)
                                }
                                placeholder="Prix personnalisé"
                                className="input-field w-32"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSavePrice(product.id!)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Enregistrer"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                {clientPrice && (
                                  <button
                                    onClick={() =>
                                      handleDeletePrice(
                                        clientPrice.id!,
                                        product.id!,
                                      )
                                    }
                                    className="text-red-600 hover:text-red-900"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Aucun produit trouvé
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={handleClosePricesModal}
                  className="btn-secondary w-full"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails Client */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content">
            <div className="bg-gradient-to-r from-green-600 to-green-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
              <div className="flex items-center gap-3">
                <UserCircle className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">{selectedClient.nom}</h2>
                  <p className="text-green-100 text-sm">Détails du client</p>
                </div>
              </div>
              <button
                onClick={handleCloseDetailsModal}
                className="text-white hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : clientStats ? (
                <div className="space-y-6">
                  {/* Informations de contact */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">
                      Informations de contact
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedClient.telephone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{selectedClient.telephone}</span>
                        </div>
                      )}
                      {selectedClient.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{selectedClient.email}</span>
                        </div>
                      )}
                      {selectedClient.adresse && (
                        <div className="flex items-center gap-2 col-span-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{selectedClient.adresse} {selectedClient.ville}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <ShoppingBag className="w-5 h-5" />
                        <span className="text-sm font-medium">Ventes</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {clientStats.nb_ventes || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-sm font-medium">Total achats</span>
                      </div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(clientStats.total_achats || 0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-purple-600 mb-2">
                        <DollarSign className="w-5 h-5" />
                        <span className="text-sm font-medium">Total payé</span>
                      </div>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                        {formatCurrency(clientStats.total_paye || 0)}
                      </p>
                    </div>
                    <div className={`rounded-lg p-4 ${(clientStats.reste_a_payer || 0) > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-900'}`}>
                      <div className={`flex items-center gap-2 mb-2 ${(clientStats.reste_a_payer || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-medium">Reste à payer</span>
                      </div>
                      <p className={`text-lg font-bold ${(clientStats.reste_a_payer || 0) > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {formatCurrency(clientStats.reste_a_payer || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Dernières ventes */}
                  {clientStats.recentSales && clientStats.recentSales.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Dernières ventes
                      </h3>
                      <div className="space-y-2">
                        {clientStats.recentSales.map((sale: any) => (
                          <div
                            key={sale.id}
                            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${sale.statut_paiement === 'paye' ? 'bg-green-500' : sale.statut_paiement === 'partiel' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                              <div>
                                <p className="font-medium text-sm">
                                  Vente #{sale.id}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(sale.date_vente).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">
                                {formatCurrency(sale.total)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {sale.nb_articles} article(s)
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!clientStats.recentSales || clientStats.recentSales.length === 0) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune vente enregistrée</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Erreur lors du chargement des données
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={handleCloseDetailsModal}
                  className="btn-secondary w-full"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Clients;
