import React, { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Eye,
  FileText,
  Printer,
} from "lucide-react";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import { montantEnLettres } from "../utils/numberToWords";

interface Livraison {
  id: number;
  vente_id: number;
  client_id?: number;
  client_nom?: string;
  client_nom_full?: string;
  adresse_livraison?: string;
  date_prevue?: string;
  date_livraison?: string;
  statut: "en_attente" | "en_cours" | "livree" | "annulee";
  notes?: string;
  livreur?: string;
  vente_total?: number;
  created_at?: string;
}

const Livraisons: React.FC = () => {
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLivraison, setSelectedLivraison] = useState<Livraison | null>(
    null,
  );
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [config, setConfig] = useState<any | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [ventes, setVentes] = useState<any[]>([]);
  const [venteSearch, setVenteSearch] = useState("");
  const [formData, setFormData] = useState({
    vente_id: "",
    adresse_livraison: "",
    date_prevue: "",
    livreur: "",
    notes: "",
  });

  const loadLivraisons = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getLivraisons(
        currentPage,
        itemsPerPage,
        statutFilter || undefined,
      );
      setLivraisons(result.data);
      setTotalItems(result.total);
    } catch (error) {
      showErrorToast("Erreur lors du chargement des livraisons");
    } finally {
      setLoading(false);
    }
  };

  const loadVentes = async () => {
    try {
      const result = await window.electronAPI.getSales();
      setVentes(result);
    } catch (error) {
      console.error("Erreur chargement ventes:", error);
    }
  };

  const filteredVentes = ventes.filter((v) => {
    if (!venteSearch) return true;
    const search = venteSearch.toLowerCase();
    return (
      String(v.id).includes(search) ||
      (v.client_nom && v.client_nom.toLowerCase().includes(search))
    );
  });

  useEffect(() => {
    loadLivraisons();
  }, [currentPage, itemsPerPage, statutFilter]);

  useEffect(() => {
    window.electronAPI.getConfiguration().then((data: any) => {
      setConfig(data);
    }).catch(() => {});
    window.electronAPI.getCompanyLogo().then((logo: any) => {
      setLogoBase64(logo);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      loadVentes();
    }
  }, [showCreateModal]);

  const handleCreate = async () => {
    if (!formData.vente_id) {
      showErrorToast("Veuillez sélectionner une vente");
      return;
    }

    try {
      const vente = ventes.find((v) => v.id === parseInt(formData.vente_id));
      await window.electronAPI.createLivraison({
        vente_id: parseInt(formData.vente_id),
        client_id: vente?.client_id,
        client_nom: vente?.client_nom,
        adresse_livraison: formData.adresse_livraison,
        date_prevue: formData.date_prevue || null,
        livreur: formData.livreur,
        notes: formData.notes,
      });
      showSuccessToast("Livraison créée avec succès");
      setShowCreateModal(false);
      setVenteSearch("");
      setFormData({
        vente_id: "",
        adresse_livraison: "",
        date_prevue: "",
        livreur: "",
        notes: "",
      });
      loadLivraisons();
    } catch (error) {
      showErrorToast("Erreur lors de la création de la livraison");
    }
  };

  const handleUpdateStatut = async (id: number, statut: string) => {
    try {
      const livraison = livraisons.find((l) => l.id === id);
      await window.electronAPI.updateLivraison(id, {
        ...livraison,
        statut,
      });
      showSuccessToast("Statut mis à jour");
      loadLivraisons();
    } catch (error) {
      showErrorToast("Erreur lors de la mise à jour");
    }
  };

  const handleViewInvoice = async (venteId: number) => {
    setLoadingInvoice(true);
    setShowInvoiceModal(true);
    try {
      const inv = await window.electronAPI.getInvoiceByVenteId(venteId);
      setInvoiceData(inv || null);
    } catch (error) {
      showErrorToast("Erreur lors du chargement de la facture");
      setShowInvoiceModal(false);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!invoiceData) return;
    const inv = invoiceData;
    const articles: any[] = Array.isArray(inv.articles) ? inv.articles : [];
    const format = config?.format_facture || "80mm";
    const isA4 = format === "A4";
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (isA4) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${inv.numero}</title>
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
              .totals-row.remaining { color: #dc2626; font-weight: bold; }
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
                  ${config?.description_entreprise ? `<p style="font-size:11px;color:#666;font-style:italic">${config.description_entreprise}</p>` : ""}
                  ${config?.adresse ? `<p>${config.adresse}${config?.ville ? ", " + config.ville : ""}</p>` : ""}
                  ${config?.telephone ? `<p>Tel: ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}${config?.nif ? " | NIF: " + config.nif : ""}</p>` : ""}
                </div>
                <div class="invoice-badge">
                  FACTURE
                  <div class="numero">N° ${inv.numero}</div>
                </div>
              </div>
              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${inv.client_nom || "Client comptoir"}</strong></p>
                  ${inv.client_telephone ? `<p>Tel: ${inv.client_telephone}</p>` : ""}
                  ${inv.client_email ? `<p>${inv.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Facture</h3>
                  <p><strong>Date:</strong> ${inv.date_facture} | <strong>Heure:</strong> ${inv.heure_facture}</p>
                  <p><strong>Caissier:</strong> ${inv.vendeur}${inv.serveur_nom ? " | <strong>Serveur:</strong> " + inv.serveur_nom : ""}</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th class="text-right" style="width:40px">Qte</th>
                    <th class="text-right" style="width:80px">P.U.</th>
                    <th class="text-right" style="width:80px">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${articles.map((a: any) => `
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
                  ${inv.total_avant_remise ? `
                    <div class="totals-row subtotal"><span>Sous-total:</span><span>${formatCurrency(inv.total_avant_remise)}</span></div>
                    <div class="totals-row discount"><span>Remise (${inv.remise_type === "pourcentage" ? inv.remise_valeur + "%" : formatCurrency(inv.remise_valeur || 0)}):</span><span>-${formatCurrency(inv.total_avant_remise - inv.total_ttc)}</span></div>
                  ` : ""}
                  <div class="totals-row grand-total"><span>Total TTC:</span><span>${formatCurrency(inv.total_ttc)}</span></div>
                  ${inv.monnaie_rendue > 0 ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(inv.monnaie_rendue)}</span></div>` : ""}
                  ${(inv.montant_restant ?? 0) > 0 ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(inv.montant_restant)}</span></div>` : ""}
                </div>
              </div>
              <div style="margin-top:8px;font-size:10px">
                Arrêté à : <strong>${montantEnLettres(inv.total_ttc, "francs CFA")}</strong>
              </div>
              <div class="footer">
                <p class="message">${config?.message_pied || "Merci de votre confiance !"}</p>
                ${config?.support_text ? `<p class="sub">${config.support_text}</p>` : ""}
              </div>
            </div>
            <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},100);},500);};</script>
          </body>
        </html>
      `);
    } else if (format === "A5") {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Facture - ${inv.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A5; margin: 6mm 6mm 25mm 6mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #333; }
              .invoice { max-width: 136mm; margin: 0 auto; }
              .header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a; margin-bottom: 8px; }
              .company-logo img { max-height: 70px; max-width: 90px; object-fit: contain; }
              .company-info { flex: 1; padding: 0 12px; text-align: center; }
              .company-info h1 { font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 3px; }
              .invoice-badge { background: #1e3a8a; color: white; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-align: center; min-width: 65px; }
              .invoice-badge .numero { font-size: 8px; font-weight: normal; margin-top: 1px; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
              .info-box { width: 48%; background: #f8fafc; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
              .info-box h3 { font-size: 8px; text-transform: uppercase; color: #64748b; margin-bottom: 3px; padding-bottom: 2px; border-bottom: 1px solid #e2e8f0; }
              .info-box p { margin: 1px 0; font-size: 9px; }
              table { width: 100%; border-collapse: collapse; margin: 6px 0; }
              thead th { background: #1e40af; color: white; padding: 5px 6px; text-align: left; font-size: 8px; text-transform: uppercase; }
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
              .totals-row.remaining { color: #dc2626; font-weight: bold; }
              .footer { position: fixed; bottom: 6mm; left: 6mm; right: 6mm; border-top: 1px solid #2563eb; padding-top: 4px; text-align: center; font-size: 7.5px; color: #1e40af; }
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
                  ${config?.description_entreprise ? `<p>${config.description_entreprise}</p>` : ""}
                </div>
                <div class="invoice-badge">
                  FACTURE
                  <div class="numero">N° ${inv.numero}</div>
                </div>
              </div>
              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${inv.client_nom || "Client comptoir"}</strong></p>
                  ${inv.client_telephone ? `<p>Tel: ${inv.client_telephone}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Facture</h3>
                  <p><strong>Date:</strong> ${inv.date_facture} | <strong>Heure:</strong> ${inv.heure_facture}</p>
                  <p><strong>Caissier:</strong> ${inv.vendeur}</p>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th class="text-right" style="width:35px">Qte</th>
                    <th class="text-right" style="width:70px">P.U.</th>
                    <th class="text-right" style="width:70px">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${articles.map((a: any) => `
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
                  ${inv.total_avant_remise ? `
                    <div class="totals-row subtotal"><span>Sous-total:</span><span>${formatCurrency(inv.total_avant_remise)}</span></div>
                    <div class="totals-row discount"><span>Remise (${inv.remise_type === "pourcentage" ? inv.remise_valeur + "%" : formatCurrency(inv.remise_valeur || 0)}):</span><span>-${formatCurrency(inv.total_avant_remise - inv.total_ttc)}</span></div>
                  ` : ""}
                  <div class="totals-row grand-total"><span>Total TTC:</span><span>${formatCurrency(inv.total_ttc)}</span></div>
                  ${inv.monnaie_rendue > 0 ? `<div class="totals-row"><span>Monnaie:</span><span>${formatCurrency(inv.monnaie_rendue)}</span></div>` : ""}
                  ${(inv.montant_restant ?? 0) > 0 ? `<div class="totals-row remaining"><span>Reste:</span><span>${formatCurrency(inv.montant_restant)}</span></div>` : ""}
                </div>
              </div>
              <div style="margin-top:6px;font-size:9px">
                Arrêté à : <strong>${montantEnLettres(inv.total_ttc, "francs CFA")}</strong>
              </div>
              <div class="footer">
                <p>${config?.message_pied || "Merci de votre confiance !"}</p>
                ${config?.support_text ? `<p>${config.support_text}</p>` : ""}
              </div>
            </div>
            <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},100);},500);};</script>
          </body>
        </html>
      `);
    } else {
      // Format ticket 80mm
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket - ${inv.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: 80mm auto; margin: 2mm; }
              body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #000; width: 76mm; margin: 0 auto; }
              .ticket { width: 76mm; padding: 2mm; }
              .ticket-header { text-align: center; padding-bottom: 3mm; border-bottom: 1px dashed #000; margin-bottom: 3mm; }
              .ticket-header h1 { font-size: 14px; font-weight: bold; margin-bottom: 2mm; text-transform: uppercase; }
              .ticket-header p { font-size: 10px; margin: 1mm 0; }
              .ticket-title { text-align: center; font-size: 16px; font-weight: bold; margin: 3mm 0; padding: 2mm 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
              .ticket-info { margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
              .ticket-info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0; }
              .ticket-articles { margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
              .ticket-article { margin: 2mm 0; font-size: 11px; }
              .ticket-article-name { font-weight: bold; }
              .ticket-article-details { display: flex; justify-content: space-between; padding-left: 2mm; font-size: 10px; }
              .ticket-totals { margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
              .ticket-total-row { display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0; }
              .ticket-total-row.grand-total { font-size: 14px; font-weight: bold; margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000; }
              .ticket-payment { margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
              .ticket-payment-row { display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0; }
              .ticket-footer { text-align: center; padding-top: 3mm; }
              .ticket-footer p { font-size: 10px; margin: 1mm 0; }
              .ticket-footer .thank-you { font-size: 12px; font-weight: bold; margin-bottom: 2mm; }
              @media print { body { width: 76mm; } }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="ticket-header">
                <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                ${config?.telephone ? `<p>Tel: ${config.telephone}</p>` : ""}
                ${config?.telephone2 ? `<p>${config.telephone2}</p>` : ""}
                ${config?.adresse ? `<p>${config.adresse}</p>` : ""}
                ${config?.email ? `<p>${config.email}</p>` : ""}
                ${config?.nif ? `<p>NIF: ${config.nif}</p>` : ""}
              </div>
              <div class="ticket-title">TICKET N° ${inv.numero}</div>
              <div class="ticket-info">
                <div class="ticket-info-row"><span>Date:</span><span>${inv.date_facture}</span></div>
                <div class="ticket-info-row"><span>Heure:</span><span>${inv.heure_facture}</span></div>
                <div class="ticket-info-row"><span>Caissier:</span><span>${inv.vendeur}</span></div>
                ${inv.client_nom && inv.client_nom !== "Client comptoir" ? `<div class="ticket-info-row"><span>Client:</span><span>${inv.client_nom}</span></div>` : ""}
                ${inv.client_telephone ? `<div class="ticket-info-row"><span>Tel:</span><span>${inv.client_telephone}</span></div>` : ""}
              </div>
              <div class="ticket-articles">
                ${articles.map((a: any) => `
                  <div class="ticket-article">
                    <div class="ticket-article-name">${a.designation}</div>
                    <div class="ticket-article-details">
                      <span>${a.quantite} x ${formatCurrency(a.prixUnitaire)}</span>
                      <span>${formatCurrency(a.total)}</span>
                    </div>
                  </div>
                `).join("")}
              </div>
              <div class="ticket-totals">
                ${inv.total_avant_remise ? `
                  <div class="ticket-total-row"><span>Sous-total:</span><span>${formatCurrency(inv.total_avant_remise)}</span></div>
                  <div class="ticket-total-row" style="color:#dc2626"><span>Remise:</span><span>-${formatCurrency(inv.total_avant_remise - inv.total_ttc)}</span></div>
                ` : ""}
                <div class="ticket-total-row grand-total"><span>TOTAL</span><span>${formatCurrency(inv.total_ttc)}</span></div>
              </div>
              <div class="ticket-payment">
                <div class="ticket-payment-row"><span>Méthode:</span><span>${inv.methode_paiement}</span></div>
                <div class="ticket-payment-row"><span>Payé:</span><span>${formatCurrency(inv.montant_paye)}</span></div>
                ${inv.monnaie_rendue > 0 ? `<div class="ticket-payment-row"><span>Monnaie:</span><span>${formatCurrency(inv.monnaie_rendue)}</span></div>` : ""}
                ${(inv.montant_restant ?? 0) > 0 ? `<div class="ticket-payment-row" style="color:#dc2626;font-weight:bold"><span>Reste:</span><span>${formatCurrency(inv.montant_restant)}</span></div>` : ""}
              </div>
              <div class="ticket-footer">
                <p class="thank-you">${config?.message_pied || "Merci de votre confiance !"}</p>
                ${config?.support_text ? `<p>${config.support_text}</p>` : ""}
                <p style="font-size:9px;margin-top:3mm;padding-top:2mm;border-top:1px dashed #000">Ref: ${inv.numero}</p>
              </div>
            </div>
            <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},100);},500);};</script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "en_attente":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
      case "en_cours":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
            <Truck className="w-3 h-3" /> En cours
          </span>
        );
      case "livree":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Livrée
          </span>
        );
      case "annulee":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Annulée
          </span>
        );
      default:
        return statut;
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Livraisons
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalItems} livraison(s)
          </p>
        </div>
        {/* <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle livraison
        </button> */}
      </div>

      <div className="card">
        <div className="flex gap-4 items-end flex-wrap mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filtrer par statut
            </label>
            <select
              value={statutFilter}
              onChange={(e) => {
                setStatutFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="livree">Livrée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : livraisons.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune livraison
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Créez une nouvelle livraison pour commencer
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Vente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Adresse
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date prévue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Livreur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {livraisons.map((livraison) => (
                  <tr
                    key={livraison.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      #{livraison.id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">
                          Vente #{livraison.vente_id}
                        </span>
                        {livraison.vente_total && (
                          <p className="text-xs text-gray-500">
                            {formatCurrency(livraison.vente_total)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.client_nom_full || livraison.client_nom || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="truncate">
                          {livraison.adresse_livraison || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.date_prevue ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(livraison.date_prevue).toLocaleDateString(
                            "fr-FR",
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {livraison.livreur ? (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-gray-400" />
                          {livraison.livreur}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatutBadge(livraison.statut)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedLivraison(livraison);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewInvoice(livraison.vente_id)}
                          className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                          title="Voir la facture"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {livraison.statut === "en_attente" && (
                          <button
                            onClick={() =>
                              handleUpdateStatut(livraison.id, "en_cours")
                            }
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Démarrer
                          </button>
                        )}
                        {livraison.statut === "en_cours" && (
                          <button
                            onClick={() =>
                              handleUpdateStatut(livraison.id, "livree")
                            }
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Livrer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            itemsPerPageOptions={[10, 20, 50]}
            onItemsPerPageChange={(n) => {
              setItemsPerPage(n);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Nouvelle livraison</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Vente *
                </label>
                <input
                  type="text"
                  value={venteSearch}
                  onChange={(e) => setVenteSearch(e.target.value)}
                  className="input-field mb-1"
                  placeholder="Rechercher par n° ou client..."
                />
                <select
                  value={formData.vente_id}
                  onChange={(e) => {
                    const vente = ventes.find(
                      (v) => v.id === parseInt(e.target.value),
                    );
                    setFormData({
                      ...formData,
                      vente_id: e.target.value,
                      adresse_livraison:
                        vente?.client_adresse || formData.adresse_livraison,
                    });
                  }}
                  className="input-field"
                  size={5}
                >
                  <option value="">-- Sélectionner une vente --</option>
                  {filteredVentes.map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.id} — {v.client_nom || "Comptoir"} —{" "}
                      {formatCurrency(v.total)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Adresse de livraison
                </label>
                <textarea
                  value={formData.adresse_livraison}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adresse_livraison: e.target.value,
                    })
                  }
                  className="input-field"
                  rows={2}
                  placeholder="Adresse complète..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date prévue
                  </label>
                  <input
                    type="date"
                    value={formData.date_prevue}
                    onChange={(e) =>
                      setFormData({ ...formData, date_prevue: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Livreur
                  </label>
                  <input
                    type="text"
                    value={formData.livreur}
                    onChange={(e) =>
                      setFormData({ ...formData, livreur: e.target.value })
                    }
                    className="input-field"
                    placeholder="Nom du livreur"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="input-field"
                  rows={2}
                  placeholder="Instructions particulières..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setVenteSearch("");
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button onClick={handleCreate} className="btn-primary flex-1">
                Créer la livraison
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedLivraison && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Détails livraison #{selectedLivraison.id}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLivraison(null);
                }}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Vente</span>
                <span className="font-medium">
                  #{selectedLivraison.vente_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">
                  {selectedLivraison.client_nom_full ||
                    selectedLivraison.client_nom ||
                    "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(selectedLivraison.vente_total || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Adresse</span>
                <span className="font-medium text-right max-w-[60%]">
                  {selectedLivraison.adresse_livraison || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Date prévue</span>
                <span className="font-medium">
                  {selectedLivraison.date_prevue
                    ? new Date(
                        selectedLivraison.date_prevue,
                      ).toLocaleDateString("fr-FR")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Livreur</span>
                <span className="font-medium">
                  {selectedLivraison.livreur || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Statut</span>
                {getStatutBadge(selectedLivraison.statut)}
              </div>
              {selectedLivraison.notes && (
                <div>
                  <span className="text-gray-500 block mb-1">Notes</span>
                  <p className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    {selectedLivraison.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedLivraison(null);
                }}
                className="btn-secondary flex-1"
              >
                Fermer
              </button>
              <button
                onClick={() => handleViewInvoice(selectedLivraison.vente_id)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-all"
              >
                <FileText className="w-4 h-4" />
                Facture
              </button>
              {selectedLivraison.statut === "en_attente" && (
                <button
                  onClick={() => {
                    handleUpdateStatut(selectedLivraison.id, "en_cours");
                    setShowDetailModal(false);
                    setSelectedLivraison(null);
                  }}
                  className="btn-primary flex-1"
                >
                  Démarrer la livraison
                </button>
              )}
              {selectedLivraison.statut === "en_cours" && (
                <button
                  onClick={() => {
                    handleUpdateStatut(selectedLivraison.id, "livree");
                    setShowDetailModal(false);
                    setSelectedLivraison(null);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex-1 hover:bg-green-700"
                >
                  Marquer comme livrée
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal facture */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {loadingInvoice
                      ? "Chargement…"
                      : invoiceData
                        ? `Facture ${invoiceData.numero}`
                        : "Facture introuvable"}
                  </h2>
                  {invoiceData && !loadingInvoice && (
                    <p className="text-xs text-gray-500">
                      {invoiceData.date_facture}
                      {invoiceData.heure_facture
                        ? " à " + invoiceData.heure_facture
                        : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {invoiceData && !loadingInvoice && (
                  <button
                    onClick={handlePrintInvoice}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setInvoiceData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingInvoice ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : !invoiceData ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Aucune facture associée à cette vente.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Infos client + paiement */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs uppercase text-gray-400 font-medium mb-2">Client</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {invoiceData.client_nom || "Comptoir"}
                      </p>
                      {invoiceData.client_telephone && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {invoiceData.client_telephone}
                        </p>
                      )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs uppercase text-gray-400 font-medium mb-2">Paiement</p>
                      <p className="font-semibold text-gray-900 dark:text-white capitalize">
                        {invoiceData.methode_paiement || "-"}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 capitalize">
                        {invoiceData.statut_paiement || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Articles */}
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-medium mb-2">Articles</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                          <th className="text-left px-3 py-2 rounded-l-lg">Désignation</th>
                          <th className="text-right px-3 py-2">Qté</th>
                          <th className="text-right px-3 py-2">P.U.</th>
                          <th className="text-right px-3 py-2 rounded-r-lg">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(Array.isArray(invoiceData.articles)
                          ? invoiceData.articles
                          : []
                        ).map((article: any, i: number) => (
                          <tr key={i} className="text-gray-700 dark:text-gray-200">
                            <td className="px-3 py-2">
                              {article.designation}
                            </td>
                            <td className="px-3 py-2 text-right">{article.quantite}</td>
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(article.prixUnitaire || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(article.total || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totaux */}
                  <div className="flex justify-end">
                    <div className="w-64 space-y-1.5 text-sm">
                      {invoiceData.total_avant_remise && (
                        <div className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>Sous-total</span>
                          <span>{formatCurrency(invoiceData.total_avant_remise)}</span>
                        </div>
                      )}
                      {invoiceData.total_avant_remise > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>
                            Remise ({invoiceData.remise_type === "pourcentage"
                              ? invoiceData.remise_valeur + "%"
                              : formatCurrency(invoiceData.remise_valeur)})
                          </span>
                          <span>-{formatCurrency(invoiceData.total_avant_remise - invoiceData.total_ttc)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base text-blue-600 border-t border-gray-200 dark:border-gray-600 pt-2 mt-1">
                        <span>Total</span>
                        <span>{formatCurrency(invoiceData.total_ttc || 0)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Payé</span>
                        <span>{formatCurrency(invoiceData.montant_paye || 0)}</span>
                      </div>
                      {invoiceData.montant_restant > 0 && (
                        <div className="flex justify-between font-semibold text-red-600">
                          <span>Reste à payer</span>
                          <span>{formatCurrency(invoiceData.montant_restant)}</span>
                        </div>
                      )}
                      {invoiceData.monnaie_rendue > 0 && (
                        <div className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>Monnaie rendue</span>
                          <span>{formatCurrency(invoiceData.monnaie_rendue)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Livraisons;
