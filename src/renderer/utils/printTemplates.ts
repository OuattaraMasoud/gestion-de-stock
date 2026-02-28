import { Configuration } from "../types";
import { formatCurrency } from "./formatters";
import { montantEnLettres } from "./numberToWords";

export interface PrintData {
  numero: string;
  date: string;
  heure?: string;
  document_type: "FACTURE" | "PROFORMA" | "RECU";

  client_nom?: string;
  client_telephone?: string;
  client_email?: string;

  vendeur?: string;
  serveur_nom?: string;
  methode_paiement?: string;
  montant_paye?: number;

  articles: Array<{
    designation: string;
    quantite: number;
    prix_unitaire: number;
    total: number;
  }>;

  total_avant_remise?: number;
  remise_type?: string;
  remise_valeur?: number;
  total_ttc: number;
  monnaie_rendue?: number;
  montant_restant?: number;

  livraison_differee?: boolean;
  notes?: string;
  date_validite?: string;
  solde_badge?: "SOLDÉ" | "EN COURS";

  show_fiscal_footer?: boolean;
}

function buildFiscalFooterContent(config: Configuration | null): string {
  return [
    [
      config?.telephone
        ? `<strong>Tél:</strong> ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}`
        : "",
      config?.email ? `<strong>Email:</strong> ${config.email}` : "",
      config?.adresse
        ? `<strong>Adresse:</strong> ${config.adresse}${config?.ville ? " " + config.ville : ""}`
        : "",
    ]
      .filter(Boolean)
      .join("&nbsp;&nbsp;"),
    [
      config?.secteur || "",
      config?.nif ? `<strong>IFU:</strong> ${config.nif}` : "",
      config?.rccm ? `<strong>RCCM:</strong> ${config.rccm}` : "",
      config?.regime_fiscal
        ? `<strong>Régime fiscal:</strong> ${config.regime_fiscal}`
        : "",
    ]
      .filter(Boolean)
      .join("&nbsp;&nbsp;"),
    [
      config?.division_fiscale
        ? `<strong>Division fiscale:</strong> ${config.division_fiscale}`
        : "",
      config?.numero_compte_uba
        ? `<strong>N° Compte UBA:</strong> ${config.numero_compte_uba}`
        : "",
    ]
      .filter(Boolean)
      .join("&nbsp;&nbsp;"),
    config?.reference_cadastrale
      ? `<strong>Réf. cadastrales:</strong> ${config.reference_cadastrale}`
      : "",
  ]
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function buildTableTotals(data: PrintData): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";
  const remiseAmount = (data.total_avant_remise ?? 0) - data.total_ttc;
  let rows = "";

  if (data.total_avant_remise && remiseAmount > 0) {
    rows += `<tr class="tfoot-sub"><td colspan="3">Sous-total</td><td class="text-right">${formatCurrency(data.total_avant_remise)}</td></tr>`;
    rows += `<tr class="tfoot-sub"><td colspan="3">Remise (${data.remise_type === "pourcentage" ? data.remise_valeur + "%" : formatCurrency(data.remise_valeur || 0)})</td><td class="text-right">-${formatCurrency(remiseAmount)}</td></tr>`;
  }
  rows += `<tr class="tfoot-total"><td colspan="3">Total Général</td><td class="text-right">${formatCurrency(data.total_ttc)}</td></tr>`;

  if (!isProforma) {
    if (isRecu && (data.montant_paye ?? 0) > 0) {
      rows += `<tr class="tfoot-pay"><td colspan="3">Montant payé</td><td class="text-right">${formatCurrency(data.montant_paye!)}</td></tr>`;
    }
    if ((data.monnaie_rendue ?? 0) > 0) {
      rows += `<tr class="tfoot-pay"><td colspan="3">Monnaie rendue</td><td class="text-right">${formatCurrency(data.monnaie_rendue!)}</td></tr>`;
    }
    if ((data.montant_restant ?? 0) > 0) {
      rows += `<tr class="tfoot-remaining"><td colspan="3">Reste à payer</td><td class="text-right">${formatCurrency(data.montant_restant!)}</td></tr>`;
    }
    if (isRecu && (data.montant_restant ?? 0) <= 0) {
      rows += `<tr class="tfoot-solde"><td colspan="4">✓ SOLDÉ</td></tr>`;
    }
  }
  return rows;
}

