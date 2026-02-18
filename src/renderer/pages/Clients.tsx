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
} from "lucide-react";
import { Client, ClientPrice, Product } from "../types";
import Pagination from "../components/Pagination";
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
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast(
        editingClient
          ? "Erreur lors de la modification"
          : "Erreur lors de la création",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteClient(id, user?.id, user?.nom);
      showSuccessToast("Client supprimé avec succès");
      loadClients();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast("Erreur lors de la suppression");
    }
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

  const handleDeletePrice = async (priceId: number, productId: number) => {
    if (!confirm("Supprimer ce prix personnalisé ?")) {
      return;
    }

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
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">{totalItems} client(s)</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-5 h-5" />
          Nouveau Client
        </button>
      </div>

      {/* Liste des clients */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Solde Dû
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {client.nom}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {client.telephone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {client.telephone}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {client.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        {client.adresse && <div>{client.adresse}</div>}
                        {client.ville && <div>{client.ville}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${(client.solde_du || 0) > 0 ? "text-red-600" : "text-gray-600"}`}
                    >
                      {formatCurrency(client.solde_du || 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
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
                      <button
                        onClick={() => handleDelete(client.id!)}
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

          {clients.length === 0 && (
            <div className="text-center py-12">
              <UserCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun client
              </h3>
              <p className="text-gray-600">
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
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content">
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Prix standard
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Prix personnalisé
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredProducts.map((product) => {
                        const clientPrice = clientPrices.find(
                          (p) => p.produit_id === product.id,
                        );
                        const currentPrice =
                          editingPrices[product.id!] !== undefined
                            ? editingPrices[product.id!]
                            : clientPrice?.prix_personnalise?.toString() || "";

                        return (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {product.nom}
                              </div>
                              {product.code_barre && (
                                <div className="text-xs text-gray-500">
                                  {product.code_barre}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
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
                    <div className="text-center py-8 text-gray-500">
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
    </div>
  );
};

export default Clients;
