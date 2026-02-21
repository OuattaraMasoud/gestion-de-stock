import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  Truck,
  CreditCard,
  Banknote,
  X,
  History,
  Minus,
} from "lucide-react";
import { Product, Supplier, Purchase, PurchaseItem } from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "../utils/toast";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(
    new Set(),
  );
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "especes" | "carte" | "virement" | "cheque"
  >("especes");
  const [amountPaid, setAmountPaid] = useState("");
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
        searchQuery || undefined,
      );
      setProducts(result.data);
      setTotalProducts(result.total);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des produits");
    }
  };

  const loadPurchaseHistory = async (
    page: number = historyCurrentPage,
    limit: number = historyItemsPerPage,
  ) => {
    try {
      const result = await window.electronAPI.getPurchasesPaginated(
        page,
        limit,
      );
      setPurchaseHistory(result.data);
      setTotalHistoryItems(result.total);
    } catch (error) {
      showErrorToast("Erreur lors du chargement de l'historique");
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    loadPurchaseHistory();
  }, [historyCurrentPage, historyItemsPerPage]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddToCart = (product: Product) => {
    const existingIndex = purchaseItems.findIndex(
      (item) => item.produit_id === product.id,
    );

    if (existingIndex >= 0) {
      const updatedItems = [...purchaseItems];
      updatedItems[existingIndex].quantite += 1;
      updatedItems[existingIndex].sous_total =
        updatedItems[existingIndex].quantite *
        updatedItems[existingIndex].prix_unitaire;
      setPurchaseItems(updatedItems);
    } else {
      const price = product.prix_achat || 0;
      if (price <= 0) {
        showWarningToast(
          `Le prix d'achat de "${product.nom}" n'est pas défini. Veuillez le définir dans le formulaire ci-dessous.`,
        );
      }
      setPurchaseItems([
        ...purchaseItems,
        {
          produit_id: product.id!,
          nom_produit: product.nom,
          quantite: 1,
          prix_unitaire: price,
          prix_achat_ref: price,
          sous_total: price,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveProduct(productId);
      return;
    }
    setPurchaseItems(
      purchaseItems.map((item) =>
        item.produit_id === productId
          ? {
              ...item,
              quantite: newQuantity,
              sous_total: newQuantity * item.prix_unitaire,
            }
          : item,
      ),
    );
  };

  const handleUpdatePrice = (productId: number, newPrice: number) => {
    setPurchaseItems(
      purchaseItems.map((item) =>
        item.produit_id === productId
          ? {
              ...item,
              prix_unitaire: newPrice,
              sous_total: item.quantite * newPrice,
            }
          : item,
      ),
    );
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

    // Check for zero prices
    const zeroPriceItems = purchaseItems.filter(
      (item) => item.prix_unitaire <= 0,
    );
    if (zeroPriceItems.length > 0) {
      showErrorToast(
        `Certains produits n'ont pas de prix d'achat: ${zeroPriceItems.map((i) => i.nom_produit).join(", ")}`,
      );
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
      showSuccessToast("Approvisionnement enregistré avec succès");

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

  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const historyTotalPages = Math.ceil(totalHistoryItems / historyItemsPerPage);

  return (
    <ProtectedRoute>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Approvisionnements
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Gérer les entrées de stock
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="card mb-4">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
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

          {/* Creation Tab */}
          {activeTab === "creation" && (
            <div className="p-4">
              {!selectedSupplier ? (
                <div className="text-center py-8">
                  <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-4">
                    Sélectionnez un fournisseur
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
                    {suppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        onClick={() => setSelectedSupplier(supplier)}
                        className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                      >
                        <p className="font-semibold">{supplier.nom}</p>
                        {supplier.telephone && (
                          <p className="text-xs text-gray-500">
                            {supplier.telephone}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Products Panel */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSupplier(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <span className="font-semibold text-blue-600">
                          {selectedSupplier.nom}
                        </span>
                      </div>
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Rechercher un produit..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Ajouter la sélection */}
                    {selectedProductIds.size > 0 && (
                      <button
                        onClick={() => {
                          selectedProductIds.forEach((id) => {
                            const product = products.find((p) => p.id === id);
                            if (product) handleAddToCart(product);
                          });
                          setSelectedProductIds(new Set());
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Ajouter la sélection ({selectedProductIds.size})
                      </button>
                    )}

                    {/* Products List */}
                    <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="py-2 px-3 w-8">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.size === products.length && products.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds(new Set(products.map((p) => p.id!)));
                                  } else {
                                    setSelectedProductIds(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="py-2 px-3 font-medium">Nom</th>
                            <th className="py-2 px-3 font-medium text-right w-20">Stock</th>
                            <th className="py-2 px-3 font-medium text-right w-28">Prix achat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {products.map((product) => {
                            const cartItem = purchaseItems.find((item) => item.produit_id === product.id);
                            const isSelected = selectedProductIds.has(product.id!);
                            return (
                              <tr
                                key={product.id}
                                className={`transition-colors cursor-pointer ${
                                  cartItem
                                    ? "bg-blue-50 hover:bg-blue-100"
                                    : isSelected
                                      ? "bg-blue-50/60 hover:bg-blue-100/60"
                                      : "hover:bg-gray-50"
                                }`}
                                onClick={() => {
                                  setSelectedProductIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(product.id!)) next.delete(product.id!);
                                    else next.add(product.id!);
                                    return next;
                                  });
                                }}
                              >
                                <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setSelectedProductIds((prev) => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(product.id!);
                                        else next.delete(product.id!);
                                        return next;
                                      });
                                    }}
                                    className="rounded"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`font-medium ${cartItem ? "text-blue-700" : "text-gray-800"}`}>
                                    {product.nom}
                                  </span>
                                  {cartItem && (
                                    <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                                      {cartItem.quantite} ajouté{cartItem.quantite > 1 ? "s" : ""}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right text-gray-600">{product.quantite_stock}</td>
                                <td className="py-2 px-3 text-right font-medium text-blue-600">
                                  {formatCurrency(product.prix_achat || 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {products.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        Aucun produit trouvé
                      </div>
                    )}

                    {/* Pagination */}
                    {totalProducts > itemsPerPage && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalProducts}
                        itemsPerPage={itemsPerPage}
                        onPageChange={(p) => {
                          setCurrentPage(p);
                          setSelectedProductIds(new Set());
                        }}
                        itemsPerPageOptions={[20, 40, 80]}
                        onItemsPerPageChange={(n) => {
                          setItemsPerPage(n);
                          setCurrentPage(1);
                          setSelectedProductIds(new Set());
                        }}
                      />
                    )}
                  </div>

                  {/* Cart */}
                  <div className="card sticky top-4">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                      <h2 className="font-bold">
                        Panier ({purchaseItems.length})
                      </h2>
                    </div>

                    {purchaseItems.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        Aucun article
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                        {purchaseItems.map((item) => (
                          <div
                            key={item.produit_id}
                            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                          >
                            {/* Nom + supprimer */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-medium text-sm leading-snug break-words min-w-0 flex-1">
                                {item.nom_produit}
                              </span>
                              <button
                                onClick={() => handleRemoveProduct(item.produit_id)}
                                className="text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Qté + Prix input */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleUpdateQuantity(item.produit_id, item.quantite - 1)}
                                  className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center font-bold text-sm">
                                  {item.quantite}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.produit_id, item.quantite + 1)}
                                  className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center hover:bg-blue-700"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <input
                                  type="number"
                                  value={item.prix_unitaire}
                                  onChange={(e) => handleUpdatePrice(item.produit_id, parseFloat(e.target.value) || 0)}
                                  className={`w-full px-2 py-1 text-sm border rounded text-right ${
                                    item.prix_achat_ref && item.prix_achat_ref > 0 && item.prix_unitaire !== item.prix_achat_ref
                                      ? "border-orange-400 bg-orange-50"
                                      : "border-gray-200"
                                  }`}
                                  min="0"
                                />
                                {item.prix_achat_ref != null && item.prix_achat_ref > 0 && (
                                  <span className={`text-[10px] ${item.prix_unitaire !== item.prix_achat_ref ? "text-orange-600" : "text-gray-500"}`}>
                                    Ref: {formatCurrency(item.prix_achat_ref)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-right font-bold text-blue-600 text-sm mt-1.5">
                              {formatCurrency(item.sous_total)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {purchaseItems.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <div className="flex justify-between text-xl font-bold">
                          <span>Total:</span>
                          <span className="text-blue-600">
                            {formatCurrency(getTotal())}
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
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
                          <label className="block text-xs font-medium mb-1">
                            Montant payé
                          </label>
                          <div className="flex gap-2 mb-2">
                            <button
                              onClick={() =>
                                setAmountPaid(getTotal().toString())
                              }
                              className="flex-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                            >
                              Total
                            </button>
                            <button
                              onClick={() => setAmountPaid("0")}
                              className="flex-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                            >
                              0 (Crédit)
                            </button>
                          </div>
                          <input
                            type="number"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="w-full px-3 py-2 border-2 rounded-lg"
                            min="0"
                          />
                        </div>

                        <button
                          onClick={() => setShowConfirmation(true)}
                          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                        >
                          Valider
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        #
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
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchaseHistory.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm">#{purchase.id}</td>
                        <td className="px-3 py-2 text-sm">
                          {new Date(
                            purchase.date_achat || "",
                          ).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium">
                          {purchase.fournisseur_nom}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 max-w-xs truncate">
                          {purchase.produits
                            ?.map((p) => p.nom_produit)
                            .join(", ") || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm font-bold text-blue-600 text-right">
                          {formatCurrency(purchase.total || 0)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              purchase.statut_paiement === "paye"
                                ? "bg-green-100 text-green-700"
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
                  <div className="text-center py-8 text-gray-500">
                    Aucun approvisionnement
                  </div>
                )}
              </div>

              {purchaseHistory.length > 0 && (
                <Pagination
                  currentPage={historyCurrentPage}
                  totalPages={historyTotalPages}
                  totalItems={totalHistoryItems}
                  itemsPerPage={historyItemsPerPage}
                  onPageChange={setHistoryCurrentPage}
                  itemsPerPageOptions={[10, 20, 50]}
                  onItemsPerPageChange={(n) => {
                    setHistoryItemsPerPage(n);
                    setHistoryCurrentPage(1);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-5">
              <h3 className="text-xl font-bold mb-4">
                Confirmer l'approvisionnement
              </h3>
              <div className="space-y-2 mb-5 text-sm">
                <div className="flex justify-between">
                  <span>Fournisseur:</span>
                  <span className="font-semibold">{selectedSupplier?.nom}</span>
                </div>
                <div className="flex justify-between">
                  <span>Produits:</span>
                  <span>{purchaseItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(getTotal())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Montant payé:</span>
                  <span>{formatCurrency(parseFloat(amountPaid) || 0)}</span>
                </div>
                {getTotal() - (parseFloat(amountPaid) || 0) > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>Reste à payer:</span>
                    <span>
                      {formatCurrency(
                        getTotal() - (parseFloat(amountPaid) || 0),
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
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