function buildRightInfo(data: PrintData): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";

  if (isProforma) {
    return `
      ${data.date_validite ? `<div class="info-row"><span class="info-label">Valide jusqu'au :</span><span>${data.date_validite}</span></div>` : ""}
      ${data.vendeur ? `<div class="info-row"><span class="info-label">Établi par :</span><span>${data.vendeur}</span></div>` : ""}
    `;
  } else if (isRecu) {
    return `
      ${data.vendeur ? `<div class="info-row"><span class="info-label">Caissier :</span><span>${data.vendeur}</span></div>` : ""}
      ${data.methode_paiement ? `<div class="info-row"><span class="info-label">Règlement :</span><span>${data.methode_paiement}</span></div>` : ""}
    `;
  } else {
    return `
      <div class="info-row"><span class="info-label">Montant à payer :</span><span>${formatCurrency(data.total_ttc)}</span></div>
      ${(data.montant_paye ?? 0) > 0 ? `<div class="info-row"><span class="info-label">Versement :</span><span>${formatCurrency(data.montant_paye!)}</span></div>` : ""}
      ${(data.montant_restant ?? 0) > 0 ? `<div class="info-row"><span class="info-label">Reste à payer :</span><span>${formatCurrency(data.montant_restant!)}</span></div>` : ""}
      ${data.methode_paiement ? `<div class="info-row"><span class="info-label">Règlement :</span><span>${data.methode_paiement}</span></div>` : ""}
      ${data.vendeur ? `<div class="info-row"><span class="info-label">Caissier :</span><span>${data.vendeur}${data.serveur_nom ? " | " + data.serveur_nom : ""}</span></div>` : ""}
    `;
  }
}

// ─── A4 ───────────────────────────────────────────────────────────────────────

export function generateA4HTML(
  data: PrintData,
  config: Configuration | null,
  logoBase64: string | null,
  qrCodeUrl: string | null,
): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";
  const docTitle = isProforma ? "PROFORMA" : isRecu ? "REÇU" : "FACTURE";

  const tfootRows = buildTableTotals(data);
  const rightInfoHTML = buildRightInfo(data);

  const amountWordsSection = !isRecu
    ? `<div class="amount-words">Arrêté la présente ${isProforma ? "proforma" : "facture"} à la somme de : <strong>${montantEnLettres(data.total_ttc, "francs CFA")}</strong></div>`
    : "";

  const deliverySection =
    !isProforma && !isRecu
      ? `<div class="delivery-section"><span class="delivery-status ${data.livraison_differee ? "deferred" : "delivered"}">${data.livraison_differee ? "NON LIVRÉ" : "✓ LIVRÉ"}</span></div>`
      : "";

  const notesSection =
    isProforma && data.notes
      ? `<div class="notes"><strong>Notes :</strong> ${data.notes}</div>`
      : "";

  const signatureSection = !isRecu
    ? `<div class="signatures">
        <div class="sig-box"><div class="sig-title">Le vendeur</div><div class="sig-space"></div><div class="sig-line"></div></div>
        <div class="sig-box"><div class="sig-title">Le Client</div><div class="sig-space"></div><div class="sig-line"></div></div>
      </div>`
    : "";

  let footerContent = data.show_fiscal_footer
    ? buildFiscalFooterContent(config)
    : `<p>${config?.message_pied || "Merci de votre confiance !"}</p>${config?.support_text ? `<p>${config.support_text}</p>` : ""}`;

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${docTitle} - ${data.numero}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; color: #000; line-height: 1.4; background: white; color-scheme: light; }
      .invoice { max-width: 190mm; margin: 0 auto; }

      /* Header */
      .header { display: flex; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 8px; gap: 10px; }
      .company-logo { flex-shrink: 0; }
      .company-logo img { max-height: 80px; max-width: 100px; object-fit: contain; }
      .company-info { flex: 1; text-align: center; }
      .company-info h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
      .company-info .slogan { font-size: 10px; color: #444; font-style: italic; white-space: nowrap; }
      .company-info p { font-size: 11px; margin: 1px 0; }
      .invoice-ref { flex-shrink: 0; text-align: right; }
      .invoice-ref .doc-type { font-size: 14px; font-weight: bold; display: block; }
      .invoice-ref .doc-number { display: inline-block; border: 1.5px solid #000; padding: 3px 10px; font-size: 11px; font-weight: bold; margin-top: 4px; white-space: nowrap; }

      /* Date */
      .date-line { text-align: right; font-size: 14px; margin-bottom: 8px; color: #333; }

      /* Info section */
      .info-section { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 6px 0; border-top: 1px solid #bbb; border-bottom: 1px solid #bbb; }
      .info-col { width: 48%; }
      .info-col h3 { font-size: 15px; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 2px; display: inline-block; }
      .info-row { display: flex; font-size: 14px; margin: 3px 0; gap: 5px; }
      .info-label { font-weight: bold; min-width: 120px; flex-shrink: 0; }

      /* Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      thead th { background: #d4d4d4; padding: 6px 8px; text-align: left; font-size: 15px; border: 1px solid #999; font-weight: bold; }
      thead th.text-right { text-align: right; }
      tbody td { padding: 5px 8px; border: 1px solid #ddd; font-size: 15px; }
      tbody tr:nth-child(even) { background: #f4f4f4; }
      tbody td.text-right { text-align: right; }
      tfoot td { padding: 5px 8px; border: 1px solid #aaa; font-size: 15px; }
      tfoot .tfoot-total td { background: #d4d4d4; font-weight: bold; font-size: 16px; }
      tfoot .tfoot-sub td { background: #e8e8e8; }
      tfoot .tfoot-pay td { background: #f0f0f0; }
      tfoot .tfoot-remaining td { background: #fee2e2; color: #991b1b; font-weight: bold; }
      tfoot .tfoot-solde td { background: #dcfce7; color: #166534; font-weight: bold; text-align: center; }

      /* Below table */
      .amount-words { font-size: 14px; margin: 6px 0 8px; font-style: italic; }
      .delivery-section { margin: 4px 0 8px; }
      .delivery-status { font-weight: bold; padding: 3px 10px; border-radius: 3px; display: inline-block; font-size: 15px; border: 1px solid; }
      .delivered { background: #dcfce7; color: #166534; border-color: #86efac; }
      .deferred { background: #fef3c7; color: #92400e; border-color: #fde68a; }
      .notes { font-size: 14px; margin: 6px 0; padding: 6px 8px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 3px; }

      /* Signatures */
      .signatures { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 10px; }
      .sig-box { width: 30%; text-align: center; }
      .sig-title { font-size: 15px; font-weight: bold; margin-bottom: 3px; }
      .sig-space { height: 160px; }
      .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 13px; }

      /* QR */
      .qr-section { margin-top: 8px; display: flex; align-items: center; gap: 6px; }
      .qr-section img { width: 65px; height: 65px; }
      .qr-section p { font-size: 12px; color: #555; }

      /* Footer */
      .footer { text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 12px; color: #333; line-height: 1.6; }
      .footer p { margin: 1px 0; }
      .footer strong { font-weight: bold; }

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
          ${config?.adresse ? `<p>${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
          ${config?.telephone ? `<p>Tel1: ${config.telephone}${config?.telephone2 ? "  Tel2: " + config.telephone2 : ""}${config?.nif ? "  NIF: " + config.nif : ""}</p>` : ""}
          ${config?.email ? `<p>${config.email}</p>` : ""}
        </div>
        <div class="invoice-ref">
          <span class="doc-type">${docTitle} N°</span>
          <span class="doc-number">${data.numero}</span>
        </div>
      </div>

      <div class="date-line">Date : ${data.date}${data.heure ? " &nbsp; " + data.heure : ""}</div>

      <div class="info-section">
        <div class="info-col">
          <h3>Client</h3>
          <div class="info-row"><span class="info-label">Nom :</span><span>${data.client_nom || "Client comptoir"}</span></div>
          ${data.client_telephone ? `<div class="info-row"><span class="info-label">Téléphone :</span><span>${data.client_telephone}</span></div>` : ""}
          ${data.client_email ? `<div class="info-row"><span class="info-label">Email :</span><span>${data.client_email}</span></div>` : ""}
        </div>
        <div class="info-col">
          ${rightInfoHTML}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="text-right" style="width:50px;">Quantité</th>
            <th class="text-right" style="width:160px;">Prix Unitaire</th>
            <th class="text-right" style="width:160px;">Prix Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.articles
            .map(
              (a) => `
            <tr>
              <td>${a.designation}</td>
              <td class="text-right">${a.quantite}</td>
              <td class="text-right">${formatCurrency(a.prix_unitaire)}</td>
              <td class="text-right">${formatCurrency(a.total)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
        <tfoot>
          ${tfootRows}
        </tfoot>
      </table>

      ${amountWordsSection}
      ${deliverySection}
      ${notesSection}
      ${signatureSection}

      ${qrCodeUrl ? `<div class="qr-section"><img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour vérifier</p></div>` : ""}

      <div class="footer">
        ${footerContent}
      </div>
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
      };
    </script>
  </body>
</html>`;
}

// ─── A5 ───────────────────────────────────────────────────────────────────────

export function generateA5HTML(
  data: PrintData,
  config: Configuration | null,
  logoBase64: string | null,
  qrCodeUrl: string | null,
): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";
  const docTitle = isProforma ? "PROFORMA" : isRecu ? "REÇU" : "FACTURE";

  const tfootRows = buildTableTotals(data);
  const rightInfoHTML = buildRightInfo(data);

  const amountWordsSection = !isRecu
    ? `<div class="amount-words">Arrêté la présente ${isProforma ? "proforma" : "facture"} à la somme de : <strong>${montantEnLettres(data.total_ttc, "francs CFA")}</strong></div>`
    : "";

  const deliverySection =
    !isProforma && !isRecu
      ? `<div class="delivery-section"><span class="delivery-status ${data.livraison_differee ? "deferred" : "delivered"}">${data.livraison_differee ? "NON LIVRÉ" : "✓ LIVRÉ"}</span></div>`
      : "";

  const notesSection =
    isProforma && data.notes
      ? `<div class="notes"><strong>Notes :</strong> ${data.notes}</div>`
      : "";

  const signatureSection = !isRecu
    ? `<div class="signatures">
        <div class="sig-box"><div class="sig-title">Le vendeur</div><div class="sig-space"></div><div class="sig-line"></div></div>
        <div class="sig-box"><div class="sig-title">Le Client</div><div class="sig-space"></div><div class="sig-line"></div></div>
      </div>`
    : "";

  let footerContent = data.show_fiscal_footer
    ? buildFiscalFooterContent(config)
    : `<p>${config?.message_pied || "Merci de votre confiance !"}</p>${config?.support_text ? `<p>${config.support_text}</p>` : ""}`;

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${docTitle} - ${data.numero}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A5; margin: 8mm; }
      body { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #000; line-height: 1.4; background: white; color-scheme: light; }
      .invoice { max-width: 132mm; margin: 0 auto; }

      /* Header */
      .header { display: flex; align-items: flex-start; padding-bottom: 6px; border-bottom: 2px solid #000; margin-bottom: 6px; gap: 8px; }
      .company-logo { flex-shrink: 0; }
      .company-logo img { max-height: 60px; max-width: 75px; object-fit: contain; }
      .company-info { flex: 1; min-width: 0; text-align: center; overflow: hidden; }
      .company-info h1 { font-size: 13px; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .company-info .slogan { font-size: 8px; color: #444; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .company-info p { font-size: 9px; margin: 1px 0; }
      .invoice-ref { flex-shrink: 0; text-align: right; }
      .invoice-ref .doc-type { font-size: 12px; font-weight: bold; display: block; white-space: nowrap; }
      .invoice-ref .doc-number { display: inline-block; border: 1.5px solid #000; padding: 2px 7px; font-size: 9px; font-weight: bold; margin-top: 3px; white-space: nowrap; }

      /* Date */
      .date-line { text-align: right; font-size: 12px; margin-bottom: 6px; color: #333; }

      /* Info section */
      .info-section { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 4px 0; border-top: 1px solid #bbb; border-bottom: 1px solid #bbb; }
      .info-col { width: 48%; }
      .info-col h3 { font-size: 13px; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 1px; display: inline-block; }
      .info-row { display: flex; font-size: 12px; margin: 2px 0; gap: 4px; }
      .info-label { font-weight: bold; min-width: 95px; flex-shrink: 0; }

      /* Table */
      table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
      thead th { background: #d4d4d4; padding: 4px 6px; text-align: left; font-size: 13px; border: 1px solid #999; font-weight: bold; }
      thead th.text-right { text-align: right; }
      tbody td { padding: 3px 6px; border: 1px solid #ddd; font-size: 13px; }
      tbody tr:nth-child(even) { background: #f4f4f4; }
      tbody td.text-right { text-align: right; }
      tfoot td { padding: 4px 6px; border: 1px solid #aaa; font-size: 13px; }
      tfoot .tfoot-total td { background: #d4d4d4; font-weight: bold; font-size: 14px; }
      tfoot .tfoot-sub td { background: #e8e8e8; }
      tfoot .tfoot-pay td { background: #f0f0f0; }
      tfoot .tfoot-remaining td { background: #fee2e2; color: #991b1b; font-weight: bold; }
      tfoot .tfoot-solde td { background: #dcfce7; color: #166534; font-weight: bold; text-align: center; }

      /* Below table */
      .amount-words { font-size: 12px; margin: 5px 0 6px; font-style: italic; }
      .delivery-section { margin: 3px 0 6px; }
      .delivery-status { font-weight: bold; padding: 2px 7px; border-radius: 3px; display: inline-block; font-size: 12px; border: 1px solid; }
      .delivered { background: #dcfce7; color: #166534; border-color: #86efac; }
      .deferred { background: #fef3c7; color: #92400e; border-color: #fde68a; }
      .notes { font-size: 12px; margin: 4px 0; padding: 4px 6px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 3px; }

      /* Signatures */
      .signatures { display: flex; justify-content: space-between; margin-top: 18px; margin-bottom: 8px; }
      .sig-box { width: 30%; text-align: center; }
      .sig-title { font-size: 13px; font-weight: bold; margin-bottom: 2px; }
      .sig-space { height: 110px; }
      .sig-line { border-top: 1px solid #000; padding-top: 2px; font-size: 11px; }

      /* QR */
      .qr-section { margin-top: 6px; display: flex; align-items: center; gap: 5px; }
      .qr-section img { width: 45px; height: 45px; }
      .qr-section p { font-size: 11px; color: #555; }

      /* Footer */
      .footer { text-align: center; margin-top: 8px; padding-top: 5px; border-top: 1px solid #ccc; font-size: 11px; color: #333; line-height: 1.5; }
      .footer p { margin: 1px 0; }
      .footer strong { font-weight: bold; }

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
          ${!isProforma && config?.adresse ? `<p>${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
          ${!isProforma && config?.telephone ? `<p>Tel1: ${config.telephone}${config?.telephone2 ? "  Tel2: " + config.telephone2 : ""}${config?.nif ? "  NIF: " + config.nif : ""}</p>` : ""}
          ${!isProforma && config?.email ? `<p>${config.email}</p>` : ""}
        </div>
        <div class="invoice-ref">
          <span class="doc-type">${docTitle} N°</span>
          <span class="doc-number">${data.numero}</span>
        </div>
      </div>

      <div class="date-line">Date : ${data.date}${data.heure ? " &nbsp; " + data.heure : ""}</div>

      <div class="info-section">
        <div class="info-col">
          <h3>Client</h3>
          <div class="info-row"><span class="info-label">Nom :</span><span>${data.client_nom || "Client comptoir"}</span></div>
          ${data.client_telephone ? `<div class="info-row"><span class="info-label">Téléphone :</span><span>${data.client_telephone}</span></div>` : ""}
          ${data.client_email ? `<div class="info-row"><span class="info-label">Email :</span><span>${data.client_email}</span></div>` : ""}
        </div>
        <div class="info-col">
          ${rightInfoHTML}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="text-right" style="width:35px;">Qté</th>
            <th class="text-right" style="width:120px;">Prix Unitaire</th>
            <th class="text-right" style="width:120px;">Prix Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.articles
            .map(
              (a) => `
            <tr>
              <td>${a.designation}</td>
              <td class="text-right">${a.quantite}</td>
              <td class="text-right">${formatCurrency(a.prix_unitaire)}</td>
              <td class="text-right">${formatCurrency(a.total)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
        <tfoot>
          ${tfootRows}
        </tfoot>
      </table>

      ${amountWordsSection}
      ${deliverySection}
      ${notesSection}
      ${signatureSection}

      ${qrCodeUrl ? `<div class="qr-section"><img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour vérifier</p></div>` : ""}

      <div class="footer">
        ${footerContent}
      </div>
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
      };
    </script>
  </body>
</html>`;
}

// ─── 80mm ─────────────────────────────────────────────────────────────────────

export function generate80mmHTML(
  data: PrintData,
  config: Configuration | null,
  logoBase64: string | null,
  qrCodeUrl: string | null,
): string {
  const isProforma = data.document_type === "PROFORMA";
  const ticketTitle = isProforma
    ? `PROFORMA N° ${data.numero}`
    : `${data.document_type} N° ${data.numero}`;

  const articlesHTML = data.articles
    .map(
      (a) => `
      <div style="margin: 2mm 0;">
        <div style="font-size: 11px; font-weight: bold;">${a.designation}</div>
        <div style="display: flex; justify-content: space-between; padding-left: 2mm; font-size: 10px;">
          <span>${a.quantite} x ${formatCurrency(a.prix_unitaire)}</span>
          <span style="font-weight: bold;">${formatCurrency(a.total)}</span>
        </div>
      </div>
    `,
    )
    .join("");

  let totalsHTML = "";
  if (data.total_avant_remise) {
    totalsHTML += `
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0; border-top: 1px dashed #000; padding-top: 2mm;">
        <span>Sous-total:</span><span>${formatCurrency(data.total_avant_remise)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;">
        <span>Remise (${data.remise_type === "pourcentage" ? data.remise_valeur + "%" : "fixe"}):</span>
        <span>-${formatCurrency(data.total_avant_remise - data.total_ttc)}</span>
      </div>
    `;
  }
  totalsHTML += `
    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000;">
      <span>TOTAL:</span><span>${formatCurrency(data.total_ttc)}</span>
    </div>
  `;

  let paymentHTML = "";
  if (!isProforma) {
    if ((data.montant_paye ?? 0) > 0) {
      paymentHTML += `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;">
          <span>Recu:</span><span>${formatCurrency(data.montant_paye!)}</span>
        </div>
      `;
    }
    if ((data.monnaie_rendue ?? 0) > 0) {
      paymentHTML += `
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 1mm 0;">
          <span>Monnaie:</span><span>${formatCurrency(data.monnaie_rendue!)}</span>
        </div>
      `;
    }
    if ((data.montant_restant ?? 0) > 0) {
      paymentHTML += `
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 1mm 0; color: red;">
          <span>Reste à payer:</span><span>${formatCurrency(data.montant_restant!)}</span>
        </div>
      `;
    }
  }

  const notesHTML =
    isProforma && data.notes
      ? `<div style="font-size: 10px; margin: 2mm 0; padding: 2mm 0; border-bottom: 1px dashed #000;"><strong>Notes:</strong> ${data.notes}</div>`
      : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${data.document_type} - ${data.numero}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: 80mm auto; margin: 2mm; }
      body { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 12px; line-height: 1.4; color: #000; background: white; width: 76mm; margin: 0 auto; }
      .ticket { width: 76mm; padding: 2mm; background: white; }
      @media print { body { width: 76mm; } .ticket { width: 76mm; } }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div style="text-align: center; padding-bottom: 3mm; border-bottom: 1px dashed #000; margin-bottom: 3mm;">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 40px; max-width: 60mm; margin-bottom: 2mm; object-fit: contain;" />` : ""}
        <h1 style="font-size: 14px; font-weight: bold; margin-bottom: 2mm; text-transform: uppercase;">${config?.nom_entreprise || "Mon Entreprise"}</h1>
        ${config?.telephone ? `<p style="font-size: 10px; margin: 1mm 0;">Tel: ${config.telephone}</p>` : ""}
        ${config?.telephone2 ? `<p style="font-size: 10px; margin: 1mm 0;">${config.telephone2}</p>` : ""}
        ${config?.adresse ? `<p style="font-size: 10px; margin: 1mm 0;">${config.adresse}</p>` : ""}
        ${config?.email ? `<p style="font-size: 10px; margin: 1mm 0;">${config.email}</p>` : ""}
        ${config?.nif ? `<p style="font-size: 10px; margin: 1mm 0;">NIF: ${config.nif}</p>` : ""}
      </div>

      <div style="text-align: center; font-size: 14px; font-weight: bold; margin: 3mm 0; padding: 2mm 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
        ${ticketTitle}
      </div>

      <div style="margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Date:</span><span>${data.date}</span></div>
        ${data.heure ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Heure:</span><span>${data.heure}</span></div>` : ""}
        ${isProforma && data.date_validite ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Valide:</span><span>${data.date_validite}</span></div>` : ""}
        ${data.vendeur ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Caissier:</span><span>${data.vendeur}</span></div>` : ""}
        ${data.serveur_nom ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Serveur:</span><span>${data.serveur_nom}</span></div>` : ""}
        ${data.client_nom && data.client_nom !== "Client comptoir" ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Client:</span><span>${data.client_nom}</span></div>` : ""}
        ${data.client_telephone ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Tel:</span><span>${data.client_telephone}</span></div>` : ""}
      </div>

      <div style="margin-bottom: 3mm; padding-bottom: 3mm;">
        ${articlesHTML}
      </div>

      <div style="margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000;">
        ${totalsHTML}
      </div>

      ${paymentHTML ? `<div style="margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000;">${paymentHTML}</div>` : ""}
      ${notesHTML}

      ${qrCodeUrl ? `<div style="text-align: center; padding-top: 3mm;"><img src="${qrCodeUrl}" alt="QR Code" style="width: 25mm; height: 25mm;" /></div>` : ""}

      <div style="text-align: center; padding-top: 3mm;">
        <p style="font-size: 12px; font-weight: bold; margin-bottom: 2mm;">${config?.message_pied || "Merci de votre confiance !"}</p>
        ${config?.support_text ? `<p style="font-size: 9px; margin: 1mm 0;">--------------------------------</p><p style="font-size: 9px; margin: 1mm 0;">${config.support_text}</p>` : ""}
        <p style="font-size: 9px; margin: 1mm 0;">--------------------------------</p>
      </div>
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
      };
    </script>
  </body>
</html>`;
}

export function openPrintWindow(html: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}
