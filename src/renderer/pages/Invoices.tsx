import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  Search,
  Eye,
  Printer,
  X,
  Trash2,
} from "lucide-react";
import { Invoice, Configuration } from "../types";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";

const Invoices: React.FC = () => {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [config, setConfig] = useState<Configuration | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
    } catch (error) {
      console.error("Erreur chargement configuration:", error);
    }
  };

  useEffect(() => {
    loadConfig();
    loadInvoices();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    loadInvoices();
  }, [searchQuery, startDate, endDate]);

  const loadInvoices = async (page: number = currentPage, limit: number = itemsPerPage, search: string = searchQuery) => {
    try {
      const result = await window.electronAPI.getInvoicesPaginated(
        page,
        limit,
        search
      );
      setInvoices(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement factures:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const totalFactures = invoices.reduce(
    (sum, inv) => sum + (Number(inv.total_ttc) || 0),
    0,
  );

  const handleDeleteInvoice = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) {
      return;
    }

    try {
      await window.electronAPI.deleteInvoice(id, user?.id, user?.nom);
      toast.success("Facture supprimée avec succès");
      setSelectedInvoice(null);
      loadInvoices();
    } catch (error) {
      console.error("Erreur suppression facture:", error);
      toast.error("Erreur lors de la suppression de la facture");
    }
  };

  const filteredInvoices = searchQuery
    ? invoices.filter((inv) =>
        inv.numero.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : invoices;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedInvoices = filteredInvoices;

  const handlePrint = () => {
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
          <h1 className="text-3xl font-bold text-gray-900">Factures</h1>
          <p className="text-gray-600 mt-1">
            {totalItems} facture(s) - Total:{" "}
            {formatCurrency(totalFactures)}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher par numero
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Numero de facture..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date de debut
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
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
           {(startDate || endDate || searchQuery) && (
             <button
               onClick={() => {
                 setStartDate("");
                 setEndDate("");
                 setSearchQuery("");
               }}
               className="btn-secondary"
             >
               Reinitialiser
             </button>
           )}
         </div>
       </div>

      {/* Liste des factures */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total TTC
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
              {paginatedInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {invoice.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {invoice.date_facture} {invoice.heure_facture}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {invoice.client_nom || "Client comptoir"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {invoice.vendeur}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {invoice.serveur_nom || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                    {formatCurrency(invoice.total_ttc || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {invoice.methode_paiement}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune facture trouvee
              </h3>
              <p className="text-gray-600">
                Les factures generees apparaitront ici.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {invoices.length > 0 && (
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

      {/* Modal details de la facture */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
            {/* Header du modal */}
            <div className="relative bg-blue-600  text-white px-8 py-5 rounded-t-2xl shrink-0">
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
                    {selectedInvoice.date_facture} a{" "}
                    {selectedInvoice.heure_facture} - Format 80mm
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu de la facture - Format ticket 80mm */}
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
                {/* En-tete du ticket */}
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

                {/* Titre TICKET */}
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

                {/* Informations */}
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

                {/* Articles */}
                <div
                  style={{
                    marginBottom: "3mm",
                    paddingBottom: "3mm",
                  }}
                >
                  {selectedInvoice.articles.map((article, index) => (
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
                  ))}
                </div>

                {/* Totaux */}
                <div
                  style={{
                    marginBottom: "3mm",
                    paddingBottom: "3mm",
                  }}
                >
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

                {/* Paiement */}
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

            {/* Boutons d'action */}
            <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-4 rounded-b-2xl flex-shrink-0">
              {(user?.role === "admin" || user?.role === "gestionnaire") && (
                <>
                  <button
                    onClick={() => handleDeleteInvoice(selectedInvoice.id!)}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Supprimer
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Fermer
              </button>
              <button
                onClick={handlePrint}
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

export default Invoices;
