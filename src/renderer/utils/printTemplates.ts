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

export function generateA4HTML(
  data: PrintData,
  config: Configuration | null,
  logoBase64: string | null,
  qrCodeUrl: string | null,
): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";

  const primaryColor = isProforma || isRecu ? "#1e3a8a" : "#1e40af";
  const headerBorderColor = isProforma || isRecu ? "#1e3a8a" : "#2563eb";
  const infoBoxBg = isProforma ? "#eff6ff" : "#f8fafc";
  const infoBoxBorder = isProforma ? "#bfdbfe" : "#e2e8f0";
  const tableHeaderCSS = isProforma
    ? `background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; font-size: 18px; text-transform: uppercase; letter-spacing: 0.2px;`
    : `background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 18px; text-transform: uppercase; letter-spacing: 0.2px;`;
  const tableEvenBg = isProforma ? "#eff6ff" : "#eef2ff";

  const remiseAmount = (data.total_avant_remise ?? 0) - data.total_ttc;

  // Badge
  const badgeStyle = isRecu
    ? `background: #22c55e; color: white; padding: 7px 16px; border-radius: 4px; font-size: 20px; font-weight: bold; text-align: center; min-width: 75px;`
    : `color: black; padding: 7px 16px; border-radius: 4px; font-size: 20px; font-weight: bold; text-align: center; min-width: 75px;`;
  const badgeLabel = isRecu ? "RECU" : data.document_type;
  const badgeSubLabel = isRecu ? "Paiement Dette" : `N° ${data.numero}`;

  // Info box 2
  const infoBox2Title = isProforma ? "Document" : "Facture";
  let infoBox2Content = "";
  if (isRecu) {
    infoBox2Content = `
      <p><strong>N°:</strong> ${data.numero}</p>
      <p><strong>Date:</strong> ${data.date}</p>
      ${data.vendeur ? `<p><strong>Caissier:</strong> ${data.vendeur}</p>` : ""}
    `;
  } else if (isProforma) {
    infoBox2Content = `
      <p><strong>N°:</strong> ${data.numero} | <strong>Date:</strong> ${data.date}</p>
      ${data.date_validite ? `<p><strong>Valide jusqu'au:</strong> ${data.date_validite}</p>` : ""}
    `;
  } else {
    infoBox2Content = `
      <p><strong>Date:</strong> ${data.date}${data.heure ? ` | <strong>Heure:</strong> ${data.heure}` : ""}</p>
      ${data.vendeur ? `<p><strong>Caissier:</strong> ${data.vendeur}${data.serveur_nom ? ` | <strong>Serveur:</strong> ${data.serveur_nom}` : ""}</p>` : ""}
    `;
  }

  // Totals
  let totalsHTML = "";
  if (data.total_avant_remise) {
    totalsHTML += `
      <div class="totals-row subtotal">
        <span>Sous-total:</span>
        <span>${formatCurrency(data.total_avant_remise)}</span>
      </div>
      <div class="totals-row discount">
        <span>Remise (${data.remise_type === "pourcentage" ? data.remise_valeur + "%" : formatCurrency(data.remise_valeur || 0)}):</span>
        <span>-${formatCurrency(remiseAmount)}</span>
      </div>
    `;
  }
  totalsHTML += `
    <div class="totals-row grand-total">
      <span>Total TTC:</span>
      <span>${formatCurrency(data.total_ttc)}</span>
    </div>
  `;
  if (isRecu) {
    if ((data.montant_paye ?? 0) > 0) {
      totalsHTML += `<div class="totals-row payed"><span>Montant payé:</span><span>${formatCurrency(data.montant_paye!)}</span></div>`;
    }
    if ((data.montant_restant ?? 0) <= 0) {
      totalsHTML += `<div style="margin-top:8px;"><span class="solde-badge">✓ SOLDÉ</span></div>`;
    } else {
      totalsHTML += `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(data.montant_restant!)}</span></div>`;
    }
  } else if (!isProforma) {
    if (data.methode_paiement) {
      totalsHTML += `<div class="totals-row payment-info"><span>Reglement: ${data.methode_paiement} | Recu: ${formatCurrency(data.montant_paye || 0)}</span></div>`;
    }
    if ((data.monnaie_rendue ?? 0) > 0) {
      totalsHTML += `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(data.monnaie_rendue!)}</span></div>`;
    }
    if ((data.montant_restant ?? 0) > 0) {
      totalsHTML += `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(data.montant_restant!)}</span></div>`;
    }
    totalsHTML += `
      <div style="margin-top: 6px;">
        <span class="delivery-status ${data.livraison_differee ? "deferred" : "delivered"}">
          ${data.livraison_differee ? "NON LIVRÉ" : "✓ LIVRÉ"}
        </span>
      </div>
    `;
  }

  // Amount words
  let amountWordsSection = "";
  if (!isRecu) {
    const label = isProforma ? "facture proforma" : "facture";
    amountWordsSection = `
      <div class="amount-words">
        Arrete la presente ${label} a la somme de : <strong>${montantEnLettres(data.total_ttc, "francs CFA")}</strong>
      </div>
    `;
  }

  // Extra sections for PROFORMA
  let extraSections = "";
  if (isProforma) {
    if (data.notes) {
      extraSections += `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>`;
    }
    if (data.date_validite) {
      extraSections += `<div class="validity-notice"><strong>Important:</strong> Offre valable jusqu'au ${data.date_validite}</div>`;
    }
  }

  // Footer
  let footerContent = "";
  let footerCSS = "";
  if (data.show_fiscal_footer) {
    footerContent = buildFiscalFooterContent(config);
    footerCSS = `.footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid ${primaryColor}; text-align: center; font-size: 10px; color: ${primaryColor}; line-height: 1.6; } .footer p { margin: 2px 0; }`;
  } else {
    footerContent = `
      <p class="message">${config?.message_pied || "Merci de votre confiance !"}</p>
      ${config?.support_text ? `<p class="sub">${config.support_text}</p>` : ""}
    `;
    footerCSS = `.footer { margin-top: 15px; text-align: center; padding-top: 10px; border-top: 1px solid #e2e8f0; } .footer .message { font-size: 18px; font-weight: bold; color: ${primaryColor}; margin-bottom: 3px; } .footer .sub { font-size: 15px; color: #111; }`;
  }

  const soldeBadgeCSS = isRecu
    ? `.totals-row.payed { color: #166534; font-weight: bold; } .solde-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; padding: 4px 14px; border-radius: 6px; margin-top: 8px; font-size: 17px; }`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${data.document_type} - ${data.numero}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4; margin: 8mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 1.4; color: #000; }
      .invoice { max-width: 194mm; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 2px solid ${headerBorderColor}; margin-bottom: 12px; }
      .company-logo { width: 150px; display: flex; align-items: center; }
      .company-logo img { max-height: 110px; max-width: 150px; object-fit: contain; }
      .company-info { flex: 1; text-align: center; padding: 0 15px; }
      .company-info h1 { font-size: 15px; color: ${primaryColor}; margin-bottom: 3px; }
      .company-info p { font-size: 14px; color: #000; margin: 2px 0; }
      .invoice-badge { ${badgeStyle} }
      .invoice-badge .numero { font-size: 16px; font-weight: bold; margin-top: 2px; }
      .info-grid { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
      .info-box { width: 48%; background: ${infoBoxBg}; padding: 10px 12px; border-radius: 4px; border: 1px solid ${infoBoxBorder}; }
      .info-box h3 { font-size: 16px; text-transform: uppercase; color: #111; letter-spacing: 0.3px; margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px solid ${infoBoxBorder}; }
      .info-box p { margin: 3px 0; font-size: 18px; }
      .info-box strong { color: #000; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      thead th { ${tableHeaderCSS} }
      thead th:first-child { border-radius: 4px 0 0 0; }
      thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
      thead th.text-right { text-align: right; }
      tbody td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 19px; color: #000; }
      tbody tr:nth-child(even) { background: ${tableEvenBg}; }
      tbody td.text-right { text-align: right; }
      .totals-section { display: flex; justify-content: flex-end; margin-top: 10px; }
      .totals-box { width: 325px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd; padding: 10px 12px; }
      .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 18px; }
      .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
      .totals-row.discount { color: #dc2626; }
      .totals-row.grand-total { font-size: 21px; font-weight: bold; color: ${primaryColor}; border-top: 2px solid ${primaryColor}; padding-top: 6px; margin-top: 5px; }
      .totals-row.payment-info { border-top: 1px dashed #bae6fd; padding-top: 5px; margin-top: 5px; font-size: 17px; }
      .totals-row.remaining { color: #dc2626; font-weight: bold; }
      .delivery-status { font-weight: bold; padding: 3px 8px; border-radius: 3px; display: inline-block; margin-top: 6px; font-size: 17px; }
      .delivered { background: #dcfce7; color: #166534; }
      .deferred { background: #fef3c7; color: #92400e; }
      .amount-words { margin-top: 10px; padding: 6px 10px; background: #fefce8; border: 1px solid #fde68a; border-radius: 4px; font-style: italic; font-size: 19px; color: #78350f; }
      .notes { margin-top: 8px; padding: 6px 10px; background: #f9f9f9; border-radius: 4px; font-size: 16px; color: #000; }
      .validity-notice { background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 10px; margin-top: 8px; border-radius: 4px; font-size: 16px; color: #000; }
      .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px; padding-top: 10px; }
      .qr-code { text-align: center; }
      .qr-code img { width: 80px; height: 80px; }
      .qr-code p { font-size: 15px; color: #111; margin-top: 3px; }
      ${soldeBadgeCSS}
      ${footerCSS}
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
          ${config?.description_entreprise ? `<p style="font-size: 11px; color: #333; font-style: italic; white-space: nowrap;">${config.description_entreprise}</p>` : ""}
          ${!isProforma && config?.adresse ? `<p>${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
          ${!isProforma && config?.telephone ? `<p>Tel: ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}${config?.nif ? " | NIF: " + config.nif : ""}</p>` : ""}
          ${!isProforma && config?.email && !config?.telephone ? `<p>${config.email}</p>` : ""}
        </div>
        <div class="invoice-badge">
          ${badgeLabel}
          <div class="numero">${badgeSubLabel}</div>
        </div>
        
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Client</h3>
          <p><strong>${data.client_nom || "Client comptoir"}</strong></p>
          ${data.client_telephone ? `<p>Tel: ${data.client_telephone}</p>` : ""}
          ${data.client_email ? `<p>${data.client_email}</p>` : ""}
        </div>
        <div class="info-box">
          <h3>${infoBox2Title}</h3>
          ${infoBox2Content}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Designation</th>
            <th class="text-right" style="width: 40px;">Qte</th>
            <th class="text-right" style="width: 180px;">P.U.</th>
            <th class="text-right" style="width: 180px;">Total</th>
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
      </table>

      <div class="totals-section">
        <div class="totals-box">
          ${totalsHTML}
        </div>
      </div>

      ${amountWordsSection}
      ${extraSections}

      <div class="qr-stamp-section">
        <div class="qr-code">
          ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
        </div>
      </div>

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

export function generateA5HTML(
  data: PrintData,
  config: Configuration | null,
  logoBase64: string | null,
  qrCodeUrl: string | null,
): string {
  const isProforma = data.document_type === "PROFORMA";
  const isRecu = data.document_type === "RECU";

  const primaryColor = isProforma || isRecu ? "#1e3a8a" : "#1e40af";
  const infoBoxBg = isProforma ? "#eff6ff" : "#f8fafc";
  const infoBoxBorder = isProforma ? "#bfdbfe" : "#e2e8f0";

  const tableEvenBg = isProforma ? "#eff6ff" : "#eef2ff";

  const tableHeaderCSS = isProforma
    ? `background: #1e3a8a; color: white; padding: 5px 6px; text-align: left; font-size: 15px; text-transform: uppercase; letter-spacing: 0.2px;`
    : `background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 15px; text-transform: uppercase; letter-spacing: 0.2px;`;

  const remiseAmount = (data.total_avant_remise ?? 0) - data.total_ttc;

  // Badge
  const badgeStyle = isRecu
    ? `color: black; padding: 5px 10px; border-radius: 4px; font-size: 19px; font-weight: bold; text-align: center; white-space: nowrap;`
    : `color: black; padding: 8px 10px; border-radius: 6px; font-size: 14px; font-weight: bold; text-align: center; white-space: nowrap;`;
  const badgeLabel = isRecu ? "RECU" : data.document_type;
  const badgeSubLabel = isRecu ? "Paiement Dette" : `N° ${data.numero}`;

  // Info box 2
  const infoBox2Title = isProforma ? "Document" : "Facture";
  let infoBox2Content = "";
  if (isRecu) {
    infoBox2Content = `
      <p><strong>N°:</strong> ${data.numero}</p>
      <p><strong>Date:</strong> ${data.date}</p>
    `;
  } else if (isProforma) {
    infoBox2Content = `
      <p><strong>N°:</strong> ${data.numero} | <strong>Date:</strong> ${data.date}</p>
      ${data.date_validite ? `<p><strong>Valide jusqu'au:</strong> ${data.date_validite}</p>` : ""}
    `;
  } else {
    infoBox2Content = `
      <p><strong>Date:</strong> ${data.date}${data.heure ? ` | <strong>Heure:</strong> ${data.heure}` : ""}</p>
      ${data.vendeur ? `<p><strong>Caissier:</strong> ${data.vendeur}${data.serveur_nom ? ` | <strong>Serveur:</strong> ${data.serveur_nom}` : ""}</p>` : ""}
    `;
  }

  // Totals
  let totalsHTML = "";
  if (data.total_avant_remise) {
    totalsHTML += `
      <div class="totals-row subtotal">
        <span>Sous-total:</span>
        <span>${formatCurrency(data.total_avant_remise)}</span>
      </div>
      <div class="totals-row discount">
        <span>Remise (${data.remise_type === "pourcentage" ? data.remise_valeur + "%" : formatCurrency(data.remise_valeur || 0)}):</span>
        <span>-${formatCurrency(remiseAmount)}</span>
      </div>
    `;
  }
  totalsHTML += `
    <div class="totals-row grand-total">
      <span>Total TTC:</span>
      <span>${formatCurrency(data.total_ttc)}</span>
    </div>
  `;
  if (isRecu) {
    if ((data.montant_paye ?? 0) > 0) {
      totalsHTML += `<div class="totals-row payed"><span>Montant payé:</span><span>${formatCurrency(data.montant_paye!)}</span></div>`;
    }
    if ((data.montant_restant ?? 0) <= 0) {
      totalsHTML += `<div style="margin-top:6px;"><span class="solde-badge">✓ SOLDÉ</span></div>`;
    } else {
      totalsHTML += `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(data.montant_restant!)}</span></div>`;
    }
  } else if (!isProforma) {
    if (data.methode_paiement) {
      totalsHTML += `<div class="totals-row payment-info"><span>Reglement: ${data.methode_paiement} | Recu: ${formatCurrency(data.montant_paye || 0)}</span></div>`;
    }
    if ((data.monnaie_rendue ?? 0) > 0) {
      totalsHTML += `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(data.monnaie_rendue!)}</span></div>`;
    }
    if ((data.montant_restant ?? 0) > 0) {
      totalsHTML += `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(data.montant_restant!)}</span></div>`;
    }
    totalsHTML += `
      <div style="margin-top: 4px;">
        <span class="delivery-status ${data.livraison_differee ? "deferred" : "delivered"}">
          ${data.livraison_differee ? "NON LIVRÉ" : "✓ LIVRÉ"}
        </span>
      </div>
    `;
  }

  // Amount words
  let amountWordsSection = "";
  if (!isRecu) {
    amountWordsSection = `
      <div style="margin-top: 3mm">
        Arrêté à : <strong>${montantEnLettres(data.total_ttc, "francs CFA")}</strong>
      </div>
    `;
  }

  // Extra sections for PROFORMA
  let extraSections = "";
  if (isProforma) {
    if (data.notes) {
      extraSections += `<div class="notes"><strong>Notes:</strong> ${data.notes}</div>`;
    }
    if (data.date_validite) {
      extraSections += `<div class="validity-notice"><strong>Important:</strong> Offre valable jusqu'au ${data.date_validite}</div>`;
    }
  }

  // Footer
  let footerContent = "";
  if (data.show_fiscal_footer) {
    footerContent = buildFiscalFooterContent(config);
  } else {
    footerContent = `
      <p>${config?.message_pied || "Merci de votre confiance !"}</p>
      ${config?.support_text ? `<p>${config.support_text}</p>` : ""}
    `;
  }

  const soldeBadgeCSS = isRecu
    ? `.totals-row.payed { color: #166534; font-weight: bold; } .solde-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; padding: 3px 10px; border-radius: 4px; margin-top: 6px; font-size: 18px; }`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${data.document_type} - ${data.numero}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A5; margin: 6mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: bold; line-height: 1.3; color: #000; }
      .invoice { max-width: 136mm; margin: 0 auto; }
      .header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; margin-bottom: 10px; }
      .company-logo { display: flex; align-items: center; }
      .company-logo img { max-height: 70px; max-width: 60px; object-fit: contain; }
      .company-info { flex: 1; min-width: 0; padding: 0 10px; text-align: center; overflow: hidden; }
      .company-info h1 { font-size: 15px; font-weight: bold; color: ${primaryColor}; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .company-info .slogan { font-size: 10px; color: ${primaryColor}; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .company-info .header-detail { font-size: 10px; color: #000; margin: 1px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .invoice-badge { ${badgeStyle} flex-shrink: 0; }
      .invoice-badge .numero { font-size: 11px; font-weight: bold; margin-top: 3px; white-space: nowrap; }
      .info-grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
      .info-box { width: 48%; background: ${infoBoxBg}; padding: 8px 10px; border-radius: 4px; border: 1px solid ${infoBoxBorder}; }
      .info-box h3 { font-size: 12px; text-transform: uppercase; color: ${isProforma ? primaryColor : "#111"}; letter-spacing: 0.3px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid ${infoBoxBorder}; }
      .info-box p { margin: 2px 0; font-size: 14px; }
      .info-box strong { color: #000; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      thead th { ${tableHeaderCSS} }
      thead th:first-child { border-radius: 4px 0 0 0; }
      thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
      thead th.text-right { text-align: right; }
      tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 15px; color: #000; }
      tbody tr:nth-child(even) { background: ${tableEvenBg}; }
      tbody td.text-right { text-align: right; }
      .totals-section { display: flex; justify-content: flex-end; margin-top: 8px; }
      .totals-box { width: 300px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd; padding: 8px 10px; }
      .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
      .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
      .totals-row.discount { color: #dc2626; }
      .totals-row.grand-total { font-size: 17px; font-weight: bold; color: ${primaryColor}; border-top: 2px solid ${primaryColor}; padding-top: 5px; margin-top: 4px; }
      .totals-row.payment-info { border-top: 1px dashed #bae6fd; padding-top: 5px; margin-top: 4px; font-size: 13px; }
      .totals-row.remaining { color: #dc2626; font-weight: bold; }
      .delivery-status { font-weight: bold; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 5px; font-size: 13px; }
      .delivered { background: #dcfce7; color: #166534; }
      .deferred { background: #fef3c7; color: #92400e; }
      .notes { margin-top: 6px; padding: 4px 8px; background: #f9f9f9; border-radius: 4px; font-size: 17px; color: #000; }
      .validity-notice { background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 8px; margin-top: 6px; border-radius: 4px; font-size: 17px; color: #000; }
      .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding-top: 8px; }
      .qr-code { text-align: center; }
      .qr-code img { width: 60px; height: 60px; }
      .qr-code p { font-size: 11px; color: #111; margin-top: 2px; }
      .footer { margin-top: 10px; border-top: 1px solid ${primaryColor}; padding-top: 4px; text-align: center; font-size: 9px; color: ${primaryColor}; line-height: 1.5; }
      .footer p { margin: 1px 0; }
      .footer strong { font-weight: 700; }
      ${soldeBadgeCSS}
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
          ${!isProforma && config?.adresse ? `<p class="header-detail">${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
          ${!isProforma && config?.telephone ? `<p class="header-detail">Tel: ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}${config?.nif ? " | NIF: " + config.nif : ""}</p>` : ""}
          ${!isProforma && config?.email && !config?.telephone ? `<p class="header-detail">${config.email}</p>` : ""}
        </div>
        <div class="invoice-badge">
          ${badgeLabel}
          <div class="numero">${badgeSubLabel}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Client</h3>
          <p><strong>${data.client_nom || "Client comptoir"}</strong></p>
          ${data.client_telephone ? `<p>Tel: ${data.client_telephone}</p>` : ""}
          ${data.client_email ? `<p>${data.client_email}</p>` : ""}
        </div>
        <div class="info-box">
          <h3>${infoBox2Title}</h3>
          ${infoBox2Content}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Designation</th>
            <th class="text-right" style="width: 35px;">Qte</th>
            <th class="text-right" style="width: 140px;">P.U.</th>
            <th class="text-right" style="width: 140px;">Total</th>
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
      </table>

      <div class="totals-section">
        <div class="totals-box">
          ${totalsHTML}
        </div>
      </div>

      ${amountWordsSection}
      ${extraSections}

      <div class="qr-stamp-section">
        <div class="qr-code">
          ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
        </div>
      </div>

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

  // Articles section
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

  // Totals section
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

  // Payment section (non-proforma)
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

  // Notes (proforma)
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
