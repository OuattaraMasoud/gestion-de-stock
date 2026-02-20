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
import { montantEnLettres } from "../utils/numberToWords";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";
import { generateInvoiceQR } from "../utils/qrcode";

const SalesHistory: React.FC = () => {
  const { user } = useAuthStore();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
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
    if (!selectedInvoice || !invoiceRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (isA4) {
      // Format A4 - Facture professionnelle compacte
      const remiseAmount =
        selectedInvoice.remise_valeur > 0
          ? selectedInvoice.remise_type === "pourcentage"
            ? ((selectedInvoice.total_avant_remise || 0) *
                selectedInvoice.remise_valeur) /
              100
            : selectedInvoice.remise_valeur
          : 0;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${selectedInvoice.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4; margin: 8mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #333; }
              .invoice { max-width: 194mm; margin: 0 auto; }
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
                      (a: any) => `
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
                    selectedInvoice.remise_valeur > 0
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(selectedInvoice.total_avant_remise || 0)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${selectedInvoice.remise_type === "pourcentage" ? selectedInvoice.remise_valeur + "%" : "fixe"}):</span>
                      <span>-${formatCurrency(remiseAmount)}</span>
                    </div>
                  `
                      : ""
                  }
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(selectedInvoice.total_ttc)}</span>
                  </div>
                  <div class="totals-row payment-info">
                    <span>Reglement: ${selectedInvoice.methode_paiement} | Recu: ${formatCurrency(selectedInvoice.montant_paye)}</span>
                  </div>
                  ${
                    selectedInvoice.monnaie_rendue > 0
                      ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(selectedInvoice.monnaie_rendue)}</span></div>`
                      : ""
                  }
                  ${
                    (selectedInvoice.montant_restant ?? 0) > 0
                      ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(selectedInvoice.montant_restant)}</span></div>`
                      : ""
                  }
                </div>
              </div>

              <div class="amount-words">
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
    } else if (format === "A5") {
      // Format A5 - Facture compacte
      const remiseAmountA5 =
        selectedInvoice.remise_valeur > 0
          ? selectedInvoice.remise_type === "pourcentage"
            ? ((selectedInvoice.total_avant_remise || 0) *
                selectedInvoice.remise_valeur) /
              100
            : selectedInvoice.remise_valeur
          : 0;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${selectedInvoice.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A5; margin: 6mm 6mm 25mm 6mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #333; }
              .invoice { max-width: 136mm; margin: 0 auto; }
              .header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a; margin-bottom: 8px; }
              .company-logo { display: flex; align-items: center; }
              .company-logo img { max-height: 70px; max-width: 90px; object-fit: contain; }
              .company-info { flex: 1; padding: 0 12px; text-align: center; }
              .company-info h1 { font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .company-info .slogan { font-size: 10px; color: #1e3a8a; margin: 0; }
              .invoice-badge { background: #1e3a8a; color: white; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-align: center; min-width: 65px; }
              .invoice-badge .numero { font-size: 8px; font-weight: normal; margin-top: 1px; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
              .info-box { width: 48%; background: #f8fafc; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
              .info-box h3 { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.3px; margin-bottom: 3px; padding-bottom: 2px; border-bottom: 1px solid #e2e8f0; }
              .info-box p { margin: 1px 0; font-size: 9px; }
              .info-box strong { color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin: 6px 0; }
              thead th { background: #1e40af; color: white; padding: 5px 6px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.2px; }
              thead th:first-child { border-radius: 4px 0 0 0; }
              thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
              thead th.text-right { text-align: right; }
              tbody td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
              tbody tr:nth-child(even) { background: #f8fafc; }
              tbody td.text-right { text-align: right; }
              .totals-section { display: flex; justify-content: flex-end; margin-top: 6px; }
              .totals-box { width: 200px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd; padding: 6px 8px; }
              .totals-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; }
              .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
              .totals-row.discount { color: #dc2626; }
              .totals-row.grand-total { font-size: 11px; font-weight: bold; color: #1e40af; border-top: 2px solid #1e40af; padding-top: 4px; margin-top: 3px; }
              .totals-row.payment-info { border-top: 1px dashed #bae6fd; padding-top: 4px; margin-top: 3px; font-size: 8px; }
              .totals-row.remaining { color: #dc2626; font-weight: bold; }
              .amount-words { margin-top: 6px; padding: 4px 8px; background: #fefce8; border: 1px solid #fde68a; border-radius: 4px; font-style: italic; font-size: 8px; color: #92400e; }
              .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; padding-top: 6px; }
              .qr-code { text-align: center; }
              .qr-code img { width: 60px; height: 60px; }
              .qr-code p { font-size: 7px; color: #64748b; margin-top: 2px; }
              .footer { position: fixed; bottom: 6mm; left: 6mm; right: 6mm; border-top: 1px solid #2563eb; padding-top: 4px; text-align: center; font-size: 7.5px; color: #1e40af; line-height: 1.5; }
              .footer p { margin: 1px 0; }
              .footer strong { font-weight: 700; }
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
                  ${config?.description_entreprise ? `<p class="slogan">${config.description_entreprise}</p>` : ""}
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
                    <th class="text-right" style="width: 35px;">Qte</th>
                    <th class="text-right" style="width: 70px;">P.U.</th>
                    <th class="text-right" style="width: 70px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedInvoice.articles
                    .map(
                      (a: any) => `
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
                    selectedInvoice.remise_valeur > 0
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(selectedInvoice.total_avant_remise || 0)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${selectedInvoice.remise_type === "pourcentage" ? selectedInvoice.remise_valeur + "%" : "fixe"}):</span>
                      <span>-${formatCurrency(remiseAmountA5)}</span>
                    </div>
                  `
                      : ""
                  }
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(selectedInvoice.total_ttc)}</span>
                  </div>
                  <div class="totals-row payment-info">
                    <span>Reglement: ${selectedInvoice.methode_paiement} | Recu: ${formatCurrency(selectedInvoice.montant_paye)}</span>
                  </div>
                  ${selectedInvoice.monnaie_rendue > 0 ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(selectedInvoice.monnaie_rendue)}</span></div>` : ""}
                  ${(selectedInvoice.montant_restant ?? 0) > 0 ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(selectedInvoice.montant_restant)}</span></div>` : ""}
                </div>
              </div>

              <div >
                Arrêté à : <strong>${montantEnLettres(selectedInvoice.total_ttc, "francs CFA")}</strong>
              </div>

              <div class="qr-stamp-section">
                <div class="qr-code">
                  ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
                </div>
              </div>

              <div class="footer">
                <p>${config?.message_pied || "Merci de votre confiance !"}</p>
                ${config?.support_text ? `<p>${config.support_text}</p>` : ""}
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
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: 80mm auto; margin: 2mm; }
              body { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 12px; line-height: 1.4; color: #000; background: white; width: 76mm; margin: 0 auto; }
              .ticket { width: 76mm; padding: 2mm; background: white; }
              @media print { body { width: 76mm; } .ticket { width: 76mm; } }
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
        <div className="flex gap-4 items-end">
          <div className="flex-1">
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
          <div className="flex-1">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {sale.client_nom || "Client comptoir"}
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
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
            <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-600 flex justify-center">
              {format !== "80mm" ? (
                /* Format A4/A5 - Facture professionnelle */
                <div
                  ref={invoiceRef}
                  className="bg-white shadow-xl dark:text-gray-900"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    padding: "15mm",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    color: "#333",
                    ...(format === "A5" && {
                      transform: "scale(0.703)",
                      transformOrigin: "top center",
                    }),
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
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
                            fontSize: "13px",
                            color: "#666",
                            fontStyle: "italic",
                            marginBottom: "4px",
                            textAlign: "center",
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
                      {selectedInvoice.articles.map(
                        (article: any, index: number) => (
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
                        ),
                      )}
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
                      {selectedInvoice.remise_valeur > 0 && (
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
                                selectedInvoice.total_avant_remise || 0,
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
                                ? `${selectedInvoice.remise_valeur}%`
                                : "fixe"}
                              ):
                            </span>
                            <span>
                              -
                              {formatCurrency(
                                selectedInvoice.remise_type === "pourcentage"
                                  ? (selectedInvoice.total_avant_remise || 0) *
                                      (selectedInvoice.remise_valeur / 100)
                                  : selectedInvoice.remise_valeur,
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
                          fontSize: "16px",
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
                          fontSize: "12px",
                          padding: "8px 0 4px 0",
                          marginTop: "6px",
                          borderTop: "1px dashed #bae6fd",
                        }}
                      >
                        <span>Mode de paiement:</span>
                        <span>{selectedInvoice.methode_paiement}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
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
                            fontSize: "12px",
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
                            fontSize: "12px",
                            margin: "4px 0",
                            color: "#dc2626",
                            fontWeight: "bold",
                          }}
                        >
                          <span>Reste a payer:</span>
                          <span>
                            {formatCurrency(selectedInvoice.montant_restant)}
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
                    {logoBase64 && (
                      <img
                        src={logoBase64}
                        alt="Logo"
                        style={{
                          maxHeight: "75px",
                          maxWidth: "100mm",
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

                  <div style={{ marginBottom: "3mm", paddingBottom: "3mm" }}>
                    {selectedInvoice.articles.map(
                      (article: any, index: number) => (
                        <div key={index} style={{ margin: "2mm 0" }}>
                          <div style={{ fontSize: "11px", fontWeight: "bold" }}>
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

                  <div style={{ marginBottom: "3mm", paddingBottom: "3mm" }}>
                    {selectedInvoice.remise_valeur > 0 && (
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
                          <span>
                            {formatCurrency(
                              selectedInvoice.total_avant_remise || 0,
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "11px",
                            margin: "1mm 0",
                          }}
                        >
                          <span>
                            Remise (
                            {selectedInvoice.remise_type === "pourcentage"
                              ? `${selectedInvoice.remise_valeur}%`
                              : "fixe"}
                            ):
                          </span>
                          <span>
                            -
                            {formatCurrency(
                              selectedInvoice.remise_type === "pourcentage"
                                ? (selectedInvoice.total_avant_remise || 0) *
                                    (selectedInvoice.remise_valeur / 100)
                                : selectedInvoice.remise_valeur,
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
                          {formatCurrency(selectedInvoice.montant_restant)}
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

            <div className="p-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-4 rounded-b-2xl flex-shrink-0">
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
    </div>
  );
};

export default SalesHistory;
