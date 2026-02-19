import React, { useEffect, useState, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  CreditCard as CardIcon,
  Check,
  ChevronRight,
  DollarSign,
  Smartphone,
  Search,
  X,
  Printer,
  FileText,
} from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuthStore } from "../store/useAuthStore";
import { Configuration } from "../types";

interface CustomerDebt {
  client_id: number;
  client_nom: string;
  telephone?: string;
  solde_du: number;
  nb_ventes_impayees: number;
  total_restant: number;
}

interface Sale {
  id: number;
  client_nom: string;
  total: number;
  montant_paye: number;
  montant_restant: number;
  statut_paiement: "paye" | "partiel" | "impaye";
  date_vente: string;
  produits: any[];
}

const CustomerDebts: React.FC = () => {
  const { user } = useAuthStore();
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [selectedClient, setSelectedClient] = useState<CustomerDebt | null>(
    null,
  );
  const [clientSales, setClientSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "especes" | "carte" | "mobile" | "virement"
  >("especes");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [config, setConfig] = useState<Configuration | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
    } catch (error) {
      console.error("Erreur chargement configuration:", error);
    }
  };

  const loadDebts = async () => {
    try {
      const data = await window.electronAPI.getCustomerDebts();
      setDebts(data);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des dettes");
    } finally {
      setLoading(false);
    }
  };

  const loadClientSales = async (clientId: number) => {
    try {
      const data = await window.electronAPI.getCustomerUnpaidSales(clientId);
      setClientSales(data);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des ventes");
    }
  };

  useEffect(() => {
    loadDebts();
    loadConfig();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientSales(selectedClient.client_id);
    }
  }, [selectedClient]);

  const handlePayment = async () => {
    if (!selectedSale) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showErrorToast("Veuillez entrer un montant valide");
      return;
    }

    if (amount > selectedSale.montant_restant) {
      showErrorToast("Le montant ne peut pas dépasser le reste à payer");
      return;
    }

    try {
      const result = await window.electronAPI.createCustomerPayment({
        vente_id: selectedSale.id,
        client_id: selectedClient?.client_id!,
        montant: amount,
        methode_paiement: paymentMethod,
        reference: paymentReference || undefined,
        commentaire: paymentComment || undefined,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      });

      showSuccessToast("Paiement enregistré avec succès");
      setShowPaymentModal(false);

      // Préparer le reçu de paiement
      setPaymentReceipt({
        montant: amount,
        methode_paiement: paymentMethod,
        reference: paymentReference,
        client_nom: selectedClient?.client_nom,
        vente_id: selectedSale.id,
        total_vente: selectedSale.total,
        ancien_restant: selectedSale.montant_restant,
        nouveau_restant: selectedSale.montant_restant - amount,
        date: new Date().toLocaleDateString("fr-FR"),
        heure: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        caissier: user?.nom,
        invoice: result?.invoice,
      });
      setShowReceipt(true);

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentComment("");
      setPaymentMethod("especes");
      setSelectedSale(null);

      loadDebts();
      if (selectedClient) {
        loadClientSales(selectedClient.client_id);
      }
    } catch (error) {
      showErrorToast("Erreur lors du paiement");
    }
  };

  const handlePayFullAmount = () => {
    if (selectedSale) {
      setPaymentAmount(selectedSale.montant_restant.toString());
    }
  };

  const totalDebts = debts.reduce((sum, debt) => sum + debt.solde_du, 0);

  const filteredDebts = debts.filter(
    (debt) =>
      debt.client_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      debt.telephone?.includes(searchQuery),
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dettes Clients
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {debts.length} client(s) avec des dettes
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
            <div className={`card ${selectedClient ? "hidden lg:block" : ""}`}>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="bg-red-100 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Clients avec dettes
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
                    key={debt.client_id}
                    onClick={() => setSelectedClient(debt)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedClient?.client_id === debt.client_id
                        ? "border-blue-500 bg-blue-50 dark:bg-gray-700"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {debt.client_nom}
                        </p>
                        {debt.telephone && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {debt.telephone}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {debt.nb_ventes_impayees} vente(s) impayée(s)
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-red-600 text-sm">
                          {formatCurrency(debt.solde_du)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
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

            {selectedClient && (
              <div className="lg:col-span-2">
                <div className="card">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedClient(null)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                      >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {selectedClient.client_nom}
                        </h2>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Dette totale:{" "}
                          {formatCurrency(selectedClient.solde_du)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto">
                    {clientSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              Vente #{sale.id}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(sale.date_vente).toLocaleDateString(
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
                              {formatCurrency(sale.total)}
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                sale.statut_paiement === "paye"
                                  ? "bg-blue-100 text-blue-700"
                                  : sale.statut_paiement === "partiel"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {sale.statut_paiement === "paye"
                                ? "Payé"
                                : sale.statut_paiement === "partiel"
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
                              {formatCurrency(sale.montant_paye)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Reste à payer
                            </p>
                            <p className="font-bold text-red-600">
                              {formatCurrency(sale.montant_restant)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Produits
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {sale.produits.length}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowPaymentModal(true);
                              setPaymentAmount(sale.montant_restant.toString());
                            }}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Encaisser
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowPaymentModal(true);
                              setPaymentAmount("");
                            }}
                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm transition-all"
                          >
                            Montant libre
                          </button>
                        </div>
                      </div>
                    ))}

                    {clientSales.length === 0 && (
                      <div className="text-center py-8">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Aucune dette en cours pour ce client
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!selectedClient && (
              <div className="lg:col-span-2 flex items-center justify-center h-96">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Sélectionnez un client
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Cliquez sur un client pour voir ses dettes en détail
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {showPaymentModal && selectedSale && selectedClient && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Effectuer un paiement
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Client:</span>
                  <span className="font-semibold">
                    {selectedClient.client_nom}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Vente:</span>
                  <span className="font-semibold">#{selectedSale.id}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total:</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedSale.total)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Reste à payer:</span>
                  <span>{formatCurrency(selectedSale.montant_restant)}</span>
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
                    {formatCurrency(selectedSale.montant_restant)})
                  </button>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    min="0"
                    max={selectedSale.montant_restant}
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
                      { value: "especes", label: "Espèces", icon: Banknote },
                      { value: "carte", label: "Carte", icon: CreditCard },
                      { value: "mobile", label: "Mobile", icon: Smartphone },
                      { value: "virement", label: "Virement", icon: CardIcon },
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value as any)}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          paymentMethod === method.value
                            ? "border-blue-500 bg-blue-50"
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
                    placeholder="N° de transaction..."
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
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-all text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Valider
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Modal reçu de paiement */}
        {showReceipt && paymentReceipt && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] flex flex-col">
              {/* Header */}
              <div className="bg-green-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Reçu de paiement</h2>
                    <p className="text-green-100 text-sm">
                      Paiement dette client
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu du reçu - Format ticket */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-700 flex justify-center">
                <div
                  ref={receiptRef}
                  className="bg-white dark:bg-gray-800 shadow-xl"
                  style={{
                    width: "80mm",
                    padding: "3mm",
                    fontFamily: "'Courier New', 'Lucida Console', monospace",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    minHeight: "150mm",
                    color: "#000",
                  }}
                >
                  {/* En-tête */}
                  <div
                    style={{
                      textAlign: "center",
                      paddingBottom: "3mm",
                      borderBottom: "1px dashed #000",
                      marginBottom: "3mm",
                    }}
                  >
                    <h1
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginBottom: "2mm",
                        textTransform: "uppercase",
                      }}
                    >
                      {config?.nom_entreprise || "Mon Entreprise"}
                    </h1>
                    {config?.telephone && (
                      <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                        Tel: {config.telephone}
                      </p>
                    )}
                    {config?.adresse && (
                      <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                        {config.adresse}
                      </p>
                    )}
                  </div>

                  {/* Titre */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: "bold",
                      margin: "3mm 0",
                      padding: "2mm 0",
                      borderBottom: "1px dashed #000",
                    }}
                  >
                    RECU DE PAIEMENT DETTE
                  </div>

                  {/* Infos */}
                  <div
                    style={{
                      marginBottom: "3mm",
                      paddingBottom: "3mm",
                      borderBottom: "1px dashed #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Date:</span>
                      <span>{paymentReceipt.date}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Heure:</span>
                      <span>{paymentReceipt.heure}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Caissier:</span>
                      <span>{paymentReceipt.caissier}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Client:</span>
                      <span>{paymentReceipt.client_nom}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Vente ref:</span>
                      <span>#{paymentReceipt.vente_id}</span>
                    </div>
                  </div>

                  {/* Détails paiement */}
                  <div
                    style={{
                      marginBottom: "3mm",
                      paddingBottom: "3mm",
                      borderBottom: "1px dashed #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Total vente:</span>
                      <span>{formatCurrency(paymentReceipt.total_vente)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Ancien solde dû:</span>
                      <span>
                        {formatCurrency(paymentReceipt.ancien_restant)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        fontWeight: "bold",
                        margin: "2mm 0",
                        paddingTop: "2mm",
                        borderTop: "1px solid #000",
                      }}
                    >
                      <span>PAIEMENT:</span>
                      <span>{formatCurrency(paymentReceipt.montant)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Mode:</span>
                      <span>{paymentReceipt.methode_paiement}</span>
                    </div>
                    {paymentReceipt.reference && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          margin: "1mm 0",
                        }}
                      >
                        <span>Réf:</span>
                        <span>{paymentReceipt.reference}</span>
                      </div>
                    )}
                  </div>

                  {/* Nouveau solde */}
                  <div
                    style={{
                      marginBottom: "3mm",
                      paddingBottom: "3mm",
                      borderBottom: "1px dashed #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        fontWeight: "bold",
                        margin: "1mm 0",
                        color:
                          paymentReceipt.nouveau_restant <= 0 ? "green" : "red",
                      }}
                    >
                      <span>RESTE A PAYER:</span>
                      <span>
                        {paymentReceipt.nouveau_restant <= 0
                          ? "0 FCFA (Soldé)"
                          : formatCurrency(paymentReceipt.nouveau_restant)}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ textAlign: "center", paddingTop: "3mm" }}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "2mm",
                      }}
                    >
                      {config?.message_pied || "Merci de votre visite !"}
                    </p>
                    <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                      --------------------------------
                    </p>
                  </div>
                </div>
              </div>

              {/* Boutons */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-3 rounded-b-2xl flex-shrink-0">
                <button
                  onClick={() => setShowReceipt(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Fermer
                </button>
                <button
                  onClick={() => {
                    if (!receiptRef.current) return;
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>Reçu de paiement</title>
                            <style>
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              @page { size: 80mm auto; margin: 2mm; }
                              body { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 12px; line-height: 1.4; color: #000; background: white; width: 76mm; margin: 0 auto; }
                            </style>
                          </head>
                          <body>
                            ${receiptRef.current.innerHTML}
                            <script>
                              window.onload = function() {
                                setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
                              };
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default CustomerDebts;
