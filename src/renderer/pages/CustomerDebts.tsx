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
  FileText,
  ListFilter,
  Package,
} from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { showSuccessToast, showErrorToast } from "../utils/toast";
import {
  PrintData,
  generateA4HTML,
  generateA5HTML,
  openPrintWindow,
} from "../utils/printTemplates";
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
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [paymentMode, setPaymentMode] = useState<"by_sale" | "by_amount">(
    "by_sale",
  );
  const [globalPaymentAmount, setGlobalPaymentAmount] = useState("");
  const [globalPaymentMethod, setGlobalPaymentMethod] = useState<
    "especes" | "carte" | "mobile" | "virement"
  >("especes");
  const [showCreditSalesModal, setShowCreditSalesModal] = useState(false);
  const [showProductsPopup, setShowProductsPopup] = useState(false);
  const [popupSale, setPopupSale] = useState<any>(null);

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
      const logo = await window.electronAPI.getCompanyLogo();
      setLogoBase64(logo);
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
        client_telephone: selectedClient?.telephone,
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
        produits: selectedSale.produits || [],
      });
      setShowReceipt(true);

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentComment("");
      setPaymentMethod("especes");
      setSelectedSale(null);

      const updatedDebts = await window.electronAPI.getCustomerDebts();
      setDebts(updatedDebts);
      const updatedClient = updatedDebts.find(
        (d: CustomerDebt) => d.client_id === selectedClient?.client_id,
      );
      if (updatedClient) {
        setSelectedClient(updatedClient);
      }
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

  const handlePaymentByAmount = async () => {
    if (!selectedClient) return;
    const amount = parseFloat(globalPaymentAmount);
    if (!amount || amount <= 0) {
      showErrorToast("Veuillez entrer un montant valide");
      return;
    }
    if (amount > selectedClient.solde_du) {
      showErrorToast("Le montant dépasse la dette totale du client");
      return;
    }
    try {
      await window.electronAPI.payClientDebtByAmount(
        selectedClient.client_id,
        amount,
        globalPaymentMethod,
        user?.id,
        user?.nom,
      );
      showSuccessToast("Paiement enregistré avec succès");
      setShowPaymentModal(false);
      setGlobalPaymentAmount("");
      setGlobalPaymentMethod("especes");
      setPaymentMode("by_sale");
      const updatedDebts = await window.electronAPI.getCustomerDebts();
      setDebts(updatedDebts);
      const updatedClient = updatedDebts.find(
        (d: CustomerDebt) => d.client_id === selectedClient?.client_id,
      );
      if (updatedClient) {
        setSelectedClient(updatedClient);
      }
      loadClientSales(selectedClient.client_id);
    } catch (error: any) {
      showErrorToast(error.message || "Erreur lors du paiement");
    }
  };

  const printDebtPaymentA5 = (receipt: any) => {
    const inv = receipt.invoice || {};
    let articles: any[] = [];
    if (Array.isArray(inv.articles) && inv.articles.length > 0) {
      articles = inv.articles;
    } else if (Array.isArray(receipt.produits) && receipt.produits.length > 0) {
      articles = receipt.produits.map((p: any) => ({
        designation: p.nom_produit,
        quantite: p.quantite,
        prixUnitaire: p.prix_unitaire,
        total: p.sous_total ?? p.quantite * p.prix_unitaire,
      }));
    }

    const data: PrintData = {
      numero: inv.numero || "-",
      date: inv.date_facture || receipt.date || "",
      document_type: "RECU",
      client_nom: receipt.client_nom || "Client",
      client_telephone: receipt.client_telephone,
      client_email: receipt.client_email,
      articles: articles.map((a: any) => ({
        designation: a.designation,
        quantite: a.quantite,
        prix_unitaire: a.prixUnitaire ?? 0,
        total: a.total ?? 0,
      })),
      total_ttc: inv.total_ttc ?? 0,
      montant_paye: inv.montant_paye ?? 0,
      montant_restant: inv.montant_restant ?? 0,
      show_fiscal_footer: true,
    };

    const html = generateA5HTML(data, config, logoBase64, null);
    openPrintWindow(html);
  };

  const printInvoiceA4AfterSettlement = () => {
    if (!paymentReceipt) return;
    const receipt = paymentReceipt;
    const inv = receipt.invoice || {};
    let articles: any[] = [];
    if (Array.isArray(inv.articles) && inv.articles.length > 0) {
      articles = inv.articles;
    } else if (Array.isArray(receipt.produits) && receipt.produits.length > 0) {
      articles = receipt.produits.map((p: any) => ({
        designation:
          p.nom_produit || p.nom || p.designation || `Produit #${p.produit_id}`,
        quantite: p.quantite,
        prixUnitaire: p.prix_unitaire,
        total: p.sous_total ?? p.quantite * p.prix_unitaire,
      }));
    }

    const totalTTC = inv.total_ttc ?? receipt.total_vente ?? 0;
    const montantPaye = inv.montant_paye ?? receipt.total_vente ?? 0;

    const data: PrintData = {
      numero: inv.numero || `#${receipt.vente_id}`,
      date: inv.date_facture || receipt.date || "",
      document_type: "RECU",
      client_nom: receipt.client_nom || "Client",
      client_telephone: receipt.client_telephone,
      vendeur: receipt.caissier,
      articles: articles.map((a: any) => ({
        designation: a.designation,
        quantite: a.quantite,
        prix_unitaire: a.prixUnitaire ?? 0,
        total: a.total ?? 0,
      })),
      total_ttc: totalTTC,
      montant_paye: montantPaye,
      montant_restant: 0,
      show_fiscal_footer: true,
    };

    const html = generateA4HTML(data, config, logoBase64, null);
    openPrintWindow(html);
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPaymentMode("by_amount");
                          setSelectedSale(null);
                          setShowPaymentModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm font-medium transition-all"
                      >
                        <DollarSign className="w-4 h-4" />
                        Payer global
                      </button>
                      <button
                        onClick={() => setShowCreditSalesModal(true)}
                        className="flex items-center gap-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium transition-all"
                      >
                        <ListFilter className="w-4 h-4" />À crédit
                      </button>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopupSale(sale);
                              setShowProductsPopup(true);
                            }}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm flex items-center gap-1"
                          >
                            <Package className="w-4 h-4" />
                            Produits ({sale.produits.length})
                          </button>
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

        {showPaymentModal &&
          selectedClient &&
          (selectedSale || paymentMode === "by_amount") && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Effectuer un paiement
                  </h3>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentMode("by_sale");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Toggle mode */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden text-sm">
                  <button
                    onClick={() => setPaymentMode("by_sale")}
                    className={`flex-1 py-2 font-medium transition-all ${paymentMode === "by_sale" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                  >
                    Par vente précise
                  </button>
                  <button
                    onClick={() => setPaymentMode("by_amount")}
                    className={`flex-1 py-2 font-medium transition-all ${paymentMode === "by_amount" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50"}`}
                  >
                    Par montant global
                  </button>
                </div>

                {paymentMode === "by_sale" && selectedSale && (
                  <>
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Client:</span>
                        <span className="font-semibold">
                          {selectedClient.client_nom}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Vente:</span>
                        <span className="font-semibold">
                          #{selectedSale.id}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Total:</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedSale.total)}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Reste à payer:</span>
                        <span>
                          {formatCurrency(selectedSale.montant_restant)}
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
                            {
                              value: "mobile",
                              label: "Mobile",
                              icon: Smartphone,
                            },
                            {
                              value: "virement",
                              label: "Virement",
                              icon: CardIcon,
                            },
                          ].map((method) => (
                            <button
                              key={method.value}
                              onClick={() =>
                                setPaymentMethod(method.value as any)
                              }
                              className={`p-2 rounded-lg border-2 transition-all ${paymentMethod === method.value ? "border-blue-500 bg-blue-50" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
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

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => {
                            setShowPaymentModal(false);
                            setPaymentMode("by_sale");
                          }}
                          className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-all text-sm"
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
                )}

                {paymentMode === "by_amount" && (
                  <div className="space-y-4">
                    <div className="space-y-2 mb-2 text-sm">
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Client:</span>
                        <span className="font-semibold">
                          {selectedClient.client_nom}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Dette totale:</span>
                        <span>{formatCurrency(selectedClient.solde_du)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Le montant sera distribué automatiquement sur les ventes
                        les plus anciennes.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Montant à payer
                      </label>
                      <input
                        type="number"
                        value={globalPaymentAmount}
                        onChange={(e) => setGlobalPaymentAmount(e.target.value)}
                        min="0"
                        max={selectedClient.solde_du}
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
                            value: "mobile",
                            label: "Mobile",
                            icon: Smartphone,
                          },
                          {
                            value: "virement",
                            label: "Virement",
                            icon: CardIcon,
                          },
                        ].map((method) => (
                          <button
                            key={method.value}
                            onClick={() =>
                              setGlobalPaymentMethod(method.value as any)
                            }
                            className={`p-2 rounded-lg border-2 transition-all ${globalPaymentMethod === method.value ? "border-blue-500 bg-blue-50" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
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
                          setPaymentMode("by_sale");
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-all text-sm"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handlePaymentByAmount}
                        disabled={
                          !globalPaymentAmount ||
                          parseFloat(globalPaymentAmount) <= 0
                        }
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Valider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        {/* Modal reçu de paiement */}
        {showReceipt && paymentReceipt && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] flex flex-col">
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

              {/* Contenu du reçu - Format A5 */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-600 flex justify-center">
                <div
                  ref={receiptRef}
                  className="bg-white shadow-xl dark:text-gray-900"
                  style={{
                    width: "148mm",
                    minHeight: "200mm",
                    padding: "10mm",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    fontSize: "11px",
                    lineHeight: "1.4",
                    color: "#333",
                    transform: "scale(0.85)",
                    transformOrigin: "top center",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: "10px",
                      borderBottom: "2px solid #2563eb",
                      marginBottom: "15px",
                    }}
                  >
                    <div>
                      {logoBase64 && (
                        <img
                          src={logoBase64}
                          alt="Logo"
                          style={{
                            maxHeight: "60px",
                            maxWidth: "120px",
                            marginBottom: "5px",
                            objectFit: "contain",
                          }}
                        />
                      )}
                      <h1
                        style={{
                          fontSize: "16px",
                          color: "#1e40af",
                          marginBottom: "3px",
                          fontWeight: "bold",
                        }}
                      >
                        {config?.nom_entreprise || "Mon Entreprise"}
                      </h1>
                      {config?.description_entreprise && (
                        <p
                          style={{
                            fontSize: "10px",
                            color: "#666",
                            fontStyle: "italic",
                            marginBottom: "3px",
                          }}
                        >
                          {config.description_entreprise}
                        </p>
                      )}
                      {config?.adresse && (
                        <p
                          style={{
                            fontSize: "9px",
                            color: "#555",
                            margin: "1px 0",
                          }}
                        >
                          {config.adresse}
                          {config?.ville ? ", " + config.ville : ""}
                        </p>
                      )}
                      {config?.telephone && (
                        <p
                          style={{
                            fontSize: "9px",
                            color: "#555",
                            margin: "1px 0",
                          }}
                        >
                          Tel: {config.telephone}
                          {config?.telephone2 ? " / " + config.telephone2 : ""}
                        </p>
                      )}
                      {config?.email && (
                        <p
                          style={{
                            fontSize: "9px",
                            color: "#555",
                            margin: "1px 0",
                          }}
                        >
                          {config.email}
                        </p>
                      )}
                      {config?.nif && (
                        <p
                          style={{
                            fontSize: "9px",
                            color: "#555",
                            margin: "1px 0",
                          }}
                        >
                          NIF: {config.nif}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        background: "#22c55e",
                        color: "white",
                        padding: "6px 15px",
                        borderRadius: "4px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                        RECU
                      </div>
                      <div style={{ fontSize: "10px" }}>Paiement Dette</div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "15px",
                    }}
                  >
                    <div
                      style={{
                        width: "48%",
                        background: "#f8fafc",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "9px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.5px",
                          marginBottom: "5px",
                          paddingBottom: "4px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Client
                      </h3>
                      <p
                        style={{
                          margin: "2px 0",
                          fontWeight: "bold",
                          color: "#1e293b",
                        }}
                      >
                        {paymentReceipt.client_nom}
                      </p>
                      {paymentReceipt.client_telephone && (
                        <p style={{ margin: "2px 0", fontSize: "10px" }}>
                          Tel: {paymentReceipt.client_telephone}
                        </p>
                      )}
                      {paymentReceipt.client_email && (
                        <p style={{ margin: "2px 0", fontSize: "10px" }}>
                          Email: {paymentReceipt.client_email}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        width: "48%",
                        background: "#f8fafc",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "9px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.5px",
                          marginBottom: "5px",
                          paddingBottom: "4px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Details
                      </h3>
                      <p style={{ margin: "2px 0", fontSize: "10px" }}>
                        <strong>Date:</strong> {paymentReceipt.date}
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "10px" }}>
                        <strong>Heure:</strong> {paymentReceipt.heure}
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "10px" }}>
                        <strong>Caissier:</strong> {paymentReceipt.caissier}
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "10px" }}>
                        <strong>Vente:</strong> #{paymentReceipt.vente_id}
                      </p>
                    </div>
                  </div>

                  {/* Table des articles si disponibles */}
                  {((paymentReceipt?.invoice?.articles &&
                    paymentReceipt.invoice.articles.length > 0) ||
                    (paymentReceipt?.produits &&
                      paymentReceipt.produits.length > 0)) && (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        margin: "10px 0",
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              background: "#1e40af",
                              color: "white",
                              padding: "6px 8px",
                              textAlign: "left",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              borderRadius: "4px 0 0 0",
                            }}
                          >
                            Designation
                          </th>
                          <th
                            style={{
                              background: "#1e40af",
                              color: "white",
                              padding: "6px 8px",
                              textAlign: "right",
                              fontSize: "9px",
                              textTransform: "uppercase",
                            }}
                          >
                            Qte
                          </th>
                          <th
                            style={{
                              background: "#1e40af",
                              color: "white",
                              padding: "6px 8px",
                              textAlign: "right",
                              fontSize: "9px",
                              textTransform: "uppercase",
                            }}
                          >
                            Prix U.
                          </th>
                          <th
                            style={{
                              background: "#1e40af",
                              color: "white",
                              padding: "6px 8px",
                              textAlign: "right",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              borderRadius: "0 4px 0 0",
                            }}
                          >
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paymentReceipt?.invoice?.articles?.length > 0
                          ? paymentReceipt.invoice.articles
                          : (paymentReceipt?.produits || []).map((p: any) => ({
                              designation: p.nom_produit,
                              quantite: p.quantite,
                              prixUnitaire: p.prix_unitaire,
                              total:
                                p.sous_total ?? p.quantite * p.prix_unitaire,
                            }))
                        ).map((article: any, index: number) => (
                          <tr
                            key={index}
                            style={{
                              background: index % 2 === 0 ? "white" : "#f8fafc",
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: "10px",
                              }}
                            >
                              {article.designation}
                            </td>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: "10px",
                                textAlign: "right",
                              }}
                            >
                              {article.quantite}
                            </td>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: "10px",
                                textAlign: "right",
                              }}
                            >
                              {formatCurrency(article.prixUnitaire)}
                            </td>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: "10px",
                                textAlign: "right",
                                fontWeight: "500",
                              }}
                            >
                              {formatCurrency(article.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Totaux */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "220px",
                        background: "#f0f9ff",
                        borderRadius: "6px",
                        border: "1px solid #bae6fd",
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          fontSize: "10px",
                        }}
                      >
                        <span>Total vente:</span>
                        <span>
                          {formatCurrency(paymentReceipt.total_vente)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          fontSize: "10px",
                        }}
                      >
                        <span>Ancien solde:</span>
                        <span>
                          {formatCurrency(paymentReceipt.ancien_restant)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 0",
                          fontSize: "14px",
                          fontWeight: "bold",
                          color: "#1e40af",
                          borderTop: "2px solid #1e40af",
                          marginTop: "4px",
                        }}
                      >
                        <span>PAIEMENT:</span>
                        <span>{formatCurrency(paymentReceipt.montant)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "10px",
                          margin: "2px 0",
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
                            fontSize: "10px",
                            margin: "2px 0",
                          }}
                        >
                          <span>Réf:</span>
                          <span>{paymentReceipt.reference}</span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          fontWeight: "bold",
                          marginTop: "6px",
                          paddingTop: "6px",
                          borderTop: "1px solid #e2e8f0",
                          color:
                            paymentReceipt.nouveau_restant <= 0
                              ? "#16a34a"
                              : "#dc2626",
                        }}
                      >
                        <span>RESTE:</span>
                        <span>
                          {paymentReceipt.nouveau_restant <= 0
                            ? `0 ${config?.devise || "FCFA"} (Soldé)`
                            : formatCurrency(paymentReceipt.nouveau_restant)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      marginTop: "20px",
                      textAlign: "center",
                      paddingTop: "10px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: "500",
                        color: "#1e40af",
                        marginBottom: "3px",
                      }}
                    >
                      {config?.message_pied || "Merci de votre confiance !"}
                    </p>
                    {config?.support_text && (
                      <p style={{ fontSize: "9px", color: "#94a3b8" }}>
                        {config.support_text}
                      </p>
                    )}
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "8px",
                        color: "#1e40af",
                        lineHeight: "1.5",
                      }}
                    >
                      {config?.telephone && (
                        <p>
                          <strong>Tél:</strong> {config.telephone}
                          {config?.telephone2 ? ` / ${config.telephone2}` : ""}
                        </p>
                      )}
                      {config?.email && (
                        <p>
                          <strong>Email:</strong> {config.email}
                        </p>
                      )}
                      {config?.secteur && <p>{config.secteur}</p>}
                      <p>
                        {config?.nif && (
                          <>
                            <strong>IFU:</strong> {config.nif}
                          </>
                        )}
                        {config?.rccm && (
                          <>
                            {" "}
                            <strong>RCCM:</strong> {config.rccm}
                          </>
                        )}
                        {config?.regime_fiscal && (
                          <>
                            {" "}
                            <strong>Régime fiscal:</strong>{" "}
                            {config.regime_fiscal}
                          </>
                        )}
                      </p>
                      <p>
                        {config?.division_fiscale && (
                          <>
                            <strong>Division fiscale:</strong>{" "}
                            {config.division_fiscale}
                          </>
                        )}
                        {config?.numero_compte_uba && (
                          <>
                            {" "}
                            <strong>N° Compte UBA:</strong>{" "}
                            {config.numero_compte_uba}
                          </>
                        )}
                      </p>
                      {config?.reference_cadastrale && (
                        <p>
                          <strong>Réf. cadastrales:</strong>{" "}
                          {config.reference_cadastrale}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Boutons */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-3 rounded-b-2xl flex-shrink-0 flex-wrap">
                <button
                  onClick={() => setShowReceipt(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 min-w-[100px]"
                >
                  <X className="w-5 h-5" />
                  Fermer
                </button>
                <button
                  onClick={() => printDebtPaymentA5(paymentReceipt)}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 min-w-[100px]"
                >
                  <FileText className="w-5 h-5" />
                  Imprimer
                </button>
                {paymentReceipt?.nouveau_restant <= 0 && (
                  <button
                    onClick={printInvoiceA4AfterSettlement}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 min-w-[100px]"
                  >
                    <FileText className="w-5 h-5" />
                    Imprimer la Facture
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Factures à crédit */}
        {showCreditSalesModal && selectedClient && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full p-5 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Factures à crédit – {selectedClient.client_nom}
                </h3>
                <button
                  onClick={() => setShowCreditSalesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {clientSales.length === 0 ? (
                  <div className="text-center py-8">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Aucune facture à crédit
                    </p>
                  </div>
                ) : (
                  clientSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            Vente #{sale.id}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(sale.date_vente).toLocaleDateString(
                              "fr-FR",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {formatCurrency(sale.total)}
                          </p>
                          <p className="text-xs font-semibold text-red-600">
                            Reste: {formatCurrency(sale.montant_restant)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-3">
                <button
                  onClick={() => setShowCreditSalesModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-all text-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popup produits */}
      {showProductsPopup && popupSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Vente #{popupSale.id}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(popupSale.date_vente).toLocaleDateString("fr-FR")} ·{" "}
                  {popupSale.client_nom}
                </p>
              </div>
              <button
                onClick={() => setShowProductsPopup(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr className="text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-3 text-left font-medium">Produit</th>
                    <th className="py-2 px-3 text-center font-medium">Qté</th>
                    <th className="py-2 px-3 text-right font-medium">P.U.</th>
                    <th className="py-2 px-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {popupSale.produits?.map((p: any, i: number) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">
                        {p.nom_produit}
                      </td>
                      <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                        {p.quantite}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                        {formatCurrency(p.prix_unitaire)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(
                          p.sous_total ?? p.quantite * p.prix_unitaire,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-semibold">
              <span className="text-green-600">
                Payé: {formatCurrency(popupSale.montant_paye)}
              </span>
              <span className="text-blue-600">
                Total: {formatCurrency(popupSale.total)}
              </span>
              {popupSale.montant_restant > 0 && (
                <span className="text-red-600">
                  Reste: {formatCurrency(popupSale.montant_restant)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
};

export default CustomerDebts;
