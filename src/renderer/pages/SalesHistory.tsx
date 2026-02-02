import React, { useEffect, useState, useRef } from "react";
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
import { formatCurrency } from "../utils/formatters";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";

const SalesHistory: React.FC = () => {
  const { user } = useAuthStore();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadConfig();
    loadSales();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    loadSales();
  }, [startDate, endDate]);

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
    } catch (error) {
      console.error("Erreur chargement configuration:", error);
    }
  };

  const loadSales = async (page: number = currentPage, limit: number = itemsPerPage, startDateFilter: string = startDate, endDateFilter: string = endDate) => {
    try {
      const result = await window.electronAPI.getSalesPaginated(
        page,
        limit,
        startDateFilter,
        endDateFilter
      );
      setSales(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!selectedInvoice || !invoiceRef.current) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket - ${selectedInvoice.numero}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              @page {
                size: 80mm auto;
                margin: 2mm;
              }

              body {
                font-family: 'Courier New', 'Lucida Console', monospace;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
                background: white;
                width: 76mm;
                margin: 0 auto;
              }

              .ticket {
                width: 76mm;
                padding: 2mm;
                background: white;
              }

              .ticket-header {
                text-align: center;
                padding-bottom: 3mm;
                border-bottom: 1px dashed #000;
                margin-bottom: 3mm;
              }

              .ticket-header h1 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 2mm;
                text-transform: uppercase;
              }

              .ticket-header p {
                font-size: 10px;
                margin: 1mm 0;
              }

              .ticket-title {
                text-align: center;
                font-size: 16px;
                font-weight: bold;
                margin: 3mm 0;
                padding: 2mm 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }

              .ticket-info {
                margin-bottom: 3mm;
                padding-bottom: 3mm;
                border-bottom: 1px dashed #000;
              }

              .ticket-info-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin: 1mm 0;
              }

              .ticket-articles {
                margin-bottom: 3mm;
                padding-bottom: 3mm;
                border-bottom: 1px dashed #000;
              }

              .ticket-article {
                margin: 2mm 0;
                font-size: 11px;
              }

              .ticket-article-name {
                font-weight: bold;
              }

              .ticket-article-details {
                display: flex;
                justify-content: space-between;
                padding-left: 2mm;
                font-size: 10px;
              }

              .ticket-totals {
                margin-bottom: 3mm;
                padding-bottom: 3mm;
                border-bottom: 1px dashed #000;
              }

              .ticket-total-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin: 1mm 0;
              }

              .ticket-total-row.grand-total {
                font-size: 14px;
                font-weight: bold;
                margin-top: 2mm;
                padding-top: 2mm;
                border-top: 1px solid #000;
              }

              .ticket-payment {
                margin-bottom: 3mm;
                padding-bottom: 3mm;
                border-bottom: 1px dashed #000;
              }

              .ticket-payment-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin: 1mm 0;
              }

              .ticket-payment-row.change {
                font-weight: bold;
                font-size: 12px;
              }

              .ticket-footer {
                text-align: center;
                padding-top: 3mm;
              }

              .ticket-footer p {
                font-size: 10px;
                margin: 1mm 0;
              }

              .ticket-footer .thank-you {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 2mm;
              }

              .ticket-footer .ticket-ref {
                font-size: 9px;
                margin-top: 3mm;
                padding-top: 2mm;
                border-top: 1px dashed #000;
              }

              @media print {
                body {
                  width: 76mm;
                }
                .ticket {
                  width: 76mm;
                }
              }
            </style>
          </head>
          <body>
            ${invoiceRef.current.innerHTML}
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
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleDeleteSale = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette vente ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteSale(id, user?.id, user?.nom);
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
          <h1 className="text-3xl font-bold text-gray-900">
            Historique des Ventes
          </h1>
          <p className="text-gray-600 mt-1">
            {totalItems} vente(s) • Total: {formatCurrency(totalVentes)}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          {(startDate || endDate) && (
            <button onClick={handleResetFilter} className="btn-secondary">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant Payé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monnaie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{sale.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {sale.client_nom || "Client comptoir"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(sale.date_vente!).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    {formatCurrency(sale.total || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatCurrency(sale.montant_paye || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatCurrency(sale.monnaie_rendue || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getPaymentIcon(sale.methode_paiement)}
                      <span className="text-sm text-gray-600">
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
                      {(user?.role === "admin" ||
                        user?.role === "gestionnaire") && (
                        <button
                          onClick={() => handleDeleteSale(sale.id!)}
                          className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sales.length === 0 && (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune vente trouvée
              </h3>
              <p className="text-gray-600">
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
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
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
              {/* Informations de paiement */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Méthode de paiement:</span>
                  <span className="font-medium flex items-center gap-2">
                    {getPaymentIcon(selectedSale.methode_paiement)}
                    {getPaymentLabel(selectedSale.methode_paiement)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant payé:</span>
                  <span className="font-medium">
                    {formatCurrency(selectedSale.montant_paye || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monnaie rendue:</span>
                  <span className="font-medium">
                    {formatCurrency(selectedSale.monnaie_rendue || 0)}
                  </span>
                </div>
                {selectedSale.remise_valeur && selectedSale.remise_valeur > 0 && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Total avant remise:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedSale.total_avant_remise || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remise ({selectedSale.remise_type === 'pourcentage' ? `${selectedSale.remise_valeur}%` : 'fixe'}):</span>
                      <span className="font-medium text-green-600">
                        -{formatCurrency(
                          selectedSale.remise_type === 'pourcentage'
                            ? (selectedSale.total_avant_remise || 0) * (selectedSale.remise_valeur / 100)
                            : selectedSale.remise_valeur
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Produits vendus */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Produits vendus
                </h3>
                <div className="space-y-2">
                  {(selectedSale.produits as any[])?.map(
                    (item: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-gray-50 rounded-lg p-3"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {item.nom_produit}
                          </p>
                          <p className="text-sm text-gray-600">
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
                  <span className="text-xl font-semibold text-gray-900">
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
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
                    Ticket {selectedInvoice.numero}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {selectedInvoice.date_facture} à{" "}
                    {selectedInvoice.heure_facture} - Format 80mm
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex justify-center">
              <div
                ref={invoiceRef}
                className="ticket bg-white shadow-xl"
                style={{
                  width: "80mm",
                  padding: "3mm",
                  fontFamily: "'Courier New', 'Lucida Console', monospace",
                  fontSize: "12px",
                  lineHeight: "1.4",
                  color: "#000",
                }}
              >
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
                  {config?.telephone2 && (
                    <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                      {config.telephone2}
                    </p>
                  )}
                  {config?.adresse && (
                    <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                      {config.adresse}
                    </p>
                  )}
                  {config?.email && (
                    <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                      {config.email}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    textAlign: "center",
                    fontSize: "16px",
                    fontWeight: "bold",
                    margin: "3mm 0",
                    padding: "2mm 0",
                    borderBottom: "1px dashed #000",
                  }}
                >
                  TICKET N° {selectedInvoice.numero}
                </div>

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
                    <span>{selectedInvoice.date_facture}</span>
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
                    <span>{selectedInvoice.heure_facture}</span>
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
                    <span>{selectedInvoice.vendeur}</span>
                  </div>
                  {selectedInvoice.serveur_nom && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Serveur:</span>
                      <span>{selectedInvoice.serveur_nom}</span>
                    </div>
                  )}
                  {selectedInvoice.client_nom &&
                    selectedInvoice.client_nom !== "Client comptoir" && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          margin: "1mm 0",
                        }}
                      >
                        <span>Client:</span>
                        <span>{selectedInvoice.client_nom}</span>
                      </div>
                    )}
                </div>

                <div
                  style={{
                    marginBottom: "3mm",
                    paddingBottom: "3mm",
                  }}
                >
                  {selectedInvoice.articles.map(
                    (article: any, index: number) => (
                      <div key={index} style={{ margin: "2mm 0" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "bold",
                          }}
                        >
                          {article.designation}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            paddingLeft: "2mm",
                            fontSize: "10px",
                          }}
                        >
                          <span>
                            {article.quantite} x{" "}
                            {formatCurrency(article.prixUnitaire)}
                          </span>
                          <span style={{ fontWeight: "bold" }}>
                            {formatCurrency(article.total)}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div
                  style={{
                    marginBottom: "3mm",
                    paddingBottom: "3mm",
                  }}
                >
                  {selectedInvoice.remise_valeur && selectedInvoice.remise_valeur > 0 && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          margin: "1mm 0",
                          borderTop: "1px dashed #000",
                          paddingTop: "2mm",
                        }}
                      >
                        <span>Sous-total:</span>
                        <span>{formatCurrency(selectedInvoice.total_avant_remise || 0)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          margin: "1mm 0",
                        }}
                      >
                        <span>Remise ({selectedInvoice.remise_type === 'pourcentage' ? `${selectedInvoice.remise_valeur}%` : 'fixe'}):</span>
                        <span>
                          -{formatCurrency(
                            selectedInvoice.remise_type === 'pourcentage'
                              ? (selectedInvoice.total_avant_remise || 0) * (selectedInvoice.remise_valeur / 100)
                              : selectedInvoice.remise_valeur
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginTop: "2mm",
                      paddingTop: "2mm",
                      borderTop: "1px solid #000",
                    }}
                  >
                    <span>TOTAL:</span>
                    <span>{formatCurrency(selectedInvoice.total_ttc)}</span>
                  </div>
                </div>

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
                    <span>Mode:</span>
                    <span>{selectedInvoice.methode_paiement}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      margin: "1mm 0",
                    }}
                  >
                    <span>Recu:</span>
                    <span>{formatCurrency(selectedInvoice.montant_paye)}</span>
                  </div>
                  {selectedInvoice.monnaie_rendue > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        fontWeight: "bold",
                        margin: "1mm 0",
                      }}
                    >
                      <span>Monnaie:</span>
                      <span>
                        {formatCurrency(selectedInvoice.monnaie_rendue)}
                      </span>
                    </div>
                  )}
                </div>

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
                  {config?.support_text && (
                    <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                      --------------------------------
                    </p>
                  )}
                  {config?.support_text && (
                    <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                      {config.support_text}
                    </p>
                  )}
                  {config?.nif && (
                    <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                      NIF: {config.nif}
                    </p>
                  )}
                  <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                    --------------------------------
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-4 rounded-b-2xl flex-shrink-0">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Fermer
              </button>
              <button
                onClick={handlePrintInvoice}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
