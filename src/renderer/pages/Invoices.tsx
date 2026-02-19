import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  Search,
  Eye,
  Printer,
  X,
  Trash2,
  Edit,
  Plus,
  Minus,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Invoice, Configuration } from "../types";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { montantEnLettres } from "../utils/numberToWords";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";
import { generateInvoiceQR } from "../utils/qrcode";

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
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editArticles, setEditArticles] = useState<any[]>([]);
  const [canModify, setCanModify] = useState<{
    canModify: boolean;
    reason?: string;
  }>({ canModify: true });
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nextTempId, setNextTempId] = useState(1);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

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

  useEffect(() => {
    loadConfig();
    loadInvoices();
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    loadInvoices();
  }, [searchQuery, startDate, endDate]);

  const loadInvoices = async (
    page: number = currentPage,
    limit: number = itemsPerPage,
    search: string = searchQuery,
  ) => {
    try {
      const result = await window.electronAPI.getInvoicesPaginated(
        page,
        limit,
        search,
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

  const handleOpenEdit = async (invoice: Invoice) => {
    if (!invoice.vente_id) {
      toast.error("Impossible de modifier cette facture");
      return;
    }

    try {
      const result = await window.electronAPI.canModifySale(invoice.vente_id);
      setCanModify(result);

      if (result.canModify) {
        setEditInvoice(invoice);
        const loadedProducts = await window.electronAPI.getProducts();
        setProducts(loadedProducts);

        let tempIdCounter = 1;
        const articlesWithIds = invoice.articles.map((a) => {
          const matchingProduct = loadedProducts.find(
            (p: any) => p.nom === a.designation,
          );
          const article = {
            tempId: tempIdCounter++,
            produit_id: matchingProduct?.id || 0,
            nom: a.designation,
            nom_produit: a.designation,
            quantite: a.quantite,
            prix_unitaire: a.prixUnitaire,
            sous_total: a.total,
          };
          return article;
        });
        setNextTempId(tempIdCounter);
        setEditArticles(articlesWithIds);
        setShowEditModal(true);
        setSelectedInvoice(null);
      }
    } catch (error) {
      console.error("Erreur vérification modification:", error);
      toast.error("Erreur lors de la vérification");
    }
  };

  const handleAddProduct = (product: any) => {
    const existing = editArticles.find((a) => a.produit_id === product.id);
    if (existing) {
      setEditArticles(
        editArticles.map((a) =>
          a.produit_id === product.id
            ? {
                ...a,
                quantite: a.quantite + 1,
                sous_total: (a.quantite + 1) * a.prix_unitaire,
              }
            : a,
        ),
      );
    } else {
      setNextTempId((prev) => prev + 1);
      setEditArticles([
        ...editArticles,
        {
          tempId: nextTempId,
          produit_id: product.id,
          nom: product.nom,
          nom_produit: product.nom,
          quantite: 1,
          prix_unitaire: product.prix_vente,
          sous_total: product.prix_vente,
        },
      ]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const handleUpdateQuantity = (tempId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setEditArticles(editArticles.filter((a) => a.tempId !== tempId));
    } else {
      setEditArticles(
        editArticles.map((a) =>
          a.tempId === tempId
            ? {
                ...a,
                quantite: newQuantity,
                sous_total: newQuantity * a.prix_unitaire,
              }
            : a,
        ),
      );
    }
  };

  const handleRemoveArticle = (tempId: number) => {
    setEditArticles(editArticles.filter((a) => a.tempId !== tempId));
  };

  const editTotal = editArticles.reduce((sum, a) => sum + a.sous_total, 0);

  const handleSaveEdit = async () => {
    if (!editInvoice?.vente_id || editArticles.length === 0) {
      toast.error("Aucun article dans la facture");
      return;
    }

    const validArticles = editArticles.filter(
      (a) => a.produit_id && a.produit_id > 0,
    );
    if (validArticles.length !== editArticles.length) {
      toast.error(
        "Certains articles n'ont pas pu être identifiés. Veuillez les supprimer et les ajouter à nouveau.",
      );
      return;
    }

    setSaving(true);
    try {
      await window.electronAPI.updateSale(
        editInvoice.vente_id,
        {
          produits: validArticles.map((a) => ({
            produit_id: a.produit_id,
            nom_produit: a.nom,
            quantite: a.quantite,
            prix_unitaire: a.prix_unitaire,
            sous_total: a.sous_total,
          })),
          total: editTotal,
          montant_paye: editTotal,
          montant_restant: 0,
          methode_paiement:
            editInvoice.methode_paiement === "Espèces"
              ? "especes"
              : editInvoice.methode_paiement === "Carte bancaire"
                ? "carte"
                : "mobile",
          client_nom: editInvoice.client_nom,
        },
        user?.id,
        user?.nom,
      );

      toast.success("Facture modifiée avec succès");
      setShowEditModal(false);
      setEditInvoice(null);
      loadInvoices();
    } catch (error: any) {
      console.error("Erreur modification facture:", error);
      toast.error(error.message || "Erreur lors de la modification");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = productSearch
    ? products.filter(
        (p) =>
          p.nom.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.code_barre?.includes(productSearch),
      )
    : products.slice(0, 10);

  const filteredInvoices = searchQuery
    ? invoices.filter((inv) =>
        inv.numero.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : invoices;

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedInvoices = filteredInvoices;

  const isA4 = config?.format_facture === "A4";

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

  const handlePrint = async () => {
    if (!selectedInvoice || !invoiceRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (isA4) {
      // Format A4 - Facture professionnelle compacte
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${selectedInvoice.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4; margin: 8mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #333; }
              .invoice { max-width: 194mm; max-height: 500px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #2563eb; margin-bottom: 10px; }
              .company-logo { width: 150px; display: flex; align-items: center; }
              .company-logo img { max-height: 110px; max-width: 150px; object-fit: contain; }
              .company-info { flex: 1; text-align: center; padding: 0 15px; }
              .company-info h1 { font-size: 18px; color: #1e40af; margin-bottom: 2px; }
              .company-info p { font-size: 9px; color: #555; margin: 1px 0; }
              .invoice-badge { background: #2563eb; color: white; padding: 6px 14px; border-radius: 4px; font-size: 14px; font-weight: bold; text-align: center; min-width: 80px; }
              .invoice-badge .numero { font-size: 10px; font-weight: normal; margin-top: 1px; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 10px; }
              .info-box { width: 48%; background: #f8fafc; padding: 8px 10px; border-radius: 4px; border: 1px solid #e2e8f0; }
              .info-box h3 { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.3px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; }
              .info-box p { margin: 2px 0; font-size: 10px; }
              .info-box strong { color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0; }
              thead th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; }
              thead th:first-child { border-radius: 4px 0 0 0; }
              thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
              thead th.text-right { text-align: right; }
              tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
              tbody tr:nth-child(even) { background: #f8fafc; }
              tbody td.text-right { text-align: right; }
              .totals-section { display: flex; justify-content: flex-end; margin-top: 8px; }
              .totals-box { width: 280px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd; padding: 8px 10px; }
              .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; }
              .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
              .totals-row.discount { color: #dc2626; }
              .totals-row.grand-total { font-size: 13px; font-weight: bold; color: #1e40af; border-top: 2px solid #1e40af; padding-top: 6px; margin-top: 4px; }
              .totals-row.payment-info { border-top: 1px dashed #bae6fd; padding-top: 5px; margin-top: 4px; font-size: 9px; }
              .totals-row.remaining { color: #dc2626; font-weight: bold; }
              .amount-words { margin-top: 8px; padding: 6px 10px; background: #fefce8; border: 1px solid #fde68a; border-radius: 4px; font-style: italic; font-size: 9px; color: #92400e; }
              .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding-top: 8px; }
              .qr-code { text-align: center; }
              .qr-code img { width: 80px; height: 80px; }
              .qr-code p { font-size: 8px; color: #64748b; margin-top: 2px; }
              .stamp-area { width: 150px; height: 80px; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
              .stamp-area p { font-size: 9px; color: #94a3b8; text-align: center; }
              .footer { margin-top: 15px; text-align: center; padding-top: 8px; border-top: 1px solid #e2e8f0; }
              .footer .message { font-size: 11px; font-weight: 500; color: #1e40af; margin-bottom: 2px; }
              .footer .sub { font-size: 8px; color: #94a3b8; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="invoice">
              <div class="header">
                <div class="company-logo">
                  ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
                </div>
                <div class="company-info">
                  <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                  ${config?.description_entreprise ? `<p style="font-size: 11px; color: #666; font-style: italic;">${config.description_entreprise}</p>` : ""}
                  ${config?.adresse ? `<p>${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
                  ${config?.telephone ? `<p>Tel: ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}${config?.nif ? " | NIF: " + config.nif : ""}</p>` : ""}
                  ${config?.email && !config?.telephone ? `<p>${config.email}</p>` : ""}
                </div>
                <div class="invoice-badge">
                  FACTURE
                  <div class="numero">N° ${selectedInvoice.numero}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${selectedInvoice.client_nom || "Client comptoir"}</strong></p>
                  ${selectedInvoice.client_telephone ? `<p>Tel: ${selectedInvoice.client_telephone}</p>` : ""}
                  ${selectedInvoice.client_email ? `<p>${selectedInvoice.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Facture</h3>
                  <p><strong>Date:</strong> ${selectedInvoice.date_facture} | <strong>Heure:</strong> ${selectedInvoice.heure_facture}</p>
                  <p><strong>Caissier:</strong> ${selectedInvoice.vendeur}${selectedInvoice.serveur_nom ? " | <strong>Serveur:</strong> " + selectedInvoice.serveur_nom : ""}</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th class="text-right" style="width: 40px;">Qte</th>
                    <th class="text-right" style="width: 80px;">P.U.</th>
                    <th class="text-right" style="width: 80px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedInvoice.articles
                    .map(
                      (a) => `
                    <tr>
                      <td>${a.designation}</td>
                      <td class="text-right">${a.quantite}</td>
                      <td class="text-right">${formatCurrency(a.prixUnitaire)}</td>
                      <td class="text-right">${formatCurrency(a.total)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  ${
                    selectedInvoice.total_avant_remise
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(selectedInvoice.total_avant_remise)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${selectedInvoice.remise_type === "pourcentage" ? selectedInvoice.remise_valeur + "%" : formatCurrency(selectedInvoice.remise_valeur || 0)}):</span>
                      <span>-${formatCurrency(selectedInvoice.total_avant_remise - selectedInvoice.total_ttc)}</span>
                    </div>
                  `
                      : ""
                  }
                   <div class="totals-row grand-total">
                     <span>Total TTC:</span>
                     <span>${formatCurrency(selectedInvoice.total_ttc)}</span>
                   </div>
                   ${
                     selectedInvoice.monnaie_rendue > 0
                       ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(selectedInvoice.monnaie_rendue)}</span></div>`
                       : ""
                   }
                  ${
                    (selectedInvoice.montant_restant ?? 0) > 0
                      ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(selectedInvoice.montant_restant!)}</span></div>`
                      : ""
                  }
                </div>
              </div>

              <div >
                Arrete la presente facture a la somme de : <strong>${montantEnLettres(selectedInvoice.total_ttc, "francs CFA")}</strong>
              </div>

              <div class="qr-stamp-section">
                <div class="qr-code">
                  ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
                </div>
                <div >
                </div>
              </div>

              <div class="footer">
                <p class="message">${config?.message_pied || "Merci de votre confiance !"}</p>
                ${config?.support_text ? `<p class="sub">${config.support_text}</p>` : ""}
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
              };
            </script>
          </body>
        </html>
      `);
    } else {
      // Format ticket 80mm
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
                height: auto;
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
    }
    printWindow.document.close();
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
            Factures
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalItems} facture(s) - Total: {formatCurrency(totalFactures)}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Numero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Vendeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Serveur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total TTC
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
              {paginatedInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {invoice.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {invoice.date_facture} {invoice.heure_facture}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {invoice.client_nom || "Client comptoir"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {invoice.vendeur}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {invoice.serveur_nom || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                    {formatCurrency(invoice.total_ttc || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.statut_paiement === "paye"
                          ? "bg-green-100 text-green-700"
                          : invoice.statut_paiement === "partiel"
                            ? "bg-yellow-100 text-yellow-700"
                            : invoice.statut_paiement === "impaye"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                      }`}
                    >
                      {invoice.statut_paiement === "paye"
                        ? "Payé"
                        : invoice.statut_paiement === "partiel"
                          ? "Partiel"
                          : invoice.statut_paiement === "impaye"
                            ? "Impayé"
                            : "Payé"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </button>
                      <button
                        onClick={() => handleOpenEdit(invoice)}
                        className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        title="Modifier la facture (disponible 24h)"
                      >
                        <Edit className="w-4 h-4" />
                        Modifier
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Aucune facture trouvee
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
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
                    {isA4 ? "Facture" : "Ticket"} {selectedInvoice.numero}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {selectedInvoice.date_facture} a{" "}
                    {selectedInvoice.heure_facture} - Format{" "}
                    {isA4 ? "A4" : "80mm"}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu de la facture */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-600 flex justify-center">
              {isA4 ? (
                /* Format A4 - Facture professionnelle */
                <div
                  ref={invoiceRef}
                  className="bg-white shadow-xl dark:text-gray-900"
                  style={{
                    width: "210mm",
                    minHeight: "350mm",
                    padding: "15mm",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    color: "#333",
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: "20px",
                      borderBottom: "3px solid #2563eb",
                      marginBottom: "25px",
                    }}
                  >
                    <div>
                      {logoBase64 && (
                        <img
                          src={logoBase64}
                          alt="Logo"
                          style={{
                            maxHeight: "80px",
                            maxWidth: "160px",
                            marginBottom: "8px",
                            objectFit: "contain",
                          }}
                        />
                      )}
                      <h1
                        style={{
                          fontSize: "22px",
                          color: "#1e40af",
                          marginBottom: "5px",
                          fontWeight: "bold",
                        }}
                      >
                        {config?.nom_entreprise || "Mon Entreprise"}
                      </h1>
                      {config?.description_entreprise && (
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#666",
                            fontStyle: "italic",
                            marginBottom: "8px",
                          }}
                        >
                          {config.description_entreprise}
                        </p>
                      )}
                      {config?.adresse && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555",
                            margin: "2px 0",
                          }}
                        >
                          {config.adresse}
                          {config?.ville ? ", " + config.ville : ""}
                        </p>
                      )}
                      {config?.telephone && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555",
                            margin: "2px 0",
                          }}
                        >
                          Tel: {config.telephone}
                          {config?.telephone2 ? " / " + config.telephone2 : ""}
                        </p>
                      )}
                      {config?.email && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555",
                            margin: "2px 0",
                          }}
                        >
                          {config.email}
                        </p>
                      )}
                      {config?.nif && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555",
                            margin: "2px 0",
                          }}
                        >
                          NIF: {config.nif}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        background: "#2563eb",
                        color: "white",
                        padding: "8px 20px",
                        borderRadius: "6px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                        FACTURE
                      </div>
                      <div style={{ fontSize: "12px" }}>
                        N° {selectedInvoice.numero}
                      </div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "25px",
                    }}
                  >
                    <div
                      style={{
                        width: "48%",
                        background: "#f8fafc",
                        padding: "15px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.5px",
                          marginBottom: "8px",
                          paddingBottom: "5px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Informations Client
                      </h3>
                      <p
                        style={{
                          margin: "3px 0",
                          fontWeight: "bold",
                          color: "#1e293b",
                        }}
                      >
                        {selectedInvoice.client_nom || "Client comptoir"}
                      </p>
                      {selectedInvoice.client_telephone && (
                        <p style={{ margin: "3px 0", fontSize: "12px" }}>
                          Tel: {selectedInvoice.client_telephone}
                        </p>
                      )}
                      {selectedInvoice.client_email && (
                        <p style={{ margin: "3px 0", fontSize: "12px" }}>
                          Email: {selectedInvoice.client_email}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        width: "48%",
                        background: "#f8fafc",
                        padding: "15px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.5px",
                          marginBottom: "8px",
                          paddingBottom: "5px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Details Facture
                      </h3>
                      <p style={{ margin: "3px 0", fontSize: "12px" }}>
                        <strong>Date:</strong> {selectedInvoice.date_facture}
                      </p>
                      <p style={{ margin: "3px 0", fontSize: "12px" }}>
                        <strong>Heure:</strong> {selectedInvoice.heure_facture}
                      </p>
                      <p style={{ margin: "3px 0", fontSize: "12px" }}>
                        <strong>Caissier:</strong> {selectedInvoice.vendeur}
                      </p>
                      {selectedInvoice.serveur_nom && (
                        <p style={{ margin: "3px 0", fontSize: "12px" }}>
                          <strong>Serveur:</strong>{" "}
                          {selectedInvoice.serveur_nom}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Table des articles */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      margin: "20px 0",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "white",
                            padding: "10px 12px",
                            textAlign: "left",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            borderRadius: "6px 0 0 0",
                          }}
                        >
                          Designation
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "white",
                            padding: "10px 12px",
                            textAlign: "right",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          Qte
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "white",
                            padding: "10px 12px",
                            textAlign: "right",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          Prix Unitaire
                        </th>
                        <th
                          style={{
                            background: "#1e40af",
                            color: "white",
                            padding: "10px 12px",
                            textAlign: "right",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            borderRadius: "0 6px 0 0",
                          }}
                        >
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.articles.map((article, index) => (
                        <tr
                          key={index}
                          style={{
                            background: index % 2 === 0 ? "white" : "#f8fafc",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "12px",
                            }}
                          >
                            {article.designation}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "12px",
                              textAlign: "right",
                            }}
                          >
                            {article.quantite}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "12px",
                              textAlign: "right",
                            }}
                          >
                            {formatCurrency(article.prixUnitaire)}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontSize: "12px",
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

                  {/* Totaux */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "15px",
                    }}
                  >
                    <div
                      style={{
                        width: "320px",
                        background: "#f0f9ff",
                        borderRadius: "8px",
                        border: "1px solid #bae6fd",
                        padding: "12px 15px",
                      }}
                    >
                      {selectedInvoice.total_avant_remise && (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "6px 0",
                              fontSize: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            <span>Sous-total:</span>
                            <span>
                              {formatCurrency(
                                selectedInvoice.total_avant_remise,
                              )}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "6px 0",
                              fontSize: "12px",
                              color: "#dc2626",
                            }}
                          >
                            <span>
                              Remise (
                              {selectedInvoice.remise_type === "pourcentage"
                                ? selectedInvoice.remise_valeur + "%"
                                : formatCurrency(
                                    selectedInvoice.remise_valeur || 0,
                                  )}
                              ):
                            </span>
                            <span>
                              -
                              {formatCurrency(
                                selectedInvoice.total_avant_remise -
                                  selectedInvoice.total_ttc,
                              )}
                            </span>
                          </div>
                        </>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "10px 0 6px 0",
                          fontSize: "20px",
                          fontWeight: "bold",
                          color: "#1e40af",
                          borderTop: "2px solid #1e40af",
                          marginTop: "5px",
                        }}
                      >
                        <span>Total TTC:</span>
                        <span>{formatCurrency(selectedInvoice.total_ttc)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "14px",
                          margin: "4px 0",
                        }}
                      >
                        <span>Montant recu:</span>
                        <span>
                          {formatCurrency(selectedInvoice.montant_paye)}
                        </span>
                      </div>
                      {selectedInvoice.monnaie_rendue > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "14px",
                            margin: "4px 0",
                          }}
                        >
                          <span>Monnaie rendue:</span>
                          <span>
                            {formatCurrency(selectedInvoice.monnaie_rendue)}
                          </span>
                        </div>
                      )}
                      {(selectedInvoice.montant_restant ?? 0) > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "14px",
                            margin: "4px 0",
                            color: "#dc2626",
                            fontWeight: "bold",
                          }}
                        >
                          <span>Reste a payer:</span>
                          <span>
                            {formatCurrency(selectedInvoice.montant_restant!)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrêté la présente facture */}
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "10px 15px",
                      borderRadius: "6px",
                      fontStyle: "italic",
                      fontSize: "11px",
                    }}
                  >
                    Arrêté la présente facture à la somme de :{" "}
                    <strong>
                      {montantEnLettres(
                        selectedInvoice.total_ttc,
                        "francs CFA",
                      )}
                    </strong>
                  </div>

                  {/* QR Code et Cachet */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginTop: "30px",
                      padding: "20px 0",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      {qrCodeUrl && (
                        <>
                          <img
                            src={qrCodeUrl}
                            alt="QR Code"
                            style={{ width: "120px", height: "120px" }}
                          />
                          <p
                            style={{
                              fontSize: "9px",
                              color: "#64748b",
                              marginTop: "4px",
                            }}
                          >
                            Scanner pour vérifier
                          </p>
                        </>
                      )}
                    </div>
                    <div
                      style={{
                        width: "200px",
                        height: "120px",
                        border: "2px dashed #cbd5e1",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textAlign: "center",
                        }}
                      >
                        Cachet et signature
                        <br />
                        du gérant
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      marginTop: "40px",
                      textAlign: "center",
                      paddingTop: "15px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#1e40af",
                        marginBottom: "5px",
                      }}
                    >
                      {config?.message_pied || "Merci de votre confiance !"}
                    </p>
                    {config?.support_text && (
                      <p style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {config.support_text}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Format ticket 80mm */
                <div
                  ref={invoiceRef}
                  className="ticket bg-white shadow-xl dark:text-gray-900"
                  style={{
                    width: "80mm",
                    padding: "3mm",
                    minHeight: "300mm",
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
                    {logoBase64 && (
                      <img
                        src={logoBase64}
                        alt="Logo"
                        style={{
                          maxHeight: "40px",
                          maxWidth: "60mm",
                          marginBottom: "2mm",
                          objectFit: "contain",
                        }}
                      />
                    )}
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
                    {config?.nif && (
                      <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                        NIF: {config.nif}
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
                    {selectedInvoice.client_telephone && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          margin: "1mm 0",
                        }}
                      >
                        <span>Tel:</span>
                        <span>{selectedInvoice.client_telephone}</span>
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
                      <span>Recu:</span>
                      <span>
                        {formatCurrency(selectedInvoice.montant_paye)}
                      </span>
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
                    {(selectedInvoice.montant_restant ?? 0) > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          fontWeight: "bold",
                          margin: "1mm 0",
                          color: "red",
                        }}
                      >
                        <span>Reste à payer:</span>
                        <span>
                          {formatCurrency(selectedInvoice.montant_restant!)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div style={{ textAlign: "center", paddingTop: "3mm" }}>
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        style={{
                          width: "25mm",
                          height: "25mm",
                          margin: "0 auto",
                        }}
                      />
                    </div>
                  )}

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
                    <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                      --------------------------------
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="p-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-4 rounded-b-2xl flex-shrink-0">
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
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-black rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
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

      {/* Modal de modification de facture */}
      {showEditModal && editInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">
                    Modifier la facture {editInvoice.numero}
                  </h2>
                  <p className="text-green-100 text-sm">
                    Ajoutez ou retirez des produits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="hover:bg-white/20 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {!canModify.canModify && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <p className="text-red-700">{canModify.reason}</p>
                </div>
              )}

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ajouter un produit
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Rechercher un produit..."
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
                  />
                </div>
                {showProductDropdown && productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="p-3 text-gray-500 dark:text-gray-400 text-center">
                        Aucun produit trouvé
                      </p>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>{product.nom}</span>
                          </div>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(product.prix_vente)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Articles de la facture
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Produit
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 w-32">
                          Quantité
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                          Prix
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                          Total
                        </th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editArticles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                          >
                            Aucun article
                          </td>
                        </tr>
                      ) : (
                        editArticles.map((article) => (
                          <tr
                            key={article.tempId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {article.nom}
                                {(!article.produit_id ||
                                  article.produit_id === 0) && (
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Produit introuvable
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      article.tempId,
                                      article.quantite - 1,
                                    )
                                  }
                                  className="w-7 h-7 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-gray-200"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-bold">
                                  {article.quantite}
                                </span>
                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      article.tempId,
                                      article.quantite + 1,
                                    )
                                  }
                                  className="w-7 h-7 bg-green-600 text-white rounded flex items-center justify-center hover:bg-green-700"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm">
                              {formatCurrency(article.prix_unitaire)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">
                              {formatCurrency(article.sous_total)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() =>
                                  handleRemoveArticle(article.tempId)
                                }
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Nouveau total
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(editTotal)}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={
                  saving || editArticles.length === 0 || !canModify.canModify
                }
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
