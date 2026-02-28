import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  CreditCard as CardIcon,
  Check,
  ChevronRight,
  DollarSign,
  FileText,
  Search,
  X,
} from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuthStore } from "../store/useAuthStore";

interface SupplierDebt {
  fournisseur_id: number;
  fournisseur_nom: string;
  telephone?: string;
  solde_du: number;
  nb_achats_impayes: number;
  total_restant: number;
}

interface Purchase {
  id: number;
  fournisseur_nom: string;
  total: number;
  montant_paye: number;
  montant_restant: number;
  statut_paiement: "paye" | "partiel" | "impaye";
  date_achat: string;
  produits: any[];
}

const SupplierDebts: React.FC = () => {
  const { user } = useAuthStore();
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDebt | null>(
    null,
  );
  const [supplierPurchases, setSupplierPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "especes" | "carte" | "virement" | "cheque"
  >("especes");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Mode paiement par montant global
  const [paymentMode, setPaymentMode] = useState<"by_purchase" | "by_amount">(
    "by_purchase",
  );
  const [globalPaymentAmount, setGlobalPaymentAmount] = useState("");
  const [globalPaymentMethod, setGlobalPaymentMethod] = useState<
    "especes" | "carte" | "virement" | "cheque"
  >("especes");

  const loadDebts = async () => {
    try {
      const data = await window.electronAPI.getSupplierDebts();
      setDebts(data);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des dettes");
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierPurchases = async (supplierId: number) => {
    try {
      const data =
        await window.electronAPI.getSupplierUnpaidPurchases(supplierId);
      setSupplierPurchases(data);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des achats");
    }
  };

  useEffect(() => {
    loadDebts();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierPurchases(selectedSupplier.fournisseur_id);
    }
  }, [selectedSupplier]);

  const handlePayment = async () => {
    if (!selectedPurchase) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showErrorToast("Veuillez entrer un montant valide");
      return;
    }

    if (amount > selectedPurchase.montant_restant) {
      showErrorToast("Le montant ne peut pas dépasser le reste à payer");
      return;
    }

    try {
      await window.electronAPI.createSupplierPayment({
        achat_id: selectedPurchase.id,
        fournisseur_id: selectedSupplier?.fournisseur_id!,
        montant: amount,
        methode_paiement: paymentMethod,
        reference: paymentReference || undefined,
        commentaire: paymentComment || undefined,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      });

      showSuccessToast("Paiement enregistré avec succès");
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentComment("");
      setPaymentMethod("especes");
      setSelectedPurchase(null);

      loadDebts();
      if (selectedSupplier) {
        loadSupplierPurchases(selectedSupplier.fournisseur_id);
      }
    } catch (error) {
      showErrorToast("Erreur lors du paiement");
    }
  };

  const handleGlobalPayment = async () => {
    if (!selectedSupplier) return;
    const amount = parseFloat(globalPaymentAmount);
    if (!amount || amount <= 0) {
      showErrorToast("Veuillez entrer un montant valide");
      return;
    }
    if (amount > selectedSupplier.solde_du) {
      showErrorToast("Le montant dépasse la dette totale du fournisseur");
      return;
    }
    try {
      await window.electronAPI.paySupplierDebtByAmount(
        selectedSupplier.fournisseur_id,
        amount,
        globalPaymentMethod,
        user?.id,
        user?.nom,
      );
      showSuccessToast("Paiement global enregistré avec succès");
      setShowPaymentModal(false);
      setGlobalPaymentAmount("");
      setGlobalPaymentMethod("especes");
      setPaymentMode("by_purchase");
      const updatedDebts = await window.electronAPI.getSupplierDebts();
      setDebts(updatedDebts);
      const updated = updatedDebts.find(
        (d: SupplierDebt) =>
          d.fournisseur_id === selectedSupplier.fournisseur_id,
      );
      if (updated) setSelectedSupplier(updated);
      loadSupplierPurchases(selectedSupplier.fournisseur_id);
    } catch (error: any) {
      showErrorToast(error.message || "Erreur lors du paiement");
    }
  };

  const handlePayFullAmount = () => {
    if (selectedPurchase) {
      setPaymentAmount(selectedPurchase.montant_restant.toString());
    }
  };

  const totalDebts = debts.reduce((sum, debt) => sum + debt.solde_du, 0);

  const filteredDebts = debts.filter(
    (debt) =>
      debt.fournisseur_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      debt.telephone?.includes(searchQuery),
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dettes Fournisseurs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {debts.length} fournisseur(s) avec des dettes
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Total des dettes
            </p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalDebts)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className={`card ${selectedSupplier ? "hidden lg:block" : ""}`}
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="bg-red-100 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Fournisseurs avec dettes
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {filteredDebts.length} résultat(s)
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {filteredDebts.map((debt) => (
                  <div
                    key={debt.fournisseur_id}
                    onClick={() => setSelectedSupplier(debt)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSupplier?.fournisseur_id === debt.fournisseur_id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-black truncate">
                          {debt.fournisseur_nom}
                        </p>
                        {debt.telephone && (
                          <p className="text-xs text-gray-600 dark:text-black">
                            {debt.telephone}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-black mt-1">
                          {debt.nb_achats_impayes} achat(s) impayé(s)
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-red-600 text-sm">
                          {formatCurrency(debt.solde_du)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-black ml-2" />
                    </div>
                  </div>
                ))}

                {filteredDebts.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {searchQuery ? "Aucun résultat" : "Aucune dette trouvée"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selectedSupplier && (
              <div className="lg:col-span-2">
                <div className="card">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedSupplier(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                      >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {selectedSupplier.fournisseur_nom}
                        </h2>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Dette totale:{" "}
                          {formatCurrency(selectedSupplier.solde_du)}
                        </p>
                      </div>
                    </div>
                    {/* Bouton paiement global */}
                    <button
                      onClick={() => {
                        setPaymentMode("by_amount");
                        setShowPaymentModal(true);
                        setSelectedPurchase(null);
                      }}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Payer globalement
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                    {supplierPurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              Commande #{purchase.id}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(purchase.date_achat).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 dark:text-white">
                              {formatCurrency(purchase.total)}
                            </p>
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
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Payé
                            </p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(purchase.montant_paye)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Reste à payer
                            </p>
                            <p className="font-bold text-red-600">
                              {formatCurrency(purchase.montant_restant)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Produits
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {purchase.produits.length}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPurchase(purchase);
                              setPaymentMode("by_purchase");
                              setShowPaymentModal(true);
                              setPaymentAmount(
                                purchase.montant_restant.toString(),
                              );
                            }}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Payer
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPurchase(purchase);
                              setPaymentMode("by_purchase");
                              setShowPaymentModal(true);
                              setPaymentAmount("");
                            }}
                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-black rounded-lg font-semibold text-sm transition-all"
                          >
                            Montant libre
                          </button>
                        </div>
                      </div>
                    ))}

                    {supplierPurchases.length === 0 && (
                      <div className="text-center py-8">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Aucune dette en cours pour ce fournisseur
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!selectedSupplier && (
              <div className="lg:col-span-2 flex items-center justify-center h-96">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Sélectionnez un fournisseur
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Cliquez sur un fournisseur pour voir ses dettes en détail
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal paiement */}
        {showPaymentModal && selectedSupplier && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {paymentMode === "by_purchase"
                    ? "Paiement par achat"
                    : "Paiement global"}
                </h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPurchase(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Onglets de mode */}
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
                <button
                  onClick={() => {
                    setPaymentMode("by_purchase");
                    setSelectedPurchase(null);
                  }}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${
                    paymentMode === "by_purchase"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  Par achat
                </button>
                <button
                  onClick={() => {
                    setPaymentMode("by_amount");
                    setSelectedPurchase(null);
                  }}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${
                    paymentMode === "by_amount"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  Par montant global
                </button>
              </div>

              {paymentMode === "by_purchase" && selectedPurchase ? (
                /* Mode paiement par achat */
                <>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Fournisseur:</span>
                      <span className="font-semibold">
                        {selectedSupplier.fournisseur_nom}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Commande:</span>
                      <span className="font-semibold">
                        #{selectedPurchase.id}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Total:</span>
                      <span className="font-semibold">
                        {formatCurrency(selectedPurchase.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Reste à payer:</span>
                      <span>
                        {formatCurrency(selectedPurchase.montant_restant)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Montant
                      </label>
                      <button
                        onClick={handlePayFullAmount}
                        className="w-full mb-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm transition-all"
                      >
                        Payer le reste (
                        {formatCurrency(selectedPurchase.montant_restant)})
                      </button>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        min="0"
                        max={selectedPurchase.montant_restant}
                        step="0.01"
                        placeholder="Montant"
                        className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Mode de paiement
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            value: "especes",
                            label: "Espèces",
                            icon: Banknote,
                          },
                          { value: "carte", label: "Carte", icon: CreditCard },
                          {
                            value: "virement",
                            label: "Virement",
                            icon: CardIcon,
                          },
                          { value: "cheque", label: "Chèque", icon: FileText },
                        ].map((method) => (
                          <button
                            key={method.value}
                            onClick={() =>
                              setPaymentMethod(method.value as any)
                            }
                            className={`p-2 rounded-lg border-2 transition-all ${
                              paymentMethod === method.value
                                ? "border-blue-500 bg-blue-50 dark:bg-gray-700"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                            }`}
                          >
                            <method.icon className="w-4 h-4 mx-auto" />
                            <span className="text-xs block mt-1">
                              {method.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Référence (optionnel)
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="N° de transaction, chèque..."
                        className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Commentaire (optionnel)
                      </label>
                      <textarea
                        value={paymentComment}
                        onChange={(e) => setPaymentComment(e.target.value)}
                        rows={2}
                        placeholder="Note..."
                        className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setShowPaymentModal(false);
                          setSelectedPurchase(null);
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-black rounded-lg font-semibold transition-all text-sm"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handlePayment}
                        disabled={
                          !paymentAmount || parseFloat(paymentAmount) <= 0
                        }
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Valider
                      </button>
                    </div>
                  </div>
                </>
              ) : paymentMode === "by_amount" ? (
                /* Mode paiement par montant global */
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Fournisseur:</span>
                      <span className="font-semibold">
                        {selectedSupplier.fournisseur_nom}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Dette totale:</span>
                      <span>{formatCurrency(selectedSupplier.solde_du)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Montant à payer
                    </label>
                    <button
                      onClick={() =>
                        setGlobalPaymentAmount(
                          selectedSupplier.solde_du.toString(),
                        )
                      }
                      className="w-full mb-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium text-sm transition-all"
                    >
                      Payer tout ({formatCurrency(selectedSupplier.solde_du)})
                    </button>
                    <input
                      type="number"
                      value={globalPaymentAmount}
                      onChange={(e) => setGlobalPaymentAmount(e.target.value)}
                      min="0"
                      max={selectedSupplier.solde_du}
                      step="0.01"
                      placeholder="Montant global"
                      className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Le montant sera réparti automatiquement sur les achats les
                      plus anciens
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Mode de paiement
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "especes", label: "Espèces", icon: Banknote },
                        { value: "carte", label: "Carte", icon: CreditCard },
                        {
                          value: "virement",
                          label: "Virement",
                          icon: CardIcon,
                        },
                        { value: "cheque", label: "Chèque", icon: FileText },
                      ].map((method) => (
                        <button
                          key={method.value}
                          onClick={() =>
                            setGlobalPaymentMethod(method.value as any)
                          }
                          className={`p-2 rounded-lg border-2 transition-all ${
                            globalPaymentMethod === method.value
                              ? "border-blue-500 bg-blue-50 dark:bg-gray-700"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <method.icon className="w-4 h-4 mx-auto" />
                          <span className="text-xs block mt-1">
                            {method.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentMode("by_purchase");
                      }}
                      className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-black rounded-lg font-semibold transition-all text-sm"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleGlobalPayment}
                      disabled={
                        !globalPaymentAmount ||
                        parseFloat(globalPaymentAmount) <= 0
                      }
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Valider
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode by_purchase mais aucun achat sélectionné */
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">
                    Sélectionnez un achat dans la liste ou utilisez le mode
                    "Paiement global"
                  </p>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default SupplierDebts;
