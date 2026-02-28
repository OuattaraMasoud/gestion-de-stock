import React, { useEffect, useState } from "react";
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Trash2,
  Search,
  Mail,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { User } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  showAddToast,
  showUpdateToast,
  showDeleteToast,
  showErrorToast,
} from "../utils/toast";

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const [formData, setFormData] = useState<Partial<User>>({
    nom: "",
    email: "",
    mot_de_passe: "",
    role: "caissier",
    actif: true,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadUsers();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setCurrentPage(1);
      loadUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const loadUsers = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
    search: string = searchTerm,
  ) => {
    try {
      const result = await window.electronAPI.getUsersPaginated(
        page,
        limit,
        search,
      );
      setUsers(result.data);
      setTotalItems(result.total);
      setFilteredUsers(result.data);
    } catch (error) {
      console.error("Erreur chargement utilisateurs:", error);
      alert("Erreur lors du chargement des utilisateurs");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nom || !formData.email) {
      showErrorToast("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!editingUser && !formData.mot_de_passe) {
      showErrorToast(
        "Le mot de passe est obligatoire pour un nouvel utilisateur",
      );
      return;
    }

    try {
      if (editingUser?.id) {
        const updateData: User = {
          ...editingUser,
          ...formData,
          nom: formData.nom!,
          email: formData.email!,
          role: formData.role!,
          actif: formData.actif!,
          utilisateur_id: currentUser?.id,
          utilisateur_nom: currentUser?.nom,
        };
        await window.electronAPI.updateUser(editingUser.id, updateData);
        showUpdateToast(`Utilisateur "${formData.nom}"`);
      } else {
        const createData: User = {
          nom: formData.nom!,
          email: formData.email!,
          mot_de_passe: formData.mot_de_passe!,
          role: formData.role!,
          actif: formData.actif!,
          utilisateur_id: currentUser?.id,
          utilisateur_nom: currentUser?.nom,
        };
        await window.electronAPI.createUser(createData);
        showAddToast(`Utilisateur "${formData.nom}"`);
      }
      setShowModal(false);
      setFormData({
        nom: "",
        email: "",
        mot_de_passe: "",
        role: "caissier",
        actif: true,
      });
      setEditingUser(null);
      setShowPassword(false);
      loadUsers();
    } catch (error) {
      console.error("Erreur sauvegarde utilisateur:", error);
      showErrorToast("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      nom: user.nom,
      email: user.email,
      role: user.role,
      actif: user.actif,
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (currentUser?.id === id) {
      showErrorToast("Vous ne pouvez pas supprimer votre propre compte");
      return;
    }
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteId === null) return;
    const user = users.find((u) => u.id === pendingDeleteId);
    setConfirmOpen(false);
    setPendingDeleteId(null);
    try {
      await window.electronAPI.deleteUser(
        pendingDeleteId,
        currentUser?.id,
        currentUser?.nom,
      );
      showDeleteToast(`Utilisateur "${user?.nom || "inconnu"}"`);
      loadUsers();
    } catch (error) {
      console.error("Erreur suppression:", error);
      showErrorToast("Erreur lors de la suppression");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "gestionnaire":
        return "bg-blue-100 text-blue-800";
      case "caissier":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Jamais";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedUsers = filteredUsers;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-blue-600" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gérez les comptes et les permissions des utilisateurs
          </p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              nom: "",
              email: "",
              mot_de_passe: "",
              role: "caissier",
              actif: true,
            });
            setShowPassword(false);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Nouvel Utilisateur
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dernière connexion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {user.nom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                          user.role,
                        )}`}
                      >
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.actif
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => user.id && handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={currentUser?.id === user.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
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

      {/* Modal Ajout/Modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData({ ...formData, nom: e.target.value })
                  }
                  className="input-field"
                  placeholder="Ex: Jean Dupont"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="input-field"
                  placeholder="Ex: jean@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mot de passe {!editingUser && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.mot_de_passe || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, mot_de_passe: e.target.value })
                    }
                    className="input-field pr-10"
                    placeholder={
                      editingUser
                        ? "Laisser vide pour ne pas changer"
                        : "••••••••"
                    }
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rôle *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as
                        | "admin"
                        | "caissier"
                        | "gestionnaire",
                    })
                  }
                  className="input-field"
                  required
                >
                  <option value="caissier">Caissier</option>
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.actif}
                  onChange={(e) =>
                    setFormData({ ...formData, actif: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="actif"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Compte actif
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    setShowPassword(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingUser ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Êtes-vous sûr de vouloir supprimer cet utilisateur ?"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
};

export default Users;
