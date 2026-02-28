import React, { useEffect, useState, useMemo } from "react";
import {
  History,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  Trash2,
  FileText,
  X,
  Printer,
} from "lucide-react";
import { Sale, Configuration } from "../types";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatCurrency } from "../utils/formatters";
import { useAuthStore } from "../store/useAuthStore";
import {
  PrintData,
  generateA4HTML,
  generateA5HTML,
  generate80mmHTML,
  openPrintWindow,
} from "../utils/printTemplates";
import { toast } from "react-hot-toast";
import { generateInvoiceQR } from "../utils/qrcode";

const SalesHistory: React.FC = () => {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<Configuration | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vendeurFilter, setVendeurFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [creditFilter, setCreditFilter] = useState("");
  const [vendeurs, setVendeurs] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    loadConfig();
    loadVendeurs();
    loadClients();
    loadSales();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    loadSales();
  }, [startDate, endDate, vendeurFilter, clientFilter, creditFilter]);

  const loadVendeurs = async () => {
    try {
      const data = await window.electronAPI.getDistinctVendeurs();
      setVendeurs(data || []);
    } catch (error) {
      console.error("Erreur chargement vendeurs:", error);
    }
  };

  const loadClients = async () => {
    try {
      const result = await window.electronAPI.getClientsPaginated(1, 1000);
      setClients(result.data || []);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
    }
  };

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

  const loadSales = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
    startDateFilter: string = startDate,
    endDateFilter: string = endDate,
  ) => {
    try {
      const result = await window.electronAPI.getSalesPaginated(
        page,
        limit,
        startDateFilter,
        endDateFilter,
        vendeurFilter,
        clientFilter,
        creditFilter,
      );
      setSales(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
    } finally {
      setLoading(false);
    }
  };

  const format = config?.format_facture || "80mm";
  const isA4 = format === "A4";

  // Générer le QR code quand une facture est sélectionnée
  useEffect(() => {
    if (selectedInvoice) {
      const remise = selectedInvoice.total_avant_remise
        ? selectedInvoice.total_avant_remise - selectedInvoice.total_ttc
        : 0;
      generateInvoiceQR({
        numero: selectedInvoice.numero,
        date: selectedInvoice.date_facture,
        client: selectedInvoice.client_nom || "Client comptoir",
        totalAchat:
          selectedInvoice.total_avant_remise || selectedInvoice.total_ttc,
        remise,
        tva: 0,
        totalTTC: selectedInvoice.total_ttc,
        devise: config?.devise,
      })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(null));
    } else {
      setQrCodeUrl(null);
    }
  }, [selectedInvoice, config?.devise]);

  const handlePrintInvoice = async () => {
    if (!selectedInvoice) return;

    const data: PrintData = {
      numero: selectedInvoice.numero,
      date: selectedInvoice.date_facture,
      heure: selectedInvoice.heure_facture,
      document_type: "FACTURE",
      client_nom: selectedInvoice.client_nom,
      client_telephone: selectedInvoice.client_telephone,
      client_email: selectedInvoice.client_email,
      vendeur: selectedInvoice.vendeur,
      serveur_nom: selectedInvoice.serveur_nom,
      methode_paiement: selectedInvoice.methode_paiement,
      montant_paye: selectedInvoice.montant_paye,
      articles: selectedInvoice.articles.map((a: any) => ({
        designation: a.designation,
        quantite: a.quantite,
        prix_unitaire: a.prixUnitaire,
        total: a.total,
      })),
      total_avant_remise: selectedInvoice.total_avant_remise,
      remise_type: selectedInvoice.remise_type,
      remise_valeur: selectedInvoice.remise_valeur,
      total_ttc: selectedInvoice.total_ttc,
      monnaie_rendue: selectedInvoice.monnaie_rendue,
      montant_restant: selectedInvoice.montant_restant,
      livraison_differee: (selectedInvoice as any).livraison_differee,
    };

    let html: string;
    if (isA4) {
      html = generateA4HTML(data, config, logoBase64, qrCodeUrl);
    } else if (format === "A5") {
      html = generateA5HTML(data, config, logoBase64, qrCodeUrl);
    } else {
      html = generate80mmHTML(data, config, logoBase64, qrCodeUrl);
    }
    openPrintWindow(html);
  };

  const previewHTML = useMemo(() => {
    if (!selectedInvoice) return "";
    const data: PrintData = {
      numero: selectedInvoice.numero,
      date: selectedInvoice.date_facture,
      heure: selectedInvoice.heure_facture,
      document_type: "FACTURE",
      client_nom: selectedInvoice.client_nom,
      client_telephone: selectedInvoice.client_telephone,
      client_email: selectedInvoice.client_email,
      vendeur: selectedInvoice.vendeur,
      serveur_nom: selectedInvoice.serveur_nom,
      methode_paiement: selectedInvoice.methode_paiement,
      montant_paye: selectedInvoice.montant_paye,
      articles: selectedInvoice.articles.map((a: any) => ({
        designation: a.designation,
        quantite: a.quantite,
        prix_unitaire: a.prixUnitaire,
        total: a.total,
      })),
      total_avant_remise: selectedInvoice.total_avant_remise,
      remise_type: selectedInvoice.remise_type,
      remise_valeur: selectedInvoice.remise_valeur,
      total_ttc: selectedInvoice.total_ttc,
      monnaie_rendue: selectedInvoice.monnaie_rendue,
      montant_restant: selectedInvoice.montant_restant,
      livraison_differee: (selectedInvoice as any).livraison_differee,
    };
    return generateA4HTML(data, config, logoBase64, qrCodeUrl).replace(/<script>[\s\S]*?<\/script>/g, '');
  }, [selectedInvoice, config, logoBase64, qrCodeUrl]);

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setVendeurFilter("");
    setClientFilter("");
    setCreditFilter("");
  };

  const handleDeleteSale = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDeleteSale = async () => {
    if (pendingDeleteId === null) return;
    setConfirmOpen(false);
    setPendingDeleteId(null);
    try {
      await window.electronAPI.deleteSale(pendingDeleteId, user?.id, user?.nom);
      toast.success("Vente supprimée avec succès");
      loadSales();
    } catch (error) {
      console.error("Erreur suppression vente:", error);
      toast.error("Erreur lors de la suppression de la vente");
    }
  };

  const handleViewInvoice = async (saleId: number) => {
    try {
      const invoice = await window.electronAPI.getInvoiceByVenteId(saleId);
      if (invoice) {
        setSelectedInvoice(invoice);
      } else {
        alert("Aucune facture trouvée pour cette vente");
      }
    } catch (error) {
      console.error("Erreur chargement facture:", error);
      alert("Erreur lors du chargement de la facture");
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedSales = sales;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "especes":
        return <Banknote className="w-5 h-5" />;
      case "carte":
        return <CreditCard className="w-5 h-5" />;
      case "mobile":
        return <Smartphone className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "especes":
        return "Espèces";
      case "carte":
        return "Carte";
      case "mobile":
        return "Mobile";
      default:
        return method;
    }
  };

  const totalVentes = sales.reduce(
    (sum, sale) => sum + (Number(sale.total) || 0),
    0,
  );

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
            Historique des Ventes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalItems} vente(s) • Total: {formatCurrency(totalVentes)}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vendeur
            </label>
            <select
              value={vendeurFilter}
              onChange={(e) => setVendeurFilter(e.target.value)}
              className="input-field"
            >
              <option value="">Tous les vendeurs</option>
              {vendeurs.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Client
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="input-field"
            >
              <option value="">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.nom}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type de vente
            </label>
            <select
              value={creditFilter}
              onChange={(e) => setCreditFilter(e.target.value)}
              className="input-field"
            >
              <option value="">Toutes les ventes</option>
              <option value="comptant">Comptant</option>
              <option value="credit">À crédit</option>
            </select>
          </div>
          {(startDate ||
            endDate ||
            vendeurFilter ||
            clientFilter ||
            creditFilter) && (
            <button
              onClick={handleResetFilter}
              className="btn-secondary h-[42px]"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  #ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date & Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Montant Payé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Monnaie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    #{sale.id}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {sale.client_nom || "Client comptoir"}
                    </p>
                    {sale.client_telephone && (
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        {sale.client_telephone}
                      </p>
                    )}
                    {sale.client_email && (
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        {sale.client_email}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(sale.date_vente!).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    {formatCurrency(sale.total || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(sale.montant_paye || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(sale.monnaie_rendue || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getPaymentIcon(sale.methode_paiement)}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {getPaymentLabel(sale.methode_paiement)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Détails
                      </button>
                      <button
                        onClick={() => handleViewInvoice(sale.id!)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <FileText className="w-4 h-4" />
                        Facture
                      </button>
                      <button
                        onClick={() => handleDeleteSale(sale.id!)}
                        className="text-red-600 hover:text-red-900 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sales.length === 0 && (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucune vente trouvée
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Les ventes effectuées apparaîtront ici.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {sales.length > 0 && (
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

      {/* Modal détails de la vente */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
            <div className="relative bg-blue-600 text-white px-8 py-5 rounded-t-2xl shrink-0">
              <button
                onClick={() => setSelectedSale(null)}
                className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    Détails de la vente #{selectedSale.id}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {new Date(selectedSale.date_vente!).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Informations client */}
              {(selectedSale.client_nom ||
                selectedSale.client_telephone ||
                selectedSale.client_email) && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedSale.client_nom || "Client comptoir"}
                  </p>
                  {selectedSale.client_telephone && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📞 {selectedSale.client_telephone}
                    </p>
                  )}
                  {selectedSale.client_email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      ✉ {selectedSale.client_email}
                    </p>
                  )}
                </div>
              )}

              {/* Informations de paiement */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Méthode de paiement:
                  </span>
                  <span className="font-medium flex items-center gap-2">
                    {getPaymentIcon(selectedSale.methode_paiement)}
                    {getPaymentLabel(selectedSale.methode_paiement)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Montant payé:
                  </span>
                  <span className="font-medium">
                    {formatCurrency(selectedSale.montant_paye || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Monnaie rendue:
                  </span>
                  <span className="font-medium">
                    {formatCurrency(selectedSale.monnaie_rendue || 0)}
                  </span>
                </div>
                {selectedSale.remise_valeur != null &&
                  selectedSale.remise_valeur > 0 && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total avant remise:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(selectedSale.total_avant_remise || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Remise (
                          {selectedSale.remise_type === "pourcentage"
                            ? `${selectedSale.remise_valeur}%`
                            : "fixe"}
                          ):
                        </span>
                        <span className="font-medium text-green-600">
                          -
                          {formatCurrency(
                            selectedSale.remise_type === "pourcentage"
                              ? (selectedSale.total_avant_remise || 0) *
                                  (selectedSale.remise_valeur / 100)
                              : selectedSale.remise_valeur,
                          )}
                        </span>
                      </div>
                    </>
                  )}
              </div>

              {/* Produits vendus */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Produits vendus
                </h3>
                <div className="space-y-2">
                  {(selectedSale.produits as any[])?.map(
                    (item: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.nom_produit}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatCurrency(item.prix_unitaire || 0)} x{" "}
                            {item.quantite}
                          </p>
                        </div>
                        <p className="font-bold text-blue-600">
                          {formatCurrency(item.sous_total || 0)}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold text-gray-900 dark:text-white">
                    Total:
                  </span>
                  <span className="text-3xl font-bold text-blue-600">
                    {formatCurrency(selectedSale.total || 0)}
                  </span>
                </div>
              </div>

              {/* Bouton fermer */}
              <button
                onClick={() => setSelectedSale(null)}
                className="btn-primary w-full"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal facture */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[98vh] flex flex-col">
            <div className="relative bg-blue-600 text-white px-8 py-5 rounded-t-2xl shrink-0">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {format !== "80mm" ? "Facture" : "Ticket"}{" "}
                    {selectedInvoice.numero}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {selectedInvoice.date_facture} à{" "}
                    {selectedInvoice.heure_facture} - Format {format}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu de la facture */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-600 flex justify-center items-start">
              <iframe
                srcDoc={previewHTML}
                style={{ width: "210mm", height: "1500px", border: "none", display: "block", colorScheme: "light", background: "white" }}
                title="Aperçu facture"
              />
            </div>

            <div className="p-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-4 rounded-b-2xl shrink-0">
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  if (selectedInvoice.vente_id) handleDeleteSale(selectedInvoice.vente_id);
                }}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Supprimer
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Fermer
              </button>
              <button
                onClick={handlePrintInvoice}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                {isA4 ? "Imprimer la facture" : "Imprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        message="Êtes-vous sûr de vouloir supprimer cette vente ?"
        onConfirm={handleConfirmDeleteSale}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
};

export default SalesHistory;
