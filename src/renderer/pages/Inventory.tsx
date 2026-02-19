import React, { useEffect, useState } from "react";
import {
  ClipboardList,
  Search,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Category } from "../types";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface InventoryItem {
  id: number;
  nom: string;
  code_barre: string | null;
  quantite_stock: number;
  stock_min: number;
  prix_achat: number;
  prix_vente: number;
  categorie_nom: string | null;
  total_entrees: number;
  total_sorties: number;
}

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState({
    valeur_stock_achat: 0,
    valeur_stock_vente: 0,
    produits_rupture: 0,
    produits_stock_bas: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setCurrentPage(1);
      loadData();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [startDate, endDate, selectedCategory]);

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Erreur chargement catégories:", error);
    }
  };

  const loadData = async () => {
    try {
      const result = await window.electronAPI.getInventoryData(
        currentPage,
        itemsPerPage,
        startDate || undefined,
        endDate || undefined,
        searchQuery || undefined,
        selectedCategory
      );
      setItems(result.data);
      setTotalItems(result.total);
      if (result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Erreur chargement inventaire:", error);
    } finally {
      setLoading(false);
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

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setSelectedCategory(undefined);
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantite_stock === 0) {
      return { label: "Rupture", color: "bg-red-100 text-red-800" };
    }
    if (item.quantite_stock <= item.stock_min) {
      return { label: "Bas", color: "bg-orange-100 text-orange-800" };
    }
    return { label: "OK", color: "bg-green-100 text-green-800" };
  };

  // Stats globales (depuis le backend, pas la page courante)
  const totalProduits = totalItems;
  const valeurStockAchat = stats.valeur_stock_achat;
  const valeurStockVente = stats.valeur_stock_vente;
  const produitsEnRupture = stats.produits_rupture;
  const produitsStockBas = stats.produits_stock_bas;

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const allData = await window.electronAPI.getInventoryData(
        1, 100000,
        startDate || undefined, endDate || undefined,
        searchQuery || undefined, selectedCategory
      );

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("Inventaire", 14, 22);

      doc.setFontSize(10);
      doc.text(`Export du ${new Date().toLocaleDateString("fr-FR")} a ${new Date().toLocaleTimeString("fr-FR")}`, 14, 30);
      if (startDate && endDate) {
        doc.text(`Periode: ${startDate} - ${endDate}`, 14, 36);
      }
      doc.text(`Total: ${allData.total} produit(s)`, 14, startDate && endDate ? 42 : 36);

      const tableData = allData.data.map((item: InventoryItem) => {
        const status = item.quantite_stock === 0
          ? "Rupture"
          : item.quantite_stock <= item.stock_min
            ? "Stock bas"
            : "OK";

        return [
          item.nom,
          item.categorie_nom || "Sans categorie",
          item.total_entrees.toString(),
          item.total_sorties.toString(),
          item.quantite_stock.toString(),
          status,
          "",
        ];
      });

      autoTable(doc, {
        head: [["Produit", "Categorie", "Entrees", "Sorties", "Stock", "Statut", "Etat physique"]],
        body: tableData,
        startY: startDate && endDate ? 48 : 42,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 40 },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { cellWidth: 40 },
        },
      });

      doc.save(`inventaire_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Export PDF réussi");
    } catch (error) {
      console.error("Erreur export PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExportingExcel(true);
    try {
      const allData = await window.electronAPI.getInventoryData(
        1, 100000,
        startDate || undefined, endDate || undefined,
        searchQuery || undefined, selectedCategory
      );

      const excelData = allData.data.map((item: InventoryItem) => {
        const status = item.quantite_stock === 0
          ? "Rupture"
          : item.quantite_stock <= item.stock_min
            ? "Stock bas"
            : "OK";

        return {
          "Produit": item.nom,
          "Code-barre": item.code_barre || "N/A",
          "Catégorie": item.categorie_nom || "Sans catégorie",
          "Entrées": item.total_entrees,
          "Sorties": item.total_sorties,
          "Stock actuel": item.quantite_stock,
          "Stock min": item.stock_min,
          "Prix Achat": item.prix_achat,
          "Prix Vente": item.prix_vente,
          "Statut": status,
          "Etat physique": "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventaire");

      worksheet["!cols"] = [
        { wch: 30 }, { wch: 15 }, { wch: 20 },
        { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 25 },
      ];

      XLSX.writeFile(workbook, `inventaire_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Export Excel réussi");
    } catch (error) {
      console.error("Erreur export Excel:", error);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportingExcel(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventaire</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Suivi des entrées, sorties et stock par produit
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToPDF}
            disabled={exporting || totalItems === 0}
            className="btn-secondary"
          >
            {exporting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <>
                <Download className="w-5 h-5" />
                PDF
              </>
            )}
          </button>
          <button
            onClick={exportToExcel}
            disabled={exportingExcel || totalItems === 0}
            className="btn-secondary"
          >
            {exportingExcel ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            ) : (
              <>
                <FileSpreadsheet className="w-5 h-5" />
                Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total produits</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalProduits}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Valeur stock (achat)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(valeurStockAchat)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Valeur stock (vente)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(valeurStockVente)}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Stock bas</p>
              <p className="text-xl font-bold text-orange-600">{produitsStockBas}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">En rupture</p>
              <p className="text-xl font-bold text-red-600">{produitsEnRupture}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Nom ou code-barre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégorie
            </label>
            <select
              value={selectedCategory || ""}
              onChange={(e) =>
                setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)
              }
              className="input-field"
            >
              <option value="">Toutes</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          {(startDate || endDate || searchQuery || selectedCategory) && (
            <button onClick={handleResetFilters} className="btn-secondary">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Entrées
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sorties
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock actuel
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Valeur (achat)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Valeur (vente)
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.nom}
                        </p>
                        {item.code_barre && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.code_barre}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {item.categorie_nom || "Sans catégorie"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
                        <TrendingUp className="w-4 h-4" />
                        {item.total_entrees}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
                        <TrendingDown className="w-4 h-4" />
                        {item.total_sorties}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900 dark:text-white">
                      {item.quantite_stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.quantite_stock * item.prix_achat)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.quantite_stock * item.prix_vente)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun produit trouvé
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Modifiez vos filtres ou ajoutez des produits.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {items.length > 0 && (
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
    </div>
  );
};

export default Inventory;
