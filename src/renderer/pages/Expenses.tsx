import React, { useEffect, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  X,
  TrendingDown,
} from "lucide-react";
import { Expense } from "../types";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import {
  showDeleteToast,
  showErrorToast,
  showSuccessToast,
} from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";

type ExpenseCategory =
  | "restauration"
  | "energie"
  | "carburant"
  | "transport"
  | "fournitures"
  | "salaire"
  | "loyer"
  | "communication"
  | "don"
  | "maintenance"
  | "autre";

const categoryLabels: Record<ExpenseCategory, string> = {
  restauration: "Restauration",
  energie: "Énergie",
  carburant: "Carburant",
  transport: "Transport",
  fournitures: "Fournitures",
  salaire: "Salaire",
  loyer: "Loyer",
  communication: "Communication",
  don: "Don",
  maintenance: "Maintenance",
  autre: "Autre",
};

const categoryColors: Record<ExpenseCategory, string> = {
  restauration: "bg-orange-100 text-orange-800",
  energie: "bg-yellow-100 text-yellow-800",
  carburant: "bg-red-100 text-red-800",
  transport: "bg-blue-100 text-blue-800",
  fournitures: "bg-purple-100 text-purple-800",
  salaire: "bg-green-100 text-green-800",
  loyer: "bg-indigo-100 text-indigo-800",
  communication: "bg-cyan-100 text-cyan-800",
  don: "bg-pink-100 text-pink-800",
  maintenance: "bg-gray-100 text-gray-800",
  autre: "bg-slate-100 text-slate-800",
};

type PeriodType = "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "custom";

const periodLabels: Record<PeriodType, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  thisWeek: "Cette semaine",
  thisMonth: "Ce mois",
  lastMonth: "Mois dernier",
  custom: "Personnalisé",
};

const getDateRange = (period: PeriodType, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  switch (period) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: formatDate(yesterday), end: formatDate(yesterday) };
    }
    case "thisWeek": {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return { start: formatDate(startOfWeek), end: formatDate(today) };
    }
    case "thisMonth": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(startOfMonth), end: formatDate(today) };
    }
    case "lastMonth": {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) };
    }
    case "custom":
      return { start: customStart || formatDate(today), end: customEnd || formatDate(today) };
    default:
      return { start: formatDate(today), end: formatDate(today) };
  }
};

const Expenses: React.FC = () => {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalMontant, setTotalMontant] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stats, setStats] = useState<{ total: number; byCategorie: { categorie: string; total: number; count: number }[] } | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    categorie: "autre",
    description: "",
    montant: 0,
    date_depense: new Date().toISOString().split("T")[0],
    methode_paiement: "especes",
    reference: "",
  });

  useEffect(() => {
    loadData();
  }, [currentPage, itemsPerPage, selectedPeriod, customStartDate, customEndDate, selectedCategory]);

  const loadData = async () => {
    const { start, end } = getDateRange(selectedPeriod, customStartDate, customEndDate);

    try {
      setLoading(true);
      const [expensesResult, statsResult] = await Promise.all([
        window.electronAPI.getExpensesPaginated(
          currentPage,
          itemsPerPage,
          start,
          end,
          selectedCategory || undefined,
        ),
        window.electronAPI.getExpenseStats(start, end),
      ]);

      setExpenses(expensesResult.data);
      setTotalItems(expensesResult.total);
      setTotalMontant(expensesResult.totalMontant);
      setStats(statsResult);
    } catch (error) {
      console.error("Erreur chargement dépenses:", error);
      showErrorToast("Erreur lors du chargement des dépenses");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
    setCurrentPage(1);
    if (period === "custom") {
      setShowCustomDates(true);
      if (!customStartDate) {
        const today = new Date().toISOString().split("T")[0];
        setCustomStartDate(today);
        setCustomEndDate(today);
      }
    } else {
      setShowCustomDates(false);
    }
  };

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData(expense);
    } else {
      setEditingExpense(null);
      setFormData({
        categorie: "autre",
        description: "",
        montant: 0,
        date_depense: new Date().toISOString().split("T")[0],
        methode_paiement: "especes",
        reference: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description?.trim()) {
      showErrorToast("La description est requise");
      return;
    }

    if (!formData.montant || formData.montant <= 0) {
      showErrorToast("Le montant doit être supérieur à 0");
      return;
    }

    try {
      const expenseData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      } as Expense;

      if (editingExpense) {
        await window.electronAPI.updateExpense(editingExpense.id!, expenseData);
        showSuccessToast("Dépense modifiée avec succès");
      } else {
        await window.electronAPI.createExpense(expenseData);
        showSuccessToast("Dépense créée avec succès");
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast(
        editingExpense
          ? "Erreur lors de la modification"
          : "Erreur lors de la création",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteExpense(id, user?.id, user?.nom);
      showDeleteToast("Dépense");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      showErrorToast("Erreur lors de la suppression");
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dépenses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Total: {formatCurrency(totalMontant)} • {totalItems} dépense(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
              className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer pr-8"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {showCustomDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes catégories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5" />
            Nouvelle Dépense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Dépenses</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.total || 0)}</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-200" />
          </div>
        </div>
        {stats?.byCategorie.slice(0, 3).map((cat) => (
          <div key={cat.categorie} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {categoryLabels[cat.categorie as ExpenseCategory]}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(cat.total)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {cat.count} dépense(s)
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColors[cat.categorie as ExpenseCategory]}`}>
                {cat.categorie.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Paiement
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(expense.date_depense).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[expense.categorie as ExpenseCategory]}`}>
                      {categoryLabels[expense.categorie as ExpenseCategory]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    <div className="font-medium">{expense.description}</div>
                    {expense.reference && (
                      <div className="text-xs text-gray-500">Réf: {expense.reference}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {expense.methode_paiement || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-red-600">
                      {formatCurrency(expense.montant)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(expense)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id!)}
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

          {expenses.length === 0 && (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucune dépense enregistrée
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Commencez par ajouter votre première dépense.
              </p>
            </div>
          )}
        </div>

        {expenses.length > 0 && (
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

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-600 to-red-800 text-white px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="text-xl font-bold">
                {editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
              </h2>
              <button onClick={handleCloseModal} className="text-white hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categorie}
                  onChange={(e) => setFormData({ ...formData, categorie: e.target.value as ExpenseCategory })}
                  className="input-field"
                  required
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Montant <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date_depense}
                    onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mode de paiement
                  </label>
                  <select
                    value={formData.methode_paiement || "especes"}
                    onChange={(e) => setFormData({ ...formData, methode_paiement: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="especes">Espèces</option>
                    <option value="carte">Carte</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="mobile">Mobile Money</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Référence
                  </label>
                  <input
                    type="text"
                    value={formData.reference || ""}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="input-field"
                    placeholder="N° facture, reçu..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingExpense ? "Modifier" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
