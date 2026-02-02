import React, { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  Truck,
  Package,
  ArrowLeft,
  CreditCard,
  Banknote,
  Check,
  X,
  History,
} from "lucide-react";
import { Product, Supplier, Purchase, PurchaseItem } from "../types";
import { formatCurrency } from "../utils/formatters";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";
import Pagination from "../components/Pagination";
import { useAuthStore } from "../store/useAuthStore";

const Purchases: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"creation" | "history">(
    "creation",
  );
  const { user } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPurchasePriceDisabled, setIsPurchasePriceDisabled] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "especes" | "carte" | "virement" | "cheque"
  >("especes");
  const [amountPaid, setAmountPaid] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [processing, setProcessing] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
  const [totalHistoryItems, setTotalHistoryItems] = useState(0);

  const loadSuppliers = async () => {
    try {
      const data = await window.electronAPI.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des fournisseurs");
    }
  };

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.getProductsPaginated(
        currentPage,
        itemsPerPage,
        searchQuery || undefined
      );
      setProducts(result.data);
      setTotalProducts(result.total);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des produits");
    }
  };

  const loadPurchaseHistory = async (page: number = historyCurrentPage, limit: number = historyItemsPerPage) => {
    try {
      const result = await window.electronAPI.getPurchasesPaginated(
          page,
          limit
        );
      setPurchaseHistory(result.data);
      setTotalHistoryItems(result.total);
    } catch (error) {
      showErrorToast(
        "Erreur lors du chargement de l'historique des approvisionnements",
      );
    }
  };

  useEffect(() => {
    loadSuppliers();
    loadProducts();
    loadPurchaseHistory();
  }, [currentPage, itemsPerPage, historyCurrentPage, historyItemsPerPage]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);

      if (!query.trim()) {
        // Pas de recherche: charger la première page de tous les produits
        await loadProducts();
        return;
      }

      // Recherche FTS5 côté serveur (ultra-rapide)
      try {
        const results = await window.electronAPI.searchProductsFTS(query, itemsPerPage * 5);
        setProducts(results);
        setTotalProducts(results.length);
      } catch (error) {
        showErrorToast("Erreur lors de la recherche de produits");
      }
    },
    [itemsPerPage],
  );

  const { totalPages, paginatedProducts } = (() => {
    const pages = Math.ceil(totalProducts / itemsPerPage);
    const startIndex = (currentPage -1) * itemsPerPage;
    const paginated = products.slice(startIndex, startIndex + itemsPerPage);
    return { totalPages: pages, paginatedProducts: paginated };
  })();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleAddProduct = () => {
    if (!selectedProduct) {
      showErrorToast("Veuillez sélectionner un produit");
      return;
    }

    const price = parseFloat(purchasePrice) || 0;
    if (price <= 0) {
      showErrorToast("Veuillez entrer un prix d'achat valide");
      return;
    }

    if (quantity <= 0) {
      showErrorToast("Veuillez entrer une quantité valide");
      return;
    }

    const existingIndex = purchaseItems.findIndex(
      (item) => item.produit_id === selectedProduct.id,
    );

    if (existingIndex >= 0) {
      const updatedItems = [...purchaseItems];
      updatedItems[existingIndex].quantite += quantity;
      updatedItems[existingIndex].sous_total =
        updatedItems[existingIndex].quantite *
        updatedItems[existingIndex].prix_unitaire;
      setPurchaseItems(updatedItems);
    } else {
      setPurchaseItems([
        ...purchaseItems,
        {
          produit_id: selectedProduct.id!,
          nom_produit: selectedProduct.nom,
          quantite: quantity,
          prix_unitaire: price,
          sous_total: quantity * price,
        },
      ]);
    }

    setSelectedProduct(null);
    setPurchasePrice("");
    setQuantity(1);
    setShowProductSearch(false);
    setSearchQuery("");
  };

  const handleRemoveProduct = (productId: number) => {
    setPurchaseItems(
      purchaseItems.filter((item) => item.produit_id !== productId),
    );
  };

  const getTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + item.sous_total, 0);
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      showErrorToast("Veuillez sélectionner un fournisseur");
      return;
    }

    if (purchaseItems.length === 0) {
      showErrorToast("Veuillez ajouter au moins un produit");
      return;
    }

    const total = getTotal();
    const paid = parseFloat(amountPaid) || 0;

    if (paid < 0) {
      showErrorToast("Le montant payé doit être positif");
      return;
    }

    setProcessing(true);

    try {
      const montantRestant = total - paid;
      const statutPaiement: "paye" | "partiel" | "impaye" =
        montantRestant <= 0 ? "paye" : paid > 0 ? "partiel" : "impaye";

      const purchase: Purchase = {
        fournisseur_id: selectedSupplier.id!,
        fournisseur_nom: selectedSupplier.nom,
        total,
        montant_paye: paid,
        montant_restant: montantRestant,
        statut_paiement: statutPaiement,
        produits: purchaseItems,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      await window.electronAPI.createPurchase(purchase);
      showSuccessToast("Achat enregistré avec succès");

      setPurchaseItems([]);
      setSelectedSupplier(null);
      setAmountPaid("");
      setPaymentMethod("especes");
      setShowConfirmation(false);
      loadPurchaseHistory();
      loadProducts();
    } catch (error) {
      showErrorToast("Erreur lors de l'enregistrement de l'achat");
    } finally {
      setProcessing(false);
    }
  };

  const historyTotalPages = Math.ceil(totalHistoryItems / historyItemsPerPage);
  const historyPaginatedPurchases = purchaseHistory;

  const totalApprovisionnements = purchaseHistory.reduce(
    (sum, purchase) => sum + (Number(purchase.total) || 0),
    0,
  );

  const handleHistoryPageChange = (page: number) => {
    setHistoryCurrentPage(page);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setPurchasePrice((product.prix_achat || 0).toString());
    setIsPurchasePriceDisabled(true);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setPurchasePrice("");
    setIsPurchasePriceDisabled(false);
  };

  return (
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Approvisionnements
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Gérer les entrées de stock auprès des fournisseurs
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Total approvisionnements</p>
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(totalApprovisionnements)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="card">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("creation")}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                activeTab === "creation"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Truck className="w-5 h-5" />
              Nouvel approvisionnement
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
                activeTab === "history"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <History className="w-5 h-5" />
              Historique
            </button>
          </div>

          {/* Contenu Tab Creation */}
          {activeTab === "creation" && (
            <div className="p-6 space-y-4">
              <div className="card shadow-lg">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">
                    Nouvel approvisionnement
                  </h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Fournisseur *
                    </label>
                    <select
                      value={selectedSupplier?.id || ""}
                      onChange={(e) => {
                        const supplier = suppliers.find(
                          (s) => s.id === parseInt(e.target.value),
                        );
                        setSelectedSupplier(supplier || null);
                      }}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                    >
                      <option value="">Sélectionner un fournisseur</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <button
                      onClick={() => setShowProductSearch(true)}
                      disabled={!selectedSupplier}
                      className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter des produits
                    </button>
                  </div>
                </div>
              </div>

              {showProductSearch && (
                <div className="card shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Sélectionner un produit
                    </h3>
                    <button
                      onClick={() => {
                        setShowProductSearch(false);
                        setSearchQuery("");
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                    />
                  </div>

              {selectedProduct && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-2 mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {selectedProduct.nom}
                    </p>
                    <p className="text-xs text-gray-600">
                      Stock: {selectedProduct.quantite_stock} • Prix: {formatCurrency(selectedProduct.prix_achat || 0)}
                    </p>
                  </div>
                  <button
                    onClick={handleClearProduct}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Quantité *
                      </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(parseInt(e.target.value) || 1)
                        }
                        min="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Prix unitaire *
                      </label>
                      <input
                        type="number"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="Prix"
                        disabled={isPurchasePriceDisabled}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {paginatedProducts.length > 0 ? (
                    <>
                      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-3 max-h-64 overflow-y-auto">
                        {paginatedProducts.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleSelectProduct(product)}
                            className={`p-2 rounded-lg border cursor-pointer transition-all ${
                              selectedProduct?.id === product.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Package
                                className={`w-4 h-4 ${selectedProduct?.id === product.id ? "text-blue-600" : "text-gray-400"}`}
                              />
                              <p className="text-xs font-semibold text-gray-900 text-center truncate w-full">
                                {product.nom}
                              </p>
                              <p className="text-xs text-gray-500 text-center">
                                {product.quantite_stock}
                              </p>
                              <p className="text-xs text-blue-600 font-medium text-center">
                                {formatCurrency(product.prix_achat || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalProducts}
                        itemsPerPage={itemsPerPage}
                        onPageChange={handlePageChange}
                        itemsPerPageOptions={[20, 40, 80, 120]}
                        onItemsPerPageChange={(n) => {
                          setItemsPerPage(n);
                          setCurrentPage(1);
                        }}
                      />
                    </>
                  ) : (
                    <p className="text-center text-gray-500 py-4 text-sm">
                      {searchQuery
                        ? "Aucun résultat"
                        : "Sélectionnez un produit"}
                    </p>
                  )}

                  <button
                    onClick={handleAddProduct}
                    disabled={
                      !selectedProduct || !purchasePrice || quantity <= 0
                    }
                    className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
              )}

              {purchaseItems.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-3 card shadow-lg">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">
                      Produits de la commande ({purchaseItems.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {purchaseItems.map((item) => (
                        <div
                          key={item.produit_id}
                          className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex justify-between items-center"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {item.nom_produit}
                            </p>
                            <p className="text-xs text-gray-600">
                              {item.quantite} x{" "}
                              {formatCurrency(item.prix_unitaire)}
                            </p>
                            <p className="font-bold text-sm text-blue-600 mt-1">
                              {formatCurrency(item.sous_total)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveProduct(item.produit_id)}
                            className="text-red-500 hover:text-red-700 p-1 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card shadow-lg sticky top-4">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                      <div className="bg--blue-600 p-2 rounded-lg">
                        <ShoppingCart className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-base font-bold text-gray-900">
                        Récapitulatif
                      </h2>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Articles</span>
                        <span className="text-lg font-bold text-gray-900">
                          {purchaseItems.reduce(
                            (sum, item) => sum + item.quantite,
                            0,
                          )}
                        </span>
                      </div>

                      <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {formatCurrency(getTotal())}
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Mode de paiement
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              value: "especes",
                              label: "Espèces",
                              icon: Banknote,
                            },
                            {
                              value: "carte",
                              label: "Carte",
                              icon: CreditCard,
                            },
                          ].map((method) => (
                            <button
                              key={method.value}
                              onClick={() =>
                                setPaymentMethod(method.value as any)
                              }
                              className={`p-2 rounded-lg border-2 transition-all ${
                                paymentMethod === method.value
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <method.icon className="w-4 h-4 mx-auto" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Montant payé
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAmountPaid(getTotal().toString())}
                            className="px-2 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
                          >
                            Total: {formatCurrency(getTotal())}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountPaid("0")}
                            className="px-2 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
                          >
                            0 (Credit)
                          </button>
                        </div>
                        <input
                          type="number"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="Montant"
                          className="w-full mt-2 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                        />
                      </div>

                      <button
                        onClick={() => setShowConfirmation(true)}
                        disabled={
                          purchaseItems.length === 0 ||
                          !amountPaid ||
                          parseFloat(amountPaid) < 0
                        }
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Valider
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Fin Tab Creation */}

          {/* Contenu Tab Historique */}
          {activeTab === "history" && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                  <History className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Historique des approvisionnements
                    </h2>
                    <p className="text-xs text-gray-600">
                      {totalHistoryItems} entrée(s)
                    </p>
                  </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        #ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Fournisseur
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Produits
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historyPaginatedPurchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                          #{purchase.id}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                          {new Date(
                            purchase.date_achat || "",
                          ).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium">
                          {purchase.fournisseur_nom}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate">
                          {purchase.produits
                            ?.map((item) => item.nom_produit)
                            .join(", ") || "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-blue-600">
                          {formatCurrency(purchase.total || 0)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              purchase.statut_paiement === "paye"
                                ? "bg-blue-100 text-blue-700"
                                : purchase.statut_paiement === "partiel"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {purchase.statut_paiement === "paye"
                              ? "Payé"
                              : purchase.statut_paiement === "partiel"
                                ? "Partiel"
                                : "Impayé"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {purchaseHistory.length === 0 && (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <h3 className="text-sm font-medium text-gray-900 mb-1">
                      Aucun approvisionnement
                    </h3>
                    <p className="text-xs text-gray-600">
                      Les approvisionnements effectués apparaîtront ici.
                    </p>
                  </div>
                )}
              </div>

              {purchaseHistory.length > 0 && (
                <div className="border-t border-gray-200">
                  <Pagination
                    currentPage={historyCurrentPage}
                    totalPages={historyTotalPages}
                    totalItems={totalHistoryItems}
                    itemsPerPage={historyItemsPerPage}
                    onPageChange={handleHistoryPageChange}
                    itemsPerPageOptions={[10, 20, 50, 100]}
                    onItemsPerPageChange={(n) => {
                      setHistoryItemsPerPage(n);
                      setHistoryCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {/* Fin Tab Historique */}
        </div>
        {/* Fin Card Tabs */}

        {showConfirmation && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Confirmer l'approvisionnement
              </h3>
              <div className="space-y-2 mb-5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Fournisseur:</span>
                  <span className="font-semibold">{selectedSupplier?.nom}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Produits:</span>
                  <span className="font-semibold">{purchaseItems.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total:</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(getTotal())}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Montant payé:</span>
                  <span className="font-semibold">{formatCurrency(parseFloat(amountPaid) || 0)}</span>
                </div>
                {(getTotal() - (parseFloat(amountPaid) || 0)) > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>Reste à payer:</span>
                    <span>{formatCurrency(getTotal() - (parseFloat(amountPaid) || 0))}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-blue-600  hover:from-blue-700 hover:to-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 text-sm"
                >
                  {processing ? "Traitement..." : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default Purchases;
