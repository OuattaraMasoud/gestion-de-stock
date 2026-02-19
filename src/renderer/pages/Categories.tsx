import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Tag, FolderOpen } from "lucide-react";
import { Category } from "../types";
import {
  showAddToast,
  showUpdateToast,
  showDeleteToast,
  showErrorToast,
} from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";

const Categories: React.FC = () => {
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ nom: "", description: "" });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Erreur chargement catégories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      if (editingCategory?.id) {
        await window.electronAPI.updateCategory(
          editingCategory.id,
          categoryData,
        );
        showUpdateToast(`Catégorie "${formData.nom}"`);
      } else {
        await window.electronAPI.createCategory(categoryData);
        showAddToast(`Catégorie "${formData.nom}"`);
      }
      setShowModal(false);
      setFormData({ nom: "", description: "" });
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      console.error("Erreur sauvegarde catégorie:", error);
      showErrorToast("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ nom: category.nom, description: category.description || "" });
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({ nom: "", description: "" });
    setShowModal(true);
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
            Gestion des Catégories
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {categories.length} catégorie(s) au total
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus className="w-5 h-5" />
          Nouvelle Catégorie
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div
            key={category.id}
            className="card hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Tag className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(category)}
                  className="text-blue-600 hover:text-blue-800 p-2"
                  title="Modifier"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={async () => {
                    if (category.id && confirm("Supprimer cette catégorie ?")) {
                      try {
                        await window.electronAPI.deleteCategory(
                          category.id,
                          user?.id,
                          user?.nom,
                        );
                        showDeleteToast(`Catégorie "${category.nom}"`);
                        loadCategories();
                      } catch (error) {
                        console.error("Erreur suppression catégorie:", error);
                        showErrorToast("Erreur lors de la suppression");
                      }
                    }
                  }}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Supprimer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {category.nom}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {category.description || "Aucune description"}
            </p>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Créée le{" "}
                {new Date(category.created_at!).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="card text-center py-12">
          <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Aucune catégorie
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Commencez par créer votre première catégorie
          </p>
          <button onClick={handleAdd} className="btn-primary mx-auto">
            <Plus className="w-5 h-5" />
            Créer une catégorie
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full modal-content">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-2xl font-bold">
                {editingCategory
                  ? "Modifier la catégorie"
                  : "Nouvelle catégorie"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData({ ...formData, nom: e.target.value })
                  }
                  required
                  className="input-field"
                  placeholder="Ex: Électronique"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Description de la catégorie..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ nom: "", description: "" });
                    setEditingCategory(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
