import React, { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { Product, Category } from "../types";
import ProductModal from "../components/ProductModal";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import {
  showDeleteToast,
  showErrorToast,
  showSuccessToast,
} from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const Products: React.FC = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategorieId, setSelectedCategorieId] = useState<number | "">("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [imageCache, setImageCache] = useState<Map<number, string>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setCurrentPage(1);
      loadData(1, itemsPerPage, searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
    loadData(1, itemsPerPage, searchQuery, selectedCategorieId, selectedStatus);
  }, [selectedCategorieId, selectedStatus]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Erreur chargement catégories:", error);
    }
  };

  const loadData = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
    search: string = searchQuery,
    categorieId: number | "" = selectedCategorieId,
    status: string = selectedStatus,
  ) => {
    try {
      const result = await window.electronAPI.getProductsPaginated(
        page,
        limit,
        search,
        categorieId || undefined,
        status || undefined,
      );
      setProducts(result.data);
      setTotalItems(result.total);

      // Charger les images EN PARALLÈLE (au lieu de séquentiellement)
      const productsWithImages = result.data.filter((p: any) => p.image_url);
      const imagePromises = productsWithImages.map(async (product: any) => {
        try {
          const imageBase64 = await window.electronAPI.getProductImage(
            product.image_url,
          );
          return { id: product.id, image: imageBase64 };
        } catch {
          return { id: product.id, image: null };
        }
      });

      const imageResults = await Promise.all(imagePromises);
      const cache = new Map<number, string>();
      imageResults.forEach(({ id, image }) => {
        if (image) cache.set(id, image);
      });
      setImageCache(cache);
    } catch (error) {
      console.error("Erreur chargement données:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedProducts = products;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleDelete = async (id: number) => {
    const product = products.find((p) => p.id === id);
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteProduct(id, user?.id, user?.nom);
      showDeleteToast(`Produit "${product?.nom || "inconnu"}"`);
      loadData();
    } catch (error) {
      console.error("Erreur suppression:", error);
      showErrorToast("Erreur lors de la suppression du produit");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingProduct(null);
    loadData();
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Récupérer tous les produits
      const allProducts = await window.electronAPI.getProducts();

      // Créer le document PDF
      const doc = new jsPDF();

      // Fonction de formatage pour PDF (évite les espaces insécables)
      const formatPrixPDF = (amount: number): string => {
        const formatted = amount.toFixed(2).replace(".", ",");
        const parts = formatted.split(",");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return `${parts.join(",")} FCFA`;
      };

      // Titre
      doc.setFontSize(18);
      doc.text("Liste des Produits", 14, 22);

      // Date d'export
      doc.setFontSize(10);
      doc.text(
        `Export du ${new Date().toLocaleDateString("fr-FR")} a ${new Date().toLocaleTimeString("fr-FR")}`,
        14,
        30,
      );
      doc.text(`Total: ${allProducts.length} produit(s)`, 14, 36);

      // Préparer les données pour le tableau
      const tableData = allProducts.map((product: Product) => {
        const status =
          product.quantite_stock === 0
            ? "Epuise"
            : product.quantite_stock <= product.stock_min
              ? "Stock faible"
              : "En stock";

        return [
          product.nom,
          product.code_barre || "N/A",
          product.categorie_nom || "Sans categorie",
          formatPrixPDF(product.prix_achat || 0),
          formatPrixPDF(product.prix_vente || 0),
          product.quantite_stock.toString(),
          status,
        ];
      });

      // Générer le tableau
      autoTable(doc, {
        head: [
          [
            "Produit",
            "Code-barre",
            "Catégorie",
            "Prix Achat",
            "Prix Vente",
            "Stock",
            "Statut",
          ],
        ],
        body: tableData,
        startY: 42,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { cellWidth: 40 },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "center" },
          6: { halign: "center" },
        },
      });

      // Sauvegarder le PDF
      doc.save(`produits_${new Date().toISOString().split("T")[0]}.pdf`);
      showSuccessToast("Export PDF réussi");
    } catch (error) {
      console.error("Erreur export PDF:", error);
      showErrorToast("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExportingExcel(true);
    try {
      // Récupérer tous les produits
      const allProducts = await window.electronAPI.getProducts();

      // Préparer les données pour Excel
      const excelData = allProducts.map((product: Product) => {
        const status =
          product.quantite_stock === 0
            ? "Épuisé"
            : product.quantite_stock <= product.stock_min
              ? "Stock faible"
              : "En stock";

        return {
          Produit: product.nom,
          Description: product.description || "",
          "Code-barre": product.code_barre || "N/A",
          Catégorie: product.categorie_nom || "Sans catégorie",
          "Prix Achat": product.prix_achat || 0,
          "Prix Vente": product.prix_vente || 0,
          Stock: product.quantite_stock,
          "Stock Min": product.stock_min,
          Statut: status,
        };
      });

      // Créer le workbook et la feuille
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Produits");

      // Ajuster la largeur des colonnes
      worksheet["!cols"] = [
        { wch: 30 }, // Produit
        { wch: 40 }, // Description
        { wch: 15 }, // Code-barre
        { wch: 20 }, // Catégorie
        { wch: 12 }, // Prix Achat
        { wch: 12 }, // Prix Vente
        { wch: 8 }, // Stock
        { wch: 10 }, // Stock Min
        { wch: 12 }, // Statut
      ];

      // Sauvegarder le fichier Excel
      XLSX.writeFile(
        workbook,
        `produits_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      showSuccessToast("Export Excel réussi");
    } catch (error) {
      console.error("Erreur export Excel:", error);
      showErrorToast("Erreur lors de l'export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      showErrorToast("Veuillez sélectionner un fichier CSV");
      return;
    }

    setImporting(true);
    try {
      const content = await file.text();
      const result = await window.electronAPI.importProductsCSV(content);

      if (result.success) {
        showSuccessToast(
          `Import réussi: ${result.stats.categoriesCreated} catégories, ${result.stats.productsCreated} créés, ${result.stats.productsUpdated} mis à jour`,
        );
        loadCategories();
        loadData();
      } else {
        showErrorToast(result.message);
      }
    } catch (error) {
      console.error("Erreur import CSV:", error);
      showErrorToast("Erreur lors de l'import du fichier CSV");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Produits
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{totalItems} produit(s) au total</p>
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
              <Download className="w-5 h-5" />
            )}
            {exporting ? "Export..." : "Exporter PDF"}
          </button>
          <button
            onClick={exportToExcel}
            disabled={exportingExcel || totalItems === 0}
            className="btn-secondary"
          >
            {exportingExcel ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            ) : (
              <FileSpreadsheet className="w-5 h-5" />
            )}
            {exportingExcel ? "Export..." : "Exporter Excel"}
          </button>
          <button
            onClick={handleImportCSV}
            disabled={importing}
            className="btn-secondary"
          >
            {importing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <Upload className="w-5 h-5" />
            )}
            {importing ? "Import..." : "Importer CSV"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <button onClick={handleAdd} className="btn-primary">
            <Plus className="w-5 h-5" />
            Nouveau Produit
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          {/* Recherche */}
          <div className="flex-1 min-w-48 relative border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher par nom, code-barre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 pl-10 pr-3 text-sm outline-none bg-transparent"
            />
          </div>

          {/* Filtre catégorie */}
          <div ref={categoryDropdownRef} className="relative min-w-48">
            <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <Search className="text-gray-400 w-4 h-4 shrink-0" />
              <input
                type="text"
                placeholder={
                  selectedCategorieId !== ""
                    ? (categories.find((c) => c.id === selectedCategorieId)?.nom ?? "Catégorie")
                    : "Toutes les catégories"
                }
                value={categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value);
                  setShowCategoryDropdown(true);
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                className="flex-1 py-2 text-sm outline-none bg-transparent"
              />
              {selectedCategorieId !== "" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCategorieId("");
                    setCategorySearch("");
                    setShowCategoryDropdown(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showCategoryDropdown && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 text-gray-500 dark:text-gray-400"
                  onClick={() => {
                    setSelectedCategorieId("");
                    setCategorySearch("");
                    setShowCategoryDropdown(false);
                  }}
                >
                  Toutes les catégories
                </button>
                {categories
                  .filter((cat) =>
                    cat.nom.toLowerCase().includes(categorySearch.toLowerCase())
                  )
                  .map((cat) => (
                    <button
                      key={cat.id}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${
                        selectedCategorieId === cat.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() => {
                        setSelectedCategorieId(cat.id!);
                        setCategorySearch("");
                        setShowCategoryDropdown(false);
                      }}
                    >
                      {cat.nom}
                    </button>
                  ))}
                {categories.filter((cat) =>
                  cat.nom.toLowerCase().includes(categorySearch.toLowerCase())
                ).length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray-400">Aucun résultat</p>
                )}
              </div>
            )}
          </div>

          {/* Filtre statut */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input-field cursor-pointer"
          >
            <option value="">Tous les statuts</option>
            <option value="en_stock">En stock</option>
            <option value="stock_faible">Stock faible</option>
            <option value="epuise">Épuisé</option>
            <option value="sans_stock">Sans gestion stock</option>
          </select>

          {/* Bouton réinitialiser */}
          {(searchQuery || selectedCategorieId !== "" || selectedStatus !== "") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategorieId("");
                setCategorySearch("");
                setSelectedStatus("");
              }}
              className="btn-secondary flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Code-barre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prix Achat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prix Vente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
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
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center">
                        {product.image_url && imageCache.get(product.id!) ? (
                          <img
                            src={imageCache.get(product.id!)}
                            alt={product.nom}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {product.nom}
                        </div>
                        {product.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {product.description.substring(0, 30)}...
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {product.code_barre || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {product.categorie_nom || "Sans catégorie"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(product.prix_achat || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(product.prix_vente || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {product.sans_stock ? (
                      <span className="font-semibold text-purple-600">∞</span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          product.quantite_stock <= product.stock_min
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {product.quantite_stock}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.sans_stock ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        Sans gestion stock
                      </span>
                    ) : product.quantite_stock === 0 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800">
                        Épuisé
                      </span>
                    ) : product.quantite_stock <= product.stock_min ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Stock faible
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        En stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Modifier"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucun produit trouvé
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Commencez par ajouter votre premier produit.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {products.length > 0 && (
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

      {/* Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default Products;
