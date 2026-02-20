import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useContext,
} from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  Check,
  Package,
  X,
  Zap,
  Keyboard,
  Printer,
  Receipt,
  User,
  UserPlus,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { Product, Sale, Configuration } from "../types";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { SidebarContext } from "../components/Layout";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { montantEnLettres } from "../utils/numberToWords";
import { showSaleToast, showErrorToast } from "../utils/toast";
import { generateInvoiceQR } from "../utils/qrcode";

// Interface pour le ticket
interface ReceiptData {
  numero: string;
  date: string;
  heure: string;
  caissier: string;
  client_nom?: string;
  client_telephone?: string;
  client_email?: string;
  articles: Array<{
    designation: string;
    quantite: number;
    prixUnitaire: number;
    total: number;
  }>;
  totalTTC: number;
  methodePaiement: string;
  montantPaye: number;
  monnaieRendue: number;
  montantRestant?: number;
  remiseType?: "pourcentage" | "montant";
  remiseValeur?: number;
  totalAvantRemise?: number;
}

// Composant de prévisualisation du ticket/facture
const ReceiptPreview: React.FC<{
  receipt: ReceiptData;
  onClose: () => void;
  onPrint: () => void;
  config: Configuration | null;
  logoBase64: string | null;
}> = ({ receipt, onClose, onPrint, config, logoBase64 }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const format = config?.format_facture || "80mm";
  const isA4 = format === "A4";
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Générer le QR code
  useEffect(() => {
    const remise = receipt.totalAvantRemise
      ? receipt.totalAvantRemise - receipt.totalTTC
      : 0;
    generateInvoiceQR({
      numero: receipt.numero,
      date: receipt.date,
      client: receipt.client_nom || "Client comptoir",
      totalAchat: receipt.totalAvantRemise || receipt.totalTTC,
      remise,
      tva: 0,
      totalTTC: receipt.totalTTC,
      devise: config?.devise,
    })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(null));
  }, [receipt, config?.devise]);

  const handlePrint = async () => {
    if (!receiptRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (isA4) {
      // Format A4 - Facture professionnelle compacte
      const remiseAmount =
        receipt.remiseValeur && receipt.remiseValeur > 0
          ? receipt.remiseType === "pourcentage"
            ? ((receipt.totalAvantRemise || 0) * receipt.remiseValeur) / 100
            : receipt.remiseValeur
          : 0;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${receipt.numero}</title>
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
                  <div class="numero">N° ${receipt.numero}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${receipt.client_nom}</strong></p>
                  ${receipt.client_telephone ? `<p>Tel: ${receipt.client_telephone}</p>` : ""}
                  ${receipt.client_email ? `<p>${receipt.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Facture</h3>
                  <p><strong>Date:</strong> ${receipt.date} | <strong>Heure:</strong> ${receipt.heure}</p>
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
                  ${receipt.articles
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
                    receipt.remiseValeur != null && receipt.remiseValeur > 0
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(receipt.totalAvantRemise || 0)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${receipt.remiseType === "pourcentage" ? receipt.remiseValeur + "%" : "fixe"}):</span>
                      <span>-${formatCurrency(remiseAmount)}</span>
                    </div>
                  `
                      : ""
                  }
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(receipt.totalTTC)}</span>
                  </div>
                  <div class="totals-row payment-info">
                    <span>Reglement: ${receipt.methodePaiement} | Recu: ${formatCurrency(receipt.montantPaye)}</span>
                  </div>
                  ${
                    receipt.monnaieRendue > 0
                      ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(receipt.monnaieRendue)}</span></div>`
                      : ""
                  }
                  ${
                    receipt.montantRestant != null && receipt.montantRestant > 0
                      ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(receipt.montantRestant)}</span></div>`
                      : ""
                  }
                </div>
              </div>

              <div >
                Arrete la presente facture a la somme de : <strong>${montantEnLettres(receipt.totalTTC, "francs CFA")}</strong>
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
        receipt.remiseValeur && receipt.remiseValeur > 0
          ? receipt.remiseType === "pourcentage"
            ? ((receipt.totalAvantRemise || 0) * receipt.remiseValeur) / 100
            : receipt.remiseValeur
          : 0;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${receipt.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A5; margin: 6mm 6mm 25mm 6mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #333; }
              .invoice { max-width: 136mm; margin: 0 auto; }
              .header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a; margin-bottom: 8px; }
              .company-logo { display: flex; align-items: center; }
              .company-logo img { max-height: 70px; max-width: 90px; object-fit: contain; }
              .company-info { flex: 1; padding: 0 12px; text-align: center; }
              .company-info h1 { font-size: 16px; font-weight: bold; color: #1e3a8a; margin-bottom: 3px; }
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
                  <div class="numero">N° ${receipt.numero}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${receipt.client_nom}</strong></p>
                  ${receipt.client_telephone ? `<p>Tel: ${receipt.client_telephone}</p>` : ""}
                  ${receipt.client_email ? `<p>${receipt.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Facture</h3>
                  <p><strong>Date:</strong> ${receipt.date} | <strong>Heure:</strong> ${receipt.heure}</p>
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
                  ${receipt.articles.map((a) => `
                    <tr>
                      <td>${a.designation}</td>
                      <td class="text-right">${a.quantite}</td>
                      <td class="text-right">${formatCurrency(a.prixUnitaire)}</td>
                      <td class="text-right">${formatCurrency(a.total)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  ${receipt.remiseValeur != null && receipt.remiseValeur > 0 ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(receipt.totalAvantRemise || 0)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${receipt.remiseType === "pourcentage" ? receipt.remiseValeur + "%" : "fixe"}):</span>
                      <span>-${formatCurrency(remiseAmountA5)}</span>
                    </div>
                  ` : ""}
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(receipt.totalTTC)}</span>
                  </div>
                  <div class="totals-row payment-info">
                    <span>Reglement: ${receipt.methodePaiement} | Recu: ${formatCurrency(receipt.montantPaye)}</span>
                  </div>
                  ${receipt.monnaieRendue > 0 ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(receipt.monnaieRendue)}</span></div>` : ""}
                  ${receipt.montantRestant != null && receipt.montantRestant > 0 ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(receipt.montantRestant)}</span></div>` : ""}
                </div>
              </div>

              <div class="amount-words">
                Arrêté à : <strong>${montantEnLettres(receipt.totalTTC, "francs CFA")}</strong>
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
            <title>Ticket - ${receipt.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: 80mm auto; margin: 2mm; }
              body { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 12px; line-height: 1.4; color: #000; background: white; width: 76mm; margin: 0 auto; }
              .ticket { width: 76mm; padding: 2mm; background: white; }
              .ticket-header { text-align: center; padding-bottom: 3mm; border-bottom: 1px dashed #000; margin-bottom: 3mm; }
              .ticket-header h1 { font-size: 14px; font-weight: bold; margin-bottom: 2mm; text-transform: uppercase; }
              .ticket-header p { font-size: 10px; margin: 1mm 0; }
              @media print { body { width: 76mm; } .ticket { width: 76mm; } }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="ticket-header">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 40px; max-width: 60mm; margin-bottom: 2mm; object-fit: contain;" />` : ""}
                <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                ${config?.telephone ? `<p>Tel: ${config.telephone}</p>` : ""}
                ${config?.telephone2 ? `<p>${config.telephone2}</p>` : ""}
                ${config?.adresse ? `<p>${config.adresse}</p>` : ""}
                ${config?.nif ? `<p>NIF: ${config.nif}</p>` : ""}
              </div>
              ${receiptRef.current.innerHTML}
            </div>
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
    onPrint();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ${isA4 ? "max-w-4xl" : "max-w-md"} w-full max-h-[95vh] flex flex-col animate-scaleIn`}
      >
        {/* En-tete du modal */}
        <div className="relative bg-blue-600 text-white px-8 py-5 rounded-t-2xl shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {format !== "80mm" ? "Facture" : "Ticket de caisse"}
              </h2>
              <p className="text-white/80 text-sm">
                Apercu avant impression - Format {format}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-200 dark:bg-gray-600 flex justify-center">
          {format !== "80mm" ? (
            /* Format A4/A5 - Facture professionnelle */
            <div
              ref={receiptRef}
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
                  <div style={{ fontSize: "12px" }}>N° {receipt.numero}</div>
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
                    {receipt.client_nom || "Client comptoir"}
                  </p>
                  {receipt.client_telephone && (
                    <p style={{ margin: "3px 0", fontSize: "12px" }}>
                      Tel: {receipt.client_telephone}
                    </p>
                  )}
                  {receipt.client_email && (
                    <p style={{ margin: "3px 0", fontSize: "12px" }}>
                      Email: {receipt.client_email}
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
                    <strong>Date:</strong> {receipt.date}
                  </p>
                  <p style={{ margin: "3px 0", fontSize: "12px" }}>
                    <strong>Heure:</strong> {receipt.heure}
                  </p>
                  <p style={{ margin: "3px 0", fontSize: "12px" }}>
                    <strong>Caissier:</strong> {receipt.caissier}
                  </p>
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
                  {receipt.articles.map((article, index) => (
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
                  {receipt.remiseValeur != null && receipt.remiseValeur > 0 && (
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
                          {formatCurrency(receipt.totalAvantRemise || 0)}
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
                          {receipt.remiseType === "pourcentage"
                            ? `${receipt.remiseValeur}%`
                            : "fixe"}
                          ):
                        </span>
                        <span>
                          -
                          {formatCurrency(
                            receipt.remiseType === "pourcentage"
                              ? ((receipt.totalAvantRemise || 0) *
                                  receipt.remiseValeur) /
                                  100
                              : receipt.remiseValeur,
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
                    <span>{formatCurrency(receipt.totalTTC)}</span>
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
                    <span>{receipt.methodePaiement}</span>
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
                    <span>{formatCurrency(receipt.montantPaye)}</span>
                  </div>
                  {receipt.monnaieRendue > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        margin: "4px 0",
                      }}
                    >
                      <span>Monnaie rendue:</span>
                      <span>{formatCurrency(receipt.monnaieRendue)}</span>
                    </div>
                  )}
                  {receipt.montantRestant != null &&
                    receipt.montantRestant > 0 && (
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
                        <span>{formatCurrency(receipt.montantRestant)}</span>
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
                  {montantEnLettres(receipt.totalTTC, "francs CFA")}
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
              ref={receiptRef}
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
                }}
              >
                TICKET N° {receipt.numero}
              </div>

              {/* Informations */}
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
                    fontSize: "11px",
                    margin: "1mm 0",
                  }}
                >
                  <span>Date:</span>
                  <span>{receipt.date}</span>
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
                  <span>{receipt.heure}</span>
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
                  <span>{receipt.caissier}</span>
                </div>

                {receipt.client_nom && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      margin: "1mm 0",
                    }}
                  >
                    <span>Client:</span>
                    <span>{receipt.client_nom}</span>
                  </div>
                )}
                {receipt.client_telephone && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      margin: "1mm 0",
                    }}
                  >
                    <span>Tel:</span>
                    <span>{receipt.client_telephone}</span>
                  </div>
                )}
              </div>

              {/* Articles */}
              <div style={{ marginBottom: "3mm", paddingBottom: "3mm" }}>
                {receipt.articles.map((article, index) => (
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
                ))}
              </div>

              {/* Totaux */}
              <div
                style={{
                  marginBottom: "3mm",
                  paddingBottom: "3mm",
                  borderBottom: "1px dashed #000",
                }}
              >
                {receipt.remiseValeur != null && receipt.remiseValeur > 0 && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        marginTop: "2mm",
                        paddingTop: "2mm",
                        borderTop: "1px solid #000",
                      }}
                    >
                      <span>Sous-total:</span>
                      <span>
                        {formatCurrency(receipt.totalAvantRemise || 0)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        margin: "1mm 0",
                        color: "#059669",
                      }}
                    >
                      <span>
                        Remise (
                        {receipt.remiseType === "pourcentage"
                          ? `${receipt.remiseValeur}%`
                          : "fixe"}
                        ):
                      </span>
                      <span>
                        -
                        {formatCurrency(
                          receipt.remiseType === "pourcentage"
                            ? ((receipt.totalAvantRemise || 0) *
                                receipt.remiseValeur) /
                                100
                            : receipt.remiseValeur,
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
                    marginTop:
                      receipt.remiseValeur && receipt.remiseValeur > 0
                        ? "1mm"
                        : "2mm",
                    paddingTop:
                      receipt.remiseValeur && receipt.remiseValeur > 0
                        ? "1mm"
                        : "2mm",
                    borderTop:
                      receipt.remiseValeur && receipt.remiseValeur > 0
                        ? "none"
                        : "1px solid #000",
                  }}
                >
                  <span>TOTAL:</span>
                  <span>{formatCurrency(receipt.totalTTC)}</span>
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
                  <span>{receipt.methodePaiement}</span>
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
                  <span>{formatCurrency(receipt.montantPaye)}</span>
                </div>
                {receipt.monnaieRendue > 0 && (
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
                    <span>{formatCurrency(receipt.monnaieRendue)}</span>
                  </div>
                )}
                {receipt.montantRestant != null &&
                  receipt.montantRestant > 0 && (
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
                      <span>{formatCurrency(receipt.montantRestant)}</span>
                    </div>
                  )}
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div style={{ textAlign: "center", paddingTop: "3mm" }}>
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    style={{ width: "25mm", height: "25mm", margin: "0 auto" }}
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
                  {config?.message_pied}
                </p>
                <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                  --------------------------------
                </p>
                {config?.support_text && (
                  <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                    {config.support_text}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="p-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-4 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
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
            {isA4 ? "Imprimer la facture" : "Imprimer le ticket"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant ProductCard mémorisé pour optimiser les rendus
const ProductCard = React.memo<{
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  imageCache: Map<number, string>;
}>(({ product, onAddToCart, onViewDetails, imageCache }) => {
  const isOutOfStock = !product.sans_stock && product.quantite_stock === 0;
  const isAtAlertThreshold =
    !product.sans_stock && product.quantite_stock <= product.stock_min;
  const isDisabled = isOutOfStock || isAtAlertThreshold;

  return (
    <div
      className={`group relative card text-left transition-all duration-300 transform ${
        isDisabled
          ? "opacity-50"
          : "hover:scale-105 hover:shadow-xl hover:border-blue-400 hover:-translate-y-1"
      }`}
    >
      {/* Badge seuil d'alerte atteint */}
      {!isOutOfStock && isAtAlertThreshold && (
        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-lg z-10 animate-pulse">
          !
        </div>
      )}

      {/* Badge rupture de stock */}
      {isOutOfStock && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-lg z-10">
          ✕
        </div>
      )}

      <div className="flex flex-col h-full">
        {/* Icône produit ou image - cliquable pour voir les détails */}
        <div
          onClick={() => onViewDetails(product)}
          className="mb-1 rounded p-1 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors overflow-hidden cursor-pointer"
        >
          {product.image_url && imageCache.get(product.id!) ? (
            <img
              src={imageCache.get(product.id!)}
              alt={product.nom}
              className="w-full h-15 object-contain rounded"
            />
          ) : (
            <Package className="w-5 h-5 text-blue-600 mx-auto" />
          )}
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-white mb-0.5 text-xs line-clamp-1 group-hover:text-blue-600 transition-colors">
          {product.nom}
        </h3>

        <div className="flex items-center gap-0.5 mb-1">
          <span className="text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1 py-0.5 rounded-full truncate">
            {product.categorie_nom || "Sans catégorie"}
          </span>
        </div>

        <div className="mt-auto pt-1 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm font-bold text-blue-600 mb-0.5">
            {formatCurrency(product.prix_vente || 0)}
          </p>
          <div className="flex items-center justify-between">
            <p
              className={`text-[10px] font-medium ${
                product.sans_stock
                  ? "text-purple-600"
                  : isOutOfStock
                    ? "text-red-600"
                    : isAtAlertThreshold
                      ? "text-orange-600"
                      : "text-green-600"
              }`}
            >
              {product.sans_stock ? "∞" : `stock: ${product.quantite_stock}`}
            </p>
            {!isDisabled && (
              <button
                onClick={() => onAddToCart(product)}
                className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          {isAtAlertThreshold && !isOutOfStock && !product.sans_stock && (
            <p className="text-[9px] text-orange-600 font-medium mt-0.5">
              Seuil: {product.stock_min}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = "ProductCard";

const ProductRow = React.memo<{
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  imageCache: Map<number, string>;
}>(({ product, onAddToCart, onViewDetails, imageCache }) => {
  const isOutOfStock = !product.sans_stock && product.quantite_stock === 0;
  const isAtAlertThreshold =
    !product.sans_stock && product.quantite_stock <= product.stock_min;
  const isDisabled = isOutOfStock || isAtAlertThreshold;

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 ${
        isDisabled
          ? "opacity-50 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md"
      }`}
    >
      <div
        onClick={() => onViewDetails(product)}
        className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"
      >
        {product.image_url && imageCache.get(product.id!) ? (
          <img
            src={imageCache.get(product.id!)}
            alt={product.nom}
            className="w-full h-full object-contain"
          />
        ) : (
          <Package className="w-6 h-6 text-gray-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {product.nom}
          </h3>
          {product.sans_stock && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Sans stock
            </span>
          )}
          {!product.sans_stock && isOutOfStock && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              Rupture
            </span>
          )}
          {!product.sans_stock && !isOutOfStock && isAtAlertThreshold && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
              Stock bas
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {product.categorie_nom || "Sans catégorie"} • Code:{" "}
          {product.code_barre || "N/A"}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-bold text-blue-600">
          {formatCurrency(product.prix_vente || 0)}
        </p>
        <p
          className={`text-xs ${
            product.sans_stock
              ? "text-purple-600"
              : isOutOfStock
                ? "text-red-600"
                : isAtAlertThreshold
                  ? "text-orange-600"
                  : "text-green-600"
          }`}
        >
          {product.sans_stock ? "Stock: ∞" : `Stock: ${product.quantite_stock}`}
        </p>
      </div>

      {!isDisabled && (
        <button
          onClick={() => onAddToCart(product)}
          className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

ProductRow.displayName = "ProductRow";

const PointOfSale: React.FC = () => {
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateCartItemPrice,
    updateAllCartPrices,
    clearCart,
    getCartTotal,
  } = useStore();
  const { user } = useAuthStore();
  const sidebarContext = useContext(SidebarContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [montantPaye, setMontantPaye] = useState("");
  const [imageCache, setImageCache] = useState<Map<number, string>>(new Map());
  const [methodePaiement, setMethodePaiement] = useState<
    "especes" | "carte" | "mobile"
  >("especes");
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [clientName, setClientName] = useState("");
  const [venteACredit, setVenteACredit] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  // États pour la remise
  const [remiseType, setRemiseType] = useState<"pourcentage" | "montant">(
    "pourcentage",
  );
  const [remiseValeur, setRemiseValeur] = useState<string>("");
  const [productViewMode, setProductViewMode] = useState<"list" | "card">(
    "list",
  );
  const [cartViewMode, setCartViewMode] = useState<"list" | "card">("list");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientPrices, setClientPrices] = useState<Map<number, number>>(
    new Map(),
  );
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [newClientNom, setNewClientNom] = useState("");
  const [newClientTelephone, setNewClientTelephone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const handleViewProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
    setShowProductDetail(false);
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

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

  const loadClients = async () => {
    try {
      const data = await window.electronAPI.getClients();
      setClients(data);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
    }
  };

  useEffect(() => {
    loadProducts();
    loadConfig();
    loadClients();
  }, [currentPage, itemsPerPage]);

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape pour fermer le modal
      if (e.key === "Escape" && showPayment) {
        setShowPayment(false);
        setMontantPaye("");
        return;
      }

      // F2 pour focus sur recherche
      if (e.key === "F2" && !showPayment) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F9 pour ouvrir le paiement
      if (e.key === "F9" && cart.length > 0 && !showPayment) {
        e.preventDefault();
        setShowPayment(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPayment, cart.length]);

  // Fermer le dropdown client si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node)
      ) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadClientPrices = async () => {
      if (selectedClientId) {
        try {
          const prices =
            await window.electronAPI.getClientPrices(selectedClientId);
          const priceMap = new Map<number, number>();
          (prices as any[]).forEach((p) => {
            priceMap.set(p.produit_id, p.prix_personnalise);
          });
          setClientPrices(priceMap);
          updateAllCartPrices(priceMap);
        } catch (error) {
          console.error("Erreur chargement prix client:", error);
          setClientPrices(new Map());
          updateAllCartPrices(new Map());
        }
      } else {
        setClientPrices(new Map());
        updateAllCartPrices(new Map());
      }
    };
    loadClientPrices();
  }, [selectedClientId]);

  const handleAddToCart = (product: Product) => {
    if (!product.sans_stock) {
      const cartItem = cart.find((item) => item.id === product.id);
      const currentQty = cartItem ? cartItem.quantity : 0;
      if (currentQty >= product.quantite_stock) {
        showErrorToast(
          `Stock insuffisant pour "${product.nom}" (disponible : ${product.quantite_stock})`,
        );
        return;
      }
    }
    const customPrice = clientPrices.get(product.id!);
    addToCart(product, customPrice);
  };

  const handleCreateClient = async () => {
    if (!newClientNom.trim()) return;
    setCreatingClient(true);
    try {
      const created = await window.electronAPI.createClient({
        nom: newClientNom.trim(),
        telephone: newClientTelephone.trim() || undefined,
        email: newClientEmail.trim() || undefined,
      });

      // Enregistrer automatiquement les prix actuels du panier comme premiers prix du client
      if (cart.length > 0) {
        const prices = cart.map((item) => ({
          client_id: created.id,
          produit_id: item.id!,
          prix_personnalise:
            item.customPrice !== undefined ? item.customPrice : item.prix_vente,
        }));
        await window.electronAPI.bulkCreateClientPrices(created.id, prices);
      }

      await loadClients();
      setSelectedClientId(created.id);
      setClientName(created.nom);
      setShowCreateClientModal(false);
      setNewClientNom("");
      setNewClientTelephone("");
      setNewClientEmail("");
    } catch (error: any) {
      console.error("Erreur création client:", error);
      if (
        error?.message?.includes("UNIQUE constraint failed") ||
        error?.message?.includes("telephone")
      ) {
        showErrorToast("Un client avec ce numéro de téléphone existe déjà");
      } else {
        showErrorToast("Erreur lors de la création du client");
      }
    } finally {
      setCreatingClient(false);
    }
  };

  // Filtrer les clients selon la recherche
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.nom?.toLowerCase().includes(query) ||
        client.telephone?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query),
    );
  }, [clients, clientSearchQuery]);

  // Focus auto sur l'input de paiement
  useEffect(() => {
    if (showPayment && methodePaiement === "especes") {
      setTimeout(() => paymentInputRef.current?.focus(), 100);
    }
  }, [showPayment, methodePaiement]);

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.getProductsPaginated(
        currentPage,
        itemsPerPage,
        searchQuery || undefined,
      );
      setProducts(result.data);
      setTotalItems(result.total);

      // Charger les images pour les produits de la page actuelle seulement
      const cache = new Map<number, string>();
      for (const product of result.data) {
        if (product.image_url) {
          const imageBase64 = await window.electronAPI.getProductImage(
            product.image_url,
          );
          if (imageBase64) {
            cache.set(product.id!, imageBase64);
          }
        }
      }
      setImageCache(cache);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
  };

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
        const results = await window.electronAPI.searchProductsFTS(
          query,
          itemsPerPage * 5,
        );
        setProducts(results);
        setTotalItems(results.length);
        setSearchQuery(query);

        // Charger les images pour les résultats de recherche
        const cache = new Map<number, string>();
        for (const product of results) {
          if (product.image_url) {
            const imageBase64 = await window.electronAPI.getProductImage(
              product.image_url,
            );
            if (imageBase64) {
              cache.set(product.id!, imageBase64);
            }
          }
        }
        setImageCache(cache);
      } catch (error) {
        console.error("Erreur recherche produits:", error);
      }
    },
    [itemsPerPage],
  );

  // Pagination calculée avec useMemo (maintenant basée sur products au lieu de searchResults)
  const { totalPages, paginatedProducts } = useMemo(() => {
    const pages = Math.ceil(totalItems / itemsPerPage);
    // Si products contient plus d'une page (résultats FTS non paginés côté serveur),
    // on applique une pagination locale. Sinon, le serveur a déjà renvoyé la bonne page.
    if (products.length > itemsPerPage) {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginated = products.slice(startIndex, startIndex + itemsPerPage);
      return { totalPages: pages, paginatedProducts: paginated };
    }
    return { totalPages: pages, paginatedProducts: products };
  }, [products, currentPage, itemsPerPage, totalItems]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  }, []);

  // Sous-total avant remise
  const sousTotal = useMemo(() => getCartTotal(), [cart]);

  // Calcul du montant de la remise
  const montantRemise = useMemo(() => {
    const valeur = parseFloat(remiseValeur) || 0;
    if (valeur <= 0) return 0;
    if (remiseType === "pourcentage") {
      return Math.min((sousTotal * valeur) / 100, sousTotal);
    }
    return Math.min(valeur, sousTotal);
  }, [sousTotal, remiseType, remiseValeur]);

  // Total après remise
  const total = useMemo(
    () => Math.max(0, sousTotal - montantRemise),
    [sousTotal, montantRemise],
  );

  const monnaieRendue = useMemo(
    () => (montantPaye ? Math.max(0, parseFloat(montantPaye) - total) : 0),
    [montantPaye, total],
  );

  // Suggestions de montants rapides
  const quickAmounts = useMemo(() => {
    const amounts = [total];
    const roundedUp = Math.ceil(total / 1000) * 1000;
    if (roundedUp > total) amounts.push(roundedUp);
    amounts.push(roundedUp + 1000, roundedUp + 5000);
    return [...new Set(amounts)].slice(0, 4);
  }, [total]);

  const handleQuickAmount = useCallback((amount: number) => {
    setMontantPaye(amount.toString());
  }, []);

  // Générer le numéro de ticket
  const generateReceiptNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `${year}${month}${day}-${random}`;
  };

  // Créer les données du ticket
  const createReceiptData = useCallback((): ReceiptData => {
    const now = new Date();

    return {
      numero: generateReceiptNumber(),
      date: now.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      heure: now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      caissier: user?.nom || "Caissier",
      client_nom: clientName || undefined,
      client_telephone: selectedClientId
        ? clients.find((c) => c.id === selectedClientId)?.telephone
        : undefined,
      client_email: selectedClientId
        ? clients.find((c) => c.id === selectedClientId)?.email
        : undefined,
      articles: cart.map((item) => {
        const effectivePrice =
          item.customPrice !== undefined ? item.customPrice : item.prix_vente;
        return {
          designation: item.nom,
          quantite: item.quantity,
          prixUnitaire: effectivePrice,
          total: effectivePrice * item.quantity,
        };
      }),
      totalTTC: total,
      methodePaiement:
        methodePaiement === "especes"
          ? "Espèces"
          : methodePaiement === "carte"
            ? "Carte bancaire"
            : "Mobile Money",
      montantPaye: venteACredit
        ? parseFloat(montantPaye) || 0
        : methodePaiement === "especes"
          ? parseFloat(montantPaye)
          : total,
      monnaieRendue:
        !venteACredit && methodePaiement === "especes" ? monnaieRendue : 0,
      montantRestant: venteACredit
        ? total - (parseFloat(montantPaye) || 0)
        : undefined,
      // Informations de remise
      remiseType: montantRemise > 0 ? remiseType : undefined,
      remiseValeur: montantRemise > 0 ? parseFloat(remiseValeur) : undefined,
      totalAvantRemise: montantRemise > 0 ? sousTotal : undefined,
    };
  }, [
    cart,
    total,
    sousTotal,
    montantRemise,
    remiseType,
    remiseValeur,
    methodePaiement,
    montantPaye,
    monnaieRendue,
    user,
    clientName,
    venteACredit,
    selectedClientId,
    clients,
  ]);

  const handlePayment = useCallback(async () => {
    if (cart.length === 0) {
      showErrorToast("Le panier est vide");
      return;
    }

    const montant = parseFloat(montantPaye) || 0;

    if (venteACredit && !selectedClientId) {
      showErrorToast("Sélectionnez un client pour une vente à crédit");
      return;
    }

    if (venteACredit && montant > total) {
      showErrorToast(
        "Le montant payé ne peut pas dépasser le total de la vente",
      );
      return;
    }

    if (!venteACredit && methodePaiement === "especes" && montant < total) {
      showErrorToast("Le montant payé est insuffisant");
      return;
    }

    setProcessing(true);

    try {
      const effectiveMontantPaye = venteACredit
        ? parseFloat(montantPaye) || 0
        : methodePaiement === "especes"
          ? montant
          : total;
      const effectiveMontantRestant = total - effectiveMontantPaye;
      const effectiveStatut: "paye" | "partiel" | "impaye" =
        effectiveMontantRestant <= 0
          ? "paye"
          : effectiveMontantPaye > 0
            ? "partiel"
            : "impaye";

      const saleData: Sale = {
        client_id: selectedClientId || undefined,
        client_nom: clientName || "Client comptoir",
        total,
        montant_paye: effectiveMontantPaye,
        monnaie_rendue:
          !venteACredit && methodePaiement === "especes" ? monnaieRendue : 0,
        methode_paiement: methodePaiement,
        montant_restant:
          effectiveMontantRestant > 0 ? effectiveMontantRestant : 0,
        statut_paiement: effectiveStatut,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
        // Informations de remise
        remise_type: montantRemise > 0 ? remiseType : undefined,
        remise_valeur: montantRemise > 0 ? parseFloat(remiseValeur) : undefined,
        total_avant_remise: montantRemise > 0 ? sousTotal : undefined,
        produits: cart.map((item) => {
          const effectivePrice =
            item.customPrice !== undefined ? item.customPrice : item.prix_vente;
          return {
            produit_id: item.id!,
            nom_produit: item.nom,
            quantite: item.quantity,
            prix_unitaire: effectivePrice,
            sous_total: effectivePrice * item.quantity,
          };
        }),
      };

      // Creer la vente et recuperer l'ID
      const saleResult = await window.electronAPI.createSale(saleData);

      // Enregistrer les prix effectifs de la vente comme prix personnalisés du client
      if (selectedClientId && cart.length > 0) {
        const prices = cart.map((item) => ({
          client_id: selectedClientId,
          produit_id: item.id!,
          prix_personnalise:
            item.customPrice !== undefined ? item.customPrice : item.prix_vente,
        }));
        await window.electronAPI.bulkCreateClientPrices(
          selectedClientId,
          prices,
        );
      }

      // Creer et afficher la facture
      const receipt = createReceiptData();

      // Récupérer les informations du client sélectionné
      const selectedClient = selectedClientId
        ? clients.find((c) => c.id === selectedClientId)
        : null;

      // Sauvegarder la facture liee a la vente
      const invoiceData = {
        numero: receipt.numero,
        vente_id: saleResult.id,
        date_facture: receipt.date,
        heure_facture: receipt.heure,
        vendeur: receipt.caissier,
        client_nom: clientName || "Client comptoir",
        client_telephone: selectedClient?.telephone || undefined,
        client_email: selectedClient?.email || undefined,
        total_ttc: receipt.totalTTC,
        methode_paiement: receipt.methodePaiement,
        montant_paye: receipt.montantPaye,
        monnaie_rendue: receipt.monnaieRendue,
        montant_restant: receipt.montantRestant || 0,
        statut_paiement: effectiveStatut,
        // Informations de remise
        remise_type: receipt.remiseType,
        remise_valeur: receipt.remiseValeur,
        total_avant_remise: receipt.totalAvantRemise,
        articles: receipt.articles,
      };

      await window.electronAPI.createInvoice(invoiceData);

      setReceiptData(receipt);
      setShowReceipt(true);

      // Fermer le modal de paiement et reset crédit
      setShowPayment(false);
      setMontantPaye("");
      setMethodePaiement("especes");
      setVenteACredit(false);
      setSelectedClientId(null);

      showSaleToast(total);
    } catch (error) {
      console.error("Erreur enregistrement vente:", error);
      showErrorToast("Erreur lors de l'enregistrement de la vente");
    } finally {
      setProcessing(false);
    }
  }, [
    cart,
    montantPaye,
    methodePaiement,
    total,
    sousTotal,
    montantRemise,
    remiseType,
    remiseValeur,
    monnaieRendue,
    clientName,
    user,
    createReceiptData,
    venteACredit,
    selectedClientId,
    clients,
  ]);

  const handleReceiptClose = useCallback(() => {
    setShowReceipt(false);
    setReceiptData(null);
    clearCart();
    // Réinitialiser la remise
    setRemiseType("pourcentage");
    setRemiseValeur("");
    loadProducts();
  }, [clearCart]);

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6">
      {/* Gauche - Liste des produits */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* En-tête avec stats */}

        {/* Recherche améliorée avec toggle vue */}
        <div className="card shadow-lg">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher un produit par nom ou code-barre..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setProductViewMode("list")}
                className={`p-2 rounded-md transition-all ${
                  productViewMode === "list"
                    ? "bg-white dark:bg-gray-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
                title="Vue liste"
              >
                <LayoutList className="w-5 h-5" />
              </button>
              <button
                onClick={() => setProductViewMode("card")}
                className={`p-2 rounded-md transition-all ${
                  productViewMode === "card"
                    ? "bg-white dark:bg-gray-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
                title="Vue cartes"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {totalItems} résultat
              {totalItems > 1 ? "s" : ""} trouvé
              {totalItems > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Grille de produits améliorée */}
        <div className="flex-1 overflow-y-auto card shadow-lg">
          {paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-linear-to-br from-gray-100 to-gray-200 rounded-full p-8 mb-4 animate-pulse">
                <Package className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aucun produit trouvé
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "Essayez une autre recherche"
                  : "Aucun produit disponible"}
              </p>
            </div>
          ) : (
            <>
              {productViewMode === "card" ? (
                <div
                  className={`grid gap-4 p-4 ${
                    sidebarContext?.isCollapsed
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-7"
                      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6"
                  }`}
                >
                  {paginatedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onViewDetails={handleViewProductDetails}
                      imageCache={imageCache}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {paginatedProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onViewDetails={handleViewProductDetails}
                      imageCache={imageCache}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                itemsPerPageOptions={[10, 20, 40, 60, 100]}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Droite - Panier */}
      <div className="w-130 flex flex-col space-y-4 shrink-0">
        <div className="card flex-1 flex flex-col shadow-xl border-2 border-gray-100 dark:border-gray-700">
          {/* En-tête du panier avec toggle vue */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
            <div className="bg-linear-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Panier
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {cart.length} {cart.length > 1 ? "articles" : "article"}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setCartViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${
                  cartViewMode === "list"
                    ? "bg-white dark:bg-gray-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
                title="Vue cartes"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCartViewMode("card")}
                className={`p-1.5 rounded-md transition-all ${
                  cartViewMode === "card"
                    ? "bg-white dark:bg-gray-800 shadow-sm text-blue-600"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
                title="Vue liste"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                title="Vider le panier"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Client avec recherche */}
          <div className="border-b-2 border-gray-100 dark:border-gray-700 pb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Client
            </label>
            <div ref={clientDropdownRef} className="relative">
              {selectedClientId ? (
                <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {clients
                        .find((c) => c.id === selectedClientId)
                        ?.nom?.charAt(0) || "C"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {clients.find((c) => c.id === selectedClientId)?.nom}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {clients.find((c) => c.id === selectedClientId)
                          ?.telephone || "Pas de téléphone"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClientId(null);
                      setClientName("");
                      setVenteACredit(false);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Rechercher un client..."
                        className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={() => setShowCreateClientModal(true)}
                      className="shrink-0 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Créer un client"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {showClientDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedClientId(null);
                          setClientName("");
                          setClientSearchQuery("");
                          setShowClientDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700"
                      >
                        <div className="w-7 h-7 bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-xs font-bold">
                          ?
                        </div>
                        <div>
                          <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                            Client comptoir
                          </p>
                          <p className="text-xs text-gray-400">
                            Sans compte client
                          </p>
                        </div>
                      </button>
                      {filteredClients.length === 0 ? (
                        <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Aucun client trouvé
                        </div>
                      ) : (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setClientName(client.nom);
                              setClientSearchQuery("");
                              setShowClientDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {client.nom?.charAt(0) || "C"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                {client.nom}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {client.telephone ||
                                  client.email ||
                                  "Pas de contact"}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nom du client (optionnel)..."
                    className="w-full mt-2 px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                  />
                </>
              )}
              {selectedClientId && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={venteACredit}
                    onChange={(e) => setVenteACredit(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-gray-300 dark:border-gray-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-orange-700">
                    Vente à crédit
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Items du panier */}
          <div className="flex-1 overflow-y-auto mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-8 w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                  <ShoppingCart className="w-16 h-16 text-gray-300" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Le panier est vide
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Ajoutez des produits pour commencer
                </p>
              </div>
            ) : cartViewMode === "card" ? (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-linear-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 animate-slideIn"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white leading-tight mb-1">
                          {item.nom}
                        </h4>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={
                              item.customPrice !== undefined
                                ? item.customPrice
                                : item.prix_vente || 0
                            }
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              updateCartItemPrice(item.id!, newPrice);
                            }}
                            className={`w-24 text-xs px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                              item.customPrice !== undefined
                                ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                                : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                            }`}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            / unité
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id!)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
                        <button
                          onClick={() =>
                            updateCartQuantity(item.id!, item.quantity - 1)
                          }
                          className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 active:scale-95 flex items-center justify-center transition-all"
                        >
                          <Minus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                        </button>
                        <span className="w-10 text-center font-bold text-gray-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCartQuantity(item.id!, item.quantity + 1)
                          }
                          disabled={
                            !item.sans_stock &&
                            item.quantity >= item.quantite_stock
                          }
                          className="w-8 h-8 bg-blue-600 rounded-md hover:bg-blue-700 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">
                          {formatCurrency(
                            Number(
                              item.customPrice !== undefined
                                ? item.customPrice
                                : item.prix_vente || 0,
                            ) * item.quantity,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                    <th className="py-2 px-2 font-medium">Produit</th>
                    <th className="py-2 px-2 font-medium text-center w-20">
                      Qté
                    </th>
                    <th className="py-2 px-2 font-medium text-center w-28">
                      Prix U.
                    </th>
                    <th className="py-2 px-2 font-medium text-right w-24">
                      Total
                    </th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cart.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/50 transition-colors animate-slideIn"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="py-2 px-2">
                        <div
                          className="font-medium text-gray-900 dark:text-white truncate"
                          title={item.nom}
                        >
                          {item.nom}
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() =>
                              updateCartQuantity(item.id!, item.quantity - 1)
                            }
                            className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
                          >
                            <Minus className="w-3 h-3 text-gray-700 dark:text-gray-300" />
                          </button>
                          <span className="w-6 text-center font-bold text-gray-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item.id!, item.quantity + 1)
                            }
                            disabled={
                              !item.sans_stock &&
                              item.quantity >= item.quantite_stock
                            }
                            className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={
                            item.customPrice !== undefined
                              ? item.customPrice
                              : item.prix_vente || 0
                          }
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0;
                            updateCartItemPrice(item.id!, newPrice);
                          }}
                          className={`w-full text-center text-xs px-1 py-1 border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                            item.customPrice !== undefined
                              ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                          }`}
                          title="Cliquer pour modifier le prix"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-bold text-blue-600">
                          {formatCurrency(
                            Number(
                              item.customPrice !== undefined
                                ? item.customPrice
                                : item.prix_vente || 0,
                            ) * item.quantity,
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-1">
                        <button
                          onClick={() => removeFromCart(item.id!)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Total et actions */}
          <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4 space-y-4">
            {/* Sous-totaux */}
            {cart.length > 0 && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Sous-total</span>
                  <span className="font-medium">
                    {formatCurrency(sousTotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Articles</span>
                  <span className="font-medium">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>

                {/* Section Remise */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      Remise:
                    </span>
                    <select
                      value={remiseType}
                      onChange={(e) =>
                        setRemiseType(
                          e.target.value as "pourcentage" | "montant",
                        )
                      }
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pourcentage">%</option>
                      <option value="montant">Montant</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max={remiseType === "pourcentage" ? 100 : sousTotal}
                      value={remiseValeur}
                      onChange={(e) => setRemiseValeur(e.target.value)}
                      placeholder={remiseType === "pourcentage" ? "0%" : "0"}
                      className="w-20 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {remiseValeur && parseFloat(remiseValeur) > 0 && (
                      <button
                        onClick={() => setRemiseValeur("")}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {montantRemise > 0 && (
                    <div className="flex justify-between text-blue-600 font-medium">
                      <span>
                        Remise (
                        {remiseType === "pourcentage"
                          ? `${remiseValeur}%`
                          : "fixe"}
                        )
                      </span>
                      <span>-{formatCurrency(montantRemise)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total principal */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-black-700 dark:text-black">
                  Total à payer
                </span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(total || 0)}
                </span>
              </div>
              {montantRemise > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  Remise: {formatCurrency(montantRemise)}
                </div>
              )}
            </div>

            {/* Bouton de paiement */}
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="relative overflow-hidden w-full py-4 bg-blue-600  hover:to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group"
            >
              <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span>Procéder au paiement</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                F9
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full modal-content animate-scaleIn flex flex-col max-h-[calc(100vh-2rem)] my-auto">
            {/* En-tête du modal */}
            <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white px-6 py-6 rounded-t-2xl shrink-0">
              <button
                onClick={() => {
                  setShowPayment(false);
                  setMontantPaye("");
                }}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                disabled={processing}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Finaliser le paiement</h2>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20 mt-4">
                <p className="text-blue-100 text-sm mb-1">Montant total</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(total || 0)}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Méthode de paiement */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Méthode de paiement
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setMethodePaiement("especes");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "especes"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "especes"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200"
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "especes"
                          ? "text-blue-700"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Espèces
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setMethodePaiement("carte");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "carte"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "carte"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200"
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "carte"
                          ? "text-blue-700"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Carte
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setMethodePaiement("mobile");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "mobile"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "mobile"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200"
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "mobile"
                          ? "text-blue-700"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      Mobile
                    </p>
                  </button>
                </div>
              </div>

              {/* Montant payé */}
              {(methodePaiement === "especes" || venteACredit) && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      {venteACredit
                        ? "Montant payé maintenant"
                        : "Montant reçu"}
                    </label>
                    <div className="relative">
                      <input
                        ref={paymentInputRef}
                        type="number"
                        value={montantPaye}
                        onChange={(e) => setMontantPaye(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (
                              venteACredit ||
                              parseFloat(montantPaye) >= total
                            ) {
                              handlePayment();
                            }
                          }
                        }}
                        step="0.01"
                        min={0}
                        max={venteACredit ? total : undefined}
                        className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                        FCFA
                      </span>
                    </div>
                    {!venteACredit &&
                      montantPaye &&
                      parseFloat(montantPaye) < total && (
                        <p className="text-red-600 text-sm mt-2 flex items-center gap-1 animate-pulse font-semibold">
                          Montant insuffisant
                        </p>
                      )}
                    {venteACredit &&
                      montantPaye &&
                      parseFloat(montantPaye) > total && (
                        <p className="text-red-600 text-sm mt-2 flex items-center gap-1 animate-pulse font-semibold">
                          Le montant ne peut pas dépasser{" "}
                          {formatCurrency(total)}
                        </p>
                      )}
                  </div>

                  {/* Boutons de montants rapides */}
                  {!venteACredit && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Montants rapides
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {quickAmounts.map((amount) => (
                          <button
                            key={amount}
                            onClick={() => handleQuickAmount(amount)}
                            className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all hover:scale-105 active:scale-95 ${
                              parseFloat(montantPaye) === amount
                                ? "bg-blue-600 text-white shadow-lg"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reste à payer (mode crédit) */}
              {venteACredit && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-orange-600 rounded-lg p-1.5">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-orange-800">
                      Reste à payer (crédit)
                    </p>
                  </div>
                  <p className="text-4xl font-bold text-orange-600">
                    {formatCurrency(total - (parseFloat(montantPaye) || 0))}
                  </p>
                  <p className="text-xs text-orange-700 mt-2">
                    Ce montant sera ajouté à la dette du client
                  </p>
                </div>
              )}

              {/* Monnaie à rendre (mode normal espèces) */}
              {!venteACredit &&
                methodePaiement === "especes" &&
                montantPaye &&
                parseFloat(montantPaye) >= total && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5 animate-slideDown">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-green-600 rounded-lg p-1.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-green-800">
                        Monnaie à rendre
                      </p>
                    </div>
                    <p className="text-4xl font-bold text-green-600">
                      {formatCurrency(monnaieRendue || 0)}
                    </p>
                    {monnaieRendue > 0 && (
                      <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                        <Keyboard className="w-3 h-3" />
                        Appuyez sur Entrée pour valider
                      </p>
                    )}
                  </div>
                )}

              {/* Résumé pour carte et mobile (mode normal) */}
              {!venteACredit &&
                (methodePaiement === "carte" ||
                  methodePaiement === "mobile") && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                    <p className="text-sm text-blue-800 mb-2 font-medium">
                      Montant exact à payer
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(total || 0)}
                    </p>
                    <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                      <Keyboard className="w-3 h-3" />
                      Appuyez sur Entrée pour valider
                    </p>
                  </div>
                )}

              {/* Boutons d'action */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowPayment(false);
                    setMontantPaye("");
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-300 rounded-xl font-semibold transition-all hover:shadow-md active:scale-95 flex items-center justify-center gap-2"
                  disabled={processing}
                >
                  <X className="w-4 h-4" />
                  Annuler
                  <span className="text-xs bg-gray-200 dark:bg-gray-500 px-1.5 py-0.5 rounded">
                    ESC
                  </span>
                </button>
                <button
                  onClick={handlePayment}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !processing) {
                      handlePayment();
                    }
                  }}
                  disabled={
                    processing ||
                    (!venteACredit &&
                      methodePaiement === "especes" &&
                      parseFloat(montantPaye) < total) ||
                    (venteACredit && (parseFloat(montantPaye) || 0) > total)
                  }
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {processing ? (
                    <span className="animate-pulse">
                      Traitement en cours...
                    </span>
                  ) : (
                    <>
                      Valider la vente
                      <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                        ↵
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails du produit */}
      {showProductDetail && selectedProduct && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full animate-scaleIn border-4 border-white">
            <div className="relative bg-blue-600 text-white px-8 py-6 rounded-t-3xl">
              <button
                onClick={handleCloseProductDetail}
                className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all hover:rotate-90 duration-300"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-start gap-4">
                {selectedProduct.image_url &&
                imageCache.get(selectedProduct.id!) ? (
                  <img
                    src={imageCache.get(selectedProduct.id!)}
                    alt={selectedProduct.nom}
                    className="w-24 h-24 object-contain bg-white/20 rounded-xl p-2"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package className="w-12 h-12 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2">
                    {selectedProduct.nom}
                  </h2>
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                    {selectedProduct.categorie_nom || "Sans catégorie"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 to-indigo-50 rounded-2xl p-5">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Prix de vente
                  </p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(selectedProduct.prix_vente || 0)}
                  </p>
                </div>
                <div className="bg-green-50 to-emerald-50 rounded-2xl p-5">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Stock disponible
                  </p>
                  {selectedProduct.sans_stock ? (
                    <p className="text-3xl font-bold text-purple-600">∞</p>
                  ) : (
                    <p
                      className={`text-3xl font-bold ${
                        selectedProduct.quantite_stock <=
                        selectedProduct.stock_min
                          ? "text-orange-600"
                          : selectedProduct.quantite_stock === 0
                            ? "text-red-600"
                            : "text-green-600"
                      }`}
                    >
                      {selectedProduct.quantite_stock}
                    </p>
                  )}
                </div>
              </div>

              {selectedProduct.description && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Description
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Code-barre
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedProduct.code_barre || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Stock minimum
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedProduct.sans_stock
                      ? "—"
                      : selectedProduct.stock_min}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Prix d'achat
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(selectedProduct.prix_achat || 0)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Marge
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {(
                      (selectedProduct.prix_vente || 0) -
                      (selectedProduct.prix_achat || 0)
                    ).toFixed(2)}{" "}
                    FCFA
                  </p>
                </div>
              </div>

              {(selectedProduct.sans_stock ||
                selectedProduct.quantite_stock > selectedProduct.stock_min) && (
                <button
                  onClick={() => {
                    handleAddToCart(selectedProduct);
                    handleCloseProductDetail();
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter au panier
                </button>
              )}

              {!selectedProduct.sans_stock &&
                selectedProduct.quantite_stock <= selectedProduct.stock_min && (
                  <div className="text-center">
                    <p className="text-orange-600 font-semibold mb-2">
                      Stock insuffisant
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedProduct.quantite_stock === 0
                        ? "Ce produit est épuisé"
                        : `Seuil d'alerte atteint (minimum: ${selectedProduct.stock_min})`}
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation du ticket */}
      {showReceipt && receiptData && (
        <ReceiptPreview
          receipt={receiptData}
          config={config}
          logoBase64={logoBase64}
          onClose={handleReceiptClose}
          onPrint={handleReceiptClose}
        />
      )}

      {/* Mini modal - Créer un client */}
      {showCreateClientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Nouveau client
              </h3>
              <button
                onClick={() => {
                  setShowCreateClientModal(false);
                  setNewClientNom("");
                  setNewClientTelephone("");
                  setNewClientEmail("");
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientNom}
                  onChange={(e) => setNewClientNom(e.target.value)}
                  placeholder="Nom du client"
                  autoFocus
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  value={newClientTelephone}
                  onChange={(e) => setNewClientTelephone(e.target.value)}
                  placeholder="Numéro de téléphone"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="Adresse email"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowCreateClientModal(false);
                  setNewClientNom("");
                  setNewClientTelephone("");
                  setNewClientEmail("");
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateClient}
                disabled={!newClientNom.trim() || creatingClient}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingClient ? "Création..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointOfSale;
