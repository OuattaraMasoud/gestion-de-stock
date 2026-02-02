import React, { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X,
  AlertCircle,
} from "lucide-react";
import { Supplier } from "../types";
import Pagination from "../components/Pagination";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";

const Suppliers: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [formData, setFormData] = useState<Supplier>({
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    ville: "",
    pays: "",
    commentaires: "",
  });

  useEffect(() => {
    loadSuppliers();
  }, [currentPage, itemsPerPage]);

  const loadSuppliers = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
  ) => {
    try {
      const result = await window.electronAPI.getSuppliersPaginated(
        page,
        limit,
      );
      setSuppliers(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement fournisseurs:", error);
      showErrorToast("Erreur lors du chargement des fournisseurs");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData(supplier);
    } else {
      setEditingSupplier(null);
      setFormData({
        nom: "",
        telephone: "",
        email: "",
        adresse: "",
        ville: "",
        pays: "",
        commentaires: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setFormData({
      nom: "",
      telephone: "",
      email: "",
      adresse: "",
      ville: "",
      pays: "",
      commentaires: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nom.trim()) {
      showErrorToast("Le nom du fournisseur est requis");
      return;
    }

    try {
      const supplierData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      if (editingSupplier) {
        await window.electronAPI.updateSupplier(
          editingSupplier.id!,
          supplierData,
        );
        showSuccessToast("Fournisseur modifié avec succès");
      } else {
        await window.electronAPI.createSupplier(supplierData);
        showSuccessToast("Fournisseur créé avec succès");
      }
      handleCloseModal();
      loadSuppliers();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast(
        editingSupplier
          ? "Erreur lors de la modification"
          : "Erreur lors de la création",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteSupplier(id, user?.id, user?.nom);
      showSuccessToast("Fournisseur supprimé avec succès");
      loadSuppliers();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast("Erreur lors de la suppression");
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedSuppliers = suppliers;

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
          <h1 className="text-3xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-gray-600 mt-1">{totalItems} fournisseur(s)</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/dettes-fournisseurs")}
            className="btn-secondary flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            Dettes
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5" />
            Nouveau Fournisseur
          </button>
        </div>
      </div>

      {/* Liste des fournisseurs */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
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
              {paginatedSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {supplier.nom}
                      </div>
                      {supplier.commentaires && (
                        <div className="text-sm text-gray-500">
                          {supplier.commentaires}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {supplier.telephone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {supplier.telephone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        {supplier.adresse && <div>{supplier.adresse}</div>}
                        {supplier.ville && <div>{supplier.ville}</div>}
                        {supplier.pays && <div>{supplier.pays}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${(supplier.solde_du || 0) > 0 ? "text-red-600" : "text-gray-600"}`}
                    >
                      {(supplier.solde_du || 0).toFixed(2)} FCFA
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(supplier)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id!)}
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

          {suppliers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun fournisseur
              </h3>
              <p className="text-gray-600">
                Commencez par ajouter votre premier fournisseur.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {suppliers.length > 0 && (
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
                {editingSupplier
                  ? "Modifier le fournisseur"
                  : "Nouveau fournisseur"}
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
                  Nom du fournisseur <span className="text-red-500">*</span>
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

              {/* Ville et Pays */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={formData.pays}
                    onChange={(e) =>
                      setFormData({ ...formData, pays: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>

              {/* Commentaires */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commentaires
                </label>
                <textarea
                  value={formData.commentaires}
                  onChange={(e) =>
                    setFormData({ ...formData, commentaires: e.target.value })
                  }
                  rows={3}
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
                  {editingSupplier ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
