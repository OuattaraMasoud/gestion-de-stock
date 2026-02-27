import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  TrendingUp,
  Calendar,
  Package,
  BarChart3,
  Banknote,
  Users,
  Star,
  Search,
  X,
  Phone,
  Mail,
  ShoppingBag,
  CreditCard,
  Eye,
  Truck,
  FileText,
  Printer,
} from "lucide-react";
import { Sale, DashboardStats } from "../types";
import { formatCurrency } from "../utils/formatters";

interface TopProduct {
  product_id: number;
  nom: string;
  quantite_vendue: number;
  chiffre_affaires: number;
  marge: number;
}

interface TopClient {
  client_id: number;
  nom: string;
  telephone?: string;
  chiffre_affaires: number;
  nb_achats: number;
  solde_du: number;
}

type PeriodType = "today" | "thisWeek" | "thisMonth" | "lastMonth";

const periodLabels: Record<PeriodType, string> = {
  today: "Aujourd'hui",
  thisWeek: "Cette semaine",
  thisMonth: "Ce mois",
  lastMonth: "Mois dernier",
};

const getDateRange = (period: PeriodType): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  switch (period) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "thisWeek": {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return { start: formatDate(startOfWeek), end: formatDate(today) };
    }
    case "thisMonth": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(startOfMonth), end: formatDate(today) };
    }
    case "lastMonth": {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(startOfLastMonth), end: formatDate(endOfLastMonth) };
    }
    default:
      return { start: formatDate(today), end: formatDate(today) };
  }
};

type TabType = "stats" | "clients" | "commandes" | "livraisons" | "proformas" | "rapports";

const Statistics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");

  // Clients tab state
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientStats, setClientStats] = useState<any>(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [clientStatsLoading, setClientStatsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client period filter
  const [clientPeriod, setClientPeriod] = useState<PeriodType | "custom">("thisMonth");
  const [clientCustomStart, setClientCustomStart] = useState("");
  const [clientCustomEnd, setClientCustomEnd] = useState("");

  // Sale detail modal
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);

  // Commandes (achats) tab
  const [commandes, setCommandes] = useState<any[]>([]);
  const [commandesLoading, setCommandesLoading] = useState(false);
  const [commandesPage, setCommandesPage] = useState(1);
  const [commandesTotal, setCommandesTotalPages] = useState(1);
  const [commandesCount, setCommandesCount] = useState(0);
  const [selectedCommande, setSelectedCommande] = useState<any | null>(null);

  // Livraisons tab
  const [livraisons, setLivraisons] = useState<any[]>([]);
  const [livraisonsLoading, setLivraisonsLoading] = useState(false);
  const [livraisonsPage, setLivraisonsPage] = useState(1);
  const [livraisonsTotal, setLivraisonsTotalPages] = useState(1);
  const [livraisonsCount, setLivraisonsCount] = useState(0);
  const [livraisonsStatut, setLivraisonsStatut] = useState<string>("");

  // Proformas tab
  const [proformas, setProformas] = useState<any[]>([]);
  const [proformasLoading, setProformasLoading] = useState(false);
  const [proformasPage, setProformasPage] = useState(1);
  const [proformasTotal, setProformasTotalPages] = useState(1);
  const [proformasCount, setProformasCount] = useState(0);
  const [proformasStatut, setProformasStatut] = useState<string>("");

  // Proforma detail modal
  const [selectedProforma, setSelectedProforma] = useState<any>(null);

  // Livraison detail modal
  const [selectedLivraison, setSelectedLivraison] = useState<any>(null);
  const [livraisonVente, setLivraisonVente] = useState<any>(null);
  const [livraisonVenteLoading, setLivraisonVenteLoading] = useState(false);

  // Report preview modal
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  // Rapports tab
  const [rapportStartDate, setRapportStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rapportEndDate, setRapportEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [generatingReport1, setGeneratingReport1] = useState(false);
  const [generatingReport2, setGeneratingReport2] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");

  useEffect(() => {
    window.electronAPI.getConfiguration().then(setConfig).catch(console.error);
    window.electronAPI.getCompanyLogo().then((logo) => setLogoBase64(logo || "")).catch(console.error);
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [selectedPeriod]);

  useEffect(() => {
    if (activeTab === "commandes") loadCommandes();
  }, [activeTab, commandesPage]);

  useEffect(() => {
    if (activeTab === "livraisons") loadLivraisons();
  }, [activeTab, livraisonsPage, livraisonsStatut]);

  useEffect(() => {
    if (activeTab === "proformas") loadProformas();
  }, [activeTab, proformasPage, proformasStatut]);

  const loadStatistics = async () => {
    try {
      const { start, end } = getDateRange(selectedPeriod);
      const [statsData, salesResult, topProductsData, topClientsData] = await Promise.all([
        window.electronAPI.getDashboardStats(),
        window.electronAPI.getSalesPaginated(1, 10),
        window.electronAPI.getTopProducts(10, start, end),
        window.electronAPI.getTopClients(10, start, end),
      ]);
      setStats(statsData);
      setRecentSales(salesResult.data);
      setTopProducts(topProductsData);
      setTopClients(topClientsData);
    } catch (error) {
      console.error("Erreur chargement statistiques:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommandes = async () => {
    setCommandesLoading(true);
    try {
      const result = await window.electronAPI.getPurchasesPaginated(commandesPage, 15);
      setCommandes(result.data);
      setCommandesTotalPages(result.totalPages);
      setCommandesCount(result.total);
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
    } finally {
      setCommandesLoading(false);
    }
  };

  const loadLivraisons = async () => {
    setLivraisonsLoading(true);
    try {
      const result = await window.electronAPI.getLivraisons(livraisonsPage, 15, livraisonsStatut || undefined);
      setLivraisons(result.data);
      setLivraisonsTotalPages(result.totalPages);
      setLivraisonsCount(result.total);
    } catch (error) {
      console.error("Erreur chargement livraisons:", error);
    } finally {
      setLivraisonsLoading(false);
    }
  };

  const loadProformas = async () => {
    setProformasLoading(true);
    try {
      const result = await window.electronAPI.getProformaInvoicesPaginated(proformasPage, 15, undefined, proformasStatut || undefined);
      setProformas(result.data);
      setProformasTotalPages(result.totalPages);
      setProformasCount(result.total);
    } catch (error) {
      console.error("Erreur chargement proformas:", error);
    } finally {
      setProformasLoading(false);
    }
  };

  const handleClientSearch = useCallback((query: string) => {
    setClientSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setClientSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setClientSearchLoading(true);
      try {
        const result = await window.electronAPI.getClientsPaginated(1, 10, query);
        setClientSearchResults(result.data);
      } catch (error) {
        console.error("Erreur recherche clients:", error);
      } finally {
        setClientSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectClient = (client: any) => {
    setSelectedClientId(client.id);
    setClientSearch(client.nom);
    setClientSearchResults([]);
  };

  const handleClearClient = () => {
    setSelectedClientId(null);
    setClientSearch("");
    setClientSearchResults([]);
    setClientStats(null);
  };

  const handleViewSaleDetail = async (saleId: number) => {
    setSaleDetailLoading(true);
    setShowSaleDetailModal(true);
    setSelectedSaleDetail(null);
    try {
      const data = await window.electronAPI.getVenteDetails(saleId);
      setSelectedSaleDetail(data);
    } catch (error) {
      console.error("Erreur chargement détails vente:", error);
    } finally {
      setSaleDetailLoading(false);
    }
  };

  const handleShowLivraisonDetails = async (liv: any) => {
    setSelectedLivraison(liv);
    setLivraisonVente(null);
    if (liv.vente_id) {
      setLivraisonVenteLoading(true);
      try {
        const details = await window.electronAPI.getVenteDetails(liv.vente_id);
        setLivraisonVente(details);
      } finally {
        setLivraisonVenteLoading(false);
      }
    }
  };

  const handlePrintFromPreview = () => {
    const printHtml = previewHtml.replace(
      "</body>",
      `<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},100);},500);}<\/script></body>`,
    );
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(printHtml);
      w.document.close();
    }
  };

  // Load / reload client stats when client or period changes
  useEffect(() => {
    if (selectedClientId === null) return;
    if (clientPeriod === "custom" && (!clientCustomStart || !clientCustomEnd)) return;

    let startDate: string | undefined;
    let endDate: string | undefined;
    if (clientPeriod === "custom") {
      startDate = clientCustomStart;
      endDate = clientCustomEnd;
    } else {
      const { start, end } = getDateRange(clientPeriod as PeriodType);
      startDate = start;
      endDate = end;
    }

    setClientStatsLoading(true);
    window.electronAPI
      .getClientStats(selectedClientId, startDate, endDate)
      .then(setClientStats)
      .catch((e) => console.error("Erreur chargement stats client:", e))
      .finally(() => setClientStatsLoading(false));
  }, [selectedClientId, clientPeriod, clientCustomStart, clientCustomEnd]);

  const printSalesValueReport = async () => {
    setGeneratingReport1(true);
    try {
      const data = await window.electronAPI.getSalesValueReport(rapportStartDate, rapportEndDate);
      const fmt = (n: number) => n.toLocaleString("fr-FR");
      const totalQte = data.reduce((s: number, r: any) => s + Number(r.quantite), 0);
      const totalAchat = data.reduce((s: number, r: any) => s + Number(r.valeur_achat), 0);
      const totalVente = data.reduce((s: number, r: any) => s + Number(r.valeur_vente), 0);
      const totalMarge = data.reduce((s: number, r: any) => s + Number(r.marge), 0);

      const startFmt = new Date(rapportStartDate).toLocaleDateString("fr-FR");
      const endFmt = new Date(rapportEndDate).toLocaleDateString("fr-FR");
      const nomEntreprise = config?.nom_entreprise || "Entreprise";
      const ville = config?.ville || "";
      const logoSrc = logoBase64 ? `<img src="${logoBase64}" style="height:60px;object-fit:contain;" alt="logo" />` : "";

      const rows = data.map((r: any, i: number) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${r.designation}</td>
          <td style="text-align:center">${fmt(Number(r.quantite))} ${r.unite}</td>
          <td style="text-align:right">${fmt(Number(r.valeur_achat))}</td>
          <td style="text-align:right">${fmt(Number(r.valeur_vente))}</td>
          <td style="text-align:right">${fmt(Number(r.marge))}</td>
        </tr>
      `).join("");

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Valeur des Ventes</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .header-center { text-align: center; flex: 1; }
  .header-center h1 { font-size: 18px; font-weight: bold; margin: 4px 0; }
  .header-right { text-align: right; font-size: 11px; color: #555; }
  .title { text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin: 16px 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
  td { border: 1px solid #ccc; padding: 5px 8px; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals td { font-weight: bold; background: #e8e8e8; }
  @media print { @page { size: A4 portrait; margin: 15mm; } }
</style>
</head><body>
<div class="header">
  <div>${logoSrc}</div>
  <div class="header-center">
    <h1>${nomEntreprise}</h1>
    <div style="font-size:11px;color:#555">${config?.description_entreprise || ""}</div>
  </div>
  <div class="header-right">
    ${ville ? ville + "<br>" : ""}
    Le ${new Date().toLocaleDateString("fr-FR")}
  </div>
</div>
<div class="title">VALEUR DES VENTES DU : ${startFmt} AU ${endFmt}</div>
<table>
  <thead>
    <tr>
      <th style="width:40px">N°</th>
      <th>Désignation</th>
      <th>Stock</th>
      <th style="text-align:right">Valeur Achat</th>
      <th style="text-align:right">Valeur Vente</th>
      <th style="text-align:right">Marge</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="totals">
      <td colspan="2" style="text-align:right">TOTAUX</td>
      <td style="text-align:center">${fmt(totalQte)}</td>
      <td style="text-align:right">${fmt(totalAchat)}</td>
      <td style="text-align:right">${fmt(totalVente)}</td>
      <td style="text-align:right">${fmt(totalMarge)}</td>
    </tr>
  </tbody>
</table>
</body></html>`;

      setPreviewHtml(html);
      setPreviewTitle("Valeur des Ventes");
      setShowReportPreview(true);
    } catch (error) {
      console.error("Erreur génération rapport valeur ventes:", error);
    } finally {
      setGeneratingReport1(false);
    }
  };

  const printCreditSalesReport = async () => {
    setGeneratingReport2(true);
    try {
      const ventes = await window.electronAPI.getCreditSalesReport(rapportStartDate, rapportEndDate);
      const fmt = (n: number) => n.toLocaleString("fr-FR");

      const startFmt = new Date(rapportStartDate).toLocaleDateString("fr-FR");
      const endFmt = new Date(rapportEndDate).toLocaleDateString("fr-FR");
      const nomEntreprise = config?.nom_entreprise || "Entreprise";
      const ville = config?.ville || "";
      const logoSrc = logoBase64 ? `<img src="${logoBase64}" style="height:60px;object-fit:contain;" alt="logo" />` : "";

      const totalGeneral = ventes.reduce((s: number, v: any) => s + Number(v.total), 0);
      const totalRemise = ventes.reduce((s: number, v: any) => {
        if (!v.remise_type) return s;
        if (v.remise_type === "pourcentage") return s + (Number(v.total_avant_remise) * Number(v.remise_valeur) / 100);
        return s + Number(v.remise_valeur);
      }, 0);
      const totalTVA = 0;
      const totalTTC = totalGeneral;
      const totalDejaPaye = ventes.reduce((s: number, v: any) => s + Number(v.montant_paye), 0);
      const totalResteAPayer = ventes.reduce((s: number, v: any) => s + Number(v.montant_restant), 0);

      const ventesRows = ventes.map((v: any) => {
        const dateStr = new Date(v.date_vente).toLocaleDateString("fr-FR");
        const remiseDisplay = v.remise_type === "pourcentage"
          ? `${v.remise_valeur}%`
          : v.remise_valeur > 0 ? fmt(v.remise_valeur) : "0";
        const produitsRows = (v.produits || []).map((p: any, pi: number) => `
          <tr>
            <td style="text-align:center">${pi + 1}</td>
            <td>${p.nom_produit}</td>
            <td style="text-align:right">${fmt(Number(p.prix_unitaire))}</td>
            <td style="text-align:center">${p.quantite}</td>
            <td style="text-align:right">${fmt(Number(p.sous_total))}</td>
          </tr>
        `).join("");

        return `
          <div class="vente-block">
            <div class="vente-info">
              <span>Date: <b>${dateStr}</b></span>
              <span>Client: <b>${v.client_nom || "—"}</b></span>
              ${v.client_telephone ? `<span>Tél: ${v.client_telephone}</span>` : ""}
              ${v.client_email ? `<span>Email: ${v.client_email}</span>` : ""}
              <span>Payé par: <b>${v.methode_paiement || "—"}</b></span>
              <span>Type Vente: <b>CRÉDIT</b></span>
              <span>Livrée: <b>${v.delivered ? "OUI" : "NON"}</b></span>
            </div>
            <div class="vente-resume">
              <span><b>${v.numero || `#${v.id}`}</b></span>
              <span>Montant total: <b>${fmt(Number(v.total_avant_remise))}</b></span>
              <span>Remise: <b>${remiseDisplay}</b></span>
              <span>TVA: <b>0</b></span>
              <span>Total TTC: <b>${fmt(Number(v.total))}</b></span>
              <span>Payé: <b>${fmt(Number(v.montant_paye))}</b></span>
              <span style="color:#c00">Reste: <b>${fmt(Number(v.montant_restant))}</b></span>
            </div>
            <table class="produits-table">
              <thead>
                <tr>
                  <th style="width:30px">N°</th>
                  <th>Désignation</th>
                  <th style="text-align:right">Prix U.</th>
                  <th style="text-align:center">Qté</th>
                  <th style="text-align:right">Sous-total</th>
                </tr>
              </thead>
              <tbody>
                ${produitsRows}
                <tr class="total-row">
                  <td colspan="4" style="text-align:right">TOTAL</td>
                  <td style="text-align:right">${fmt(Number(v.total))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join("");

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Ventes à Crédit</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .header-center { text-align: center; flex: 1; }
  .header-center h1 { font-size: 17px; font-weight: bold; margin: 4px 0; }
  .header-right { text-align: right; font-size: 11px; color: #555; }
  .main-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin: 12px 0 16px; }
  .period { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
  .vente-block { margin-bottom: 18px; border: 1px solid #ccc; border-radius: 4px; padding: 8px; page-break-inside: avoid; }
  .vente-info { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 6px; font-size: 11px; }
  .vente-resume { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 8px; font-size: 11px; background: #f5f5f5; padding: 5px 8px; border-radius: 3px; }
  .produits-table { width: 100%; border-collapse: collapse; }
  .produits-table th { background: #eee; border: 1px solid #ccc; padding: 4px 6px; font-size: 10px; }
  .produits-table td { border: 1px solid #ddd; padding: 3px 6px; }
  .total-row td { font-weight: bold; background: #f0f0f0; }
  .recap { margin-top: 24px; }
  .recap table { width: 100%; border-collapse: collapse; }
  .recap th { background: #333; color: white; padding: 6px 10px; font-size: 11px; text-align: center; }
  .recap td { border: 1px solid #ccc; padding: 6px 10px; text-align: center; font-size: 12px; font-weight: bold; }
  @media print { @page { size: A4 portrait; margin: 12mm; } }
</style>
</head><body>
<div class="header">
  <div>${logoSrc}</div>
  <div class="header-center">
    <h1>${nomEntreprise}</h1>
    <div style="font-size:11px;color:#555">${config?.description_entreprise || ""}</div>
  </div>
  <div class="header-right">
    ${ville ? ville + "<br>" : ""}
    Le ${new Date().toLocaleDateString("fr-FR")}
  </div>
</div>
<div class="main-title">LISTE DÉTAILLÉE DES VENTES A CRÉDIT</div>
<div class="period">Du ${startFmt} au ${endFmt}</div>

${ventesRows}

<div class="recap">
  <table>
    <thead>
      <tr>
        <th>Total Général</th>
        <th>Total Remise</th>
        <th>Total TVA</th>
        <th>Total TTC</th>
        <th>Total Déjà Payé</th>
        <th>Reste à Payer</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${fmt(totalGeneral)}</td>
        <td>${fmt(totalRemise)}</td>
        <td>${fmt(totalTVA)}</td>
        <td>${fmt(totalTTC)}</td>
        <td>${fmt(totalDejaPaye)}</td>
        <td style="color:#c00">${fmt(totalResteAPayer)}</td>
      </tr>
    </tbody>
  </table>
</div>
</body></html>`;

      setPreviewHtml(html);
      setPreviewTitle("Liste Détaillée des Ventes à Crédit");
      setShowReportPreview(true);
    } catch (error) {
      console.error("Erreur génération rapport ventes crédit:", error);
    } finally {
      setGeneratingReport2(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const averagePerSale =
    stats?.nbVentesJour && stats.nbVentesJour > 0
      ? Number(stats.ventesJour) / Number(stats.nbVentesJour)
      : 0;

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "stats", label: "Ventes", icon: BarChart3 },
    { id: "clients", label: "Clients", icon: Users },
    { id: "commandes", label: "Commandes", icon: Package },
    { id: "livraisons", label: "Livraisons", icon: Truck },
    { id: "proformas", label: "Proformas", icon: FileText },
    { id: "rapports", label: "Rapports", icon: FileText },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistiques</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Analyse détaillée de vos ventes et performances
          </p>
        </div>
        {/* Onglets */}
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-gray-800 shadow text-blue-600"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Onglet Clients ===== */}
      {activeTab === "clients" && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Statistiques par client
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => handleClientSearch(e.target.value)}
                placeholder="Rechercher un client (nom, téléphone)..."
                className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
              {clientSearch && (
                <button
                  onClick={handleClearClient}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedClientId !== null && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">Période :</span>
                <select
                  value={clientPeriod}
                  onChange={(e) => setClientPeriod(e.target.value as PeriodType | "custom")}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                >
                  {Object.entries(periodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  <option value="custom">Personnalisé</option>
                </select>
                {clientPeriod === "custom" && (
                  <>
                    <input
                      type="date"
                      value={clientCustomStart}
                      onChange={(e) => setClientCustomStart(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                    />
                    <span className="text-gray-400 text-sm">→</span>
                    <input
                      type="date"
                      value={clientCustomEnd}
                      onChange={(e) => setClientCustomEnd(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                    />
                  </>
                )}
              </div>
            )}

            {clientSearchLoading && (
              <div className="mt-3 text-center text-gray-500 text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
            {clientSearchResults.length > 0 && (
              <div className="mt-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {clientSearchResults.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                  >
                    <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {client.nom?.charAt(0) || "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{client.nom}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {client.telephone || client.email || "Pas de contact"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {clientStatsLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}

          {clientStats && !clientStatsLoading && (
            <div className="space-y-6">
              <div className="card border-l-4 border-blue-500">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                    {clientStats.client?.nom?.charAt(0) || "C"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {clientStats.client?.nom}
                    </h3>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {clientStats.client?.telephone && (
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-3.5 h-3.5" />
                          {clientStats.client.telephone}
                        </span>
                      )}
                      {clientStats.client?.email && (
                        <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="w-3.5 h-3.5" />
                          {clientStats.client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nb ventes</p>
                  <p className="text-2xl font-bold text-blue-600">{clientStats.nb_ventes ?? 0}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total achats</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(clientStats.total_achats ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Montant payé</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(clientStats.total_paye ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total dettes</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(clientStats.total_dettes ?? 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Reste à payer</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(clientStats.reste_a_payer ?? 0)}</p>
                </div>
              </div>

              {clientStats.recentSales && clientStats.recentSales.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    Ventes récentes (10 dernières)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium text-right">Montant</th>
                          <th className="py-2 pr-4 font-medium text-center">Statut</th>
                          <th className="py-2 pr-4 font-medium text-center">Articles</th>
                          <th className="py-2 pr-4 font-medium text-center">Livré</th>
                          <th className="py-2 font-medium text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {clientStats.recentSales.map((sale: any) => (
                          <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                              {new Date(sale.date_vente).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                              })}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(sale.total ?? 0)}
                              </span>
                              {(sale.statut_paiement === "partiel" || sale.statut_paiement === "impaye") && (
                                <div className="text-xs mt-0.5 space-x-2">
                                  <span className="text-green-600">Payé: {formatCurrency(sale.montant_paye ?? 0)}</span>
                                  <span className="text-red-500 font-medium">Reste: {formatCurrency(sale.montant_restant ?? 0)}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                sale.statut_paiement === "paye"
                                  ? "bg-green-100 text-green-700"
                                  : sale.statut_paiement === "partiel"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-red-100 text-red-700"
                              }`}>
                                <CreditCard className="w-3 h-3" />
                                {sale.statut_paiement === "paye"
                                  ? "Payé"
                                  : sale.statut_paiement === "partiel"
                                    ? "Partiel"
                                    : "Impayé"}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-center text-gray-600 dark:text-gray-400">
                              {sale.nb_articles ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              <span className={`text-xs font-medium ${sale.livre ? "text-green-600" : "text-gray-400"}`}>
                                {sale.livre ? "✓" : "—"}
                              </span>
                            </td>
                            <td className="py-2.5 text-center">
                              <button
                                onClick={() => handleViewSaleDetail(sale.id)}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                                title="Voir le détail"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!clientStats && !clientStatsLoading && !clientSearch && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-8 mb-4">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Recherchez un client pour voir ses statistiques
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== Onglet Commandes ===== */}
      {activeTab === "commandes" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Commandes Fournisseurs
            </h2>
            {commandesLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4 font-medium">#</th>
                        <th className="py-2 pr-4 font-medium">Fournisseur</th>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium text-right">Total</th>
                        <th className="py-2 pr-4 font-medium text-right">Payé</th>
                        <th className="py-2 pr-4 font-medium text-right">Reste</th>
                        <th className="py-2 font-medium text-center">Statut</th>
                        <th className="py-2 font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {commandes.map((cmd: any) => (
                        <tr key={cmd.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">#{cmd.id}</td>
                          <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{cmd.fournisseur_nom}</td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                            {new Date(cmd.date_achat).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(cmd.total)}</td>
                          <td className="py-2.5 pr-4 text-right text-green-600">{formatCurrency(cmd.montant_paye ?? 0)}</td>
                          <td className="py-2.5 pr-4 text-right text-red-600">{formatCurrency(cmd.montant_restant ?? 0)}</td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              cmd.statut_paiement === "paye" ? "bg-green-100 text-green-700" :
                              cmd.statut_paiement === "partiel" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {cmd.statut_paiement === "paye" ? "Payé" : cmd.statut_paiement === "partiel" ? "Partiel" : "Impayé"}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => setSelectedCommande(cmd)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Voir les produits"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {commandes.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Aucune commande trouvée</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {commandesCount > 0
                      ? `${(commandesPage - 1) * 15 + 1}–${Math.min(commandesPage * 15, commandesCount)} sur ${commandesCount} commande(s)`
                      : "Aucune commande"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCommandesPage(p => Math.max(1, p - 1))}
                      disabled={commandesPage === 1}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
                      Page {commandesPage} / {commandesTotal}
                    </span>
                    <button
                      onClick={() => setCommandesPage(p => Math.min(commandesTotal, p + 1))}
                      disabled={commandesPage === commandesTotal}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Onglet Livraisons ===== */}
      {activeTab === "livraisons" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-600" />
                Livraisons
              </h2>
              <select
                value={livraisonsStatut}
                onChange={(e) => { setLivraisonsStatut(e.target.value); setLivraisonsPage(1); }}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
              >
                <option value="">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="en_cours">En cours</option>
                <option value="livree">Livrée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
            {livraisonsLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4 font-medium">#</th>
                        <th className="py-2 pr-4 font-medium">Client</th>
                        <th className="py-2 pr-4 font-medium">Adresse</th>
                        <th className="py-2 pr-4 font-medium">Livreur</th>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium text-center">Statut</th>
                        <th className="py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {livraisons.map((liv: any) => (
                        <tr key={liv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">#{liv.id}</td>
                          <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{liv.client_nom || "—"}</td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 max-w-[150px] truncate">{liv.adresse_livraison || "—"}</td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">{liv.livreur || "—"}</td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                            {liv.date_livraison ? new Date(liv.date_livraison).toLocaleDateString("fr-FR") : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              liv.statut === "livree" ? "bg-green-100 text-green-700" :
                              liv.statut === "en_cours" ? "bg-blue-100 text-blue-700" :
                              liv.statut === "annulee" ? "bg-red-100 text-red-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {liv.statut === "livree" ? "Livrée" :
                               liv.statut === "en_cours" ? "En cours" :
                               liv.statut === "annulee" ? "Annulée" : "En attente"}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => handleShowLivraisonDetails(liv)}
                              className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {livraisons.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Aucune livraison trouvée</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {livraisonsCount > 0
                      ? `${(livraisonsPage - 1) * 15 + 1}–${Math.min(livraisonsPage * 15, livraisonsCount)} sur ${livraisonsCount} livraison(s)`
                      : "Aucune livraison"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLivraisonsPage(p => Math.max(1, p - 1))}
                      disabled={livraisonsPage === 1}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
                      Page {livraisonsPage} / {livraisonsTotal}
                    </span>
                    <button
                      onClick={() => setLivraisonsPage(p => Math.min(livraisonsTotal, p + 1))}
                      disabled={livraisonsPage === livraisonsTotal}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Onglet Proformas ===== */}
      {activeTab === "proformas" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Factures Proforma
              </h2>
              <select
                value={proformasStatut}
                onChange={(e) => { setProformasStatut(e.target.value); setProformasPage(1); }}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
              >
                <option value="">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="acceptee">Accepté</option>
                <option value="refusee">Refusé</option>
                <option value="convertie">Converti</option>
                <option value="expiree">Expiré</option>
              </select>
            </div>
            {proformasLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4 font-medium">N°</th>
                        <th className="py-2 pr-4 font-medium">Client</th>
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium text-right">Total</th>
                        <th className="py-2 pr-4 font-medium text-center">Statut</th>
                        <th className="py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {proformas.map((pro: any) => (
                        <tr key={pro.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">{pro.numero || `#${pro.id}`}</td>
                          <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{pro.client_nom || "—"}</td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                            {pro.date_proforma ? new Date(pro.date_proforma).toLocaleDateString("fr-FR") : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(pro.total_ttc ?? 0)}</td>
                          <td className="py-2.5 pr-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              pro.statut === "convertie" ? "bg-green-100 text-green-700" :
                              pro.statut === "acceptee" ? "bg-blue-100 text-blue-700" :
                              pro.statut === "refusee" ? "bg-red-100 text-red-700" :
                              pro.statut === "expiree" ? "bg-gray-100 text-gray-600" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {pro.statut === "convertie" ? "Converti" :
                               pro.statut === "acceptee" ? "Accepté" :
                               pro.statut === "refusee" ? "Refusé" :
                               pro.statut === "expiree" ? "Expiré" : "En attente"}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => setSelectedProforma(pro)}
                              className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors"
                              title="Voir les articles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {proformas.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Aucun proforma trouvé</p>
                )}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {proformasCount > 0
                      ? `${(proformasPage - 1) * 15 + 1}–${Math.min(proformasPage * 15, proformasCount)} sur ${proformasCount} proforma(s)`
                      : "Aucun proforma"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProformasPage(p => Math.max(1, p - 1))}
                      disabled={proformasPage === 1}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
                      Page {proformasPage} / {proformasTotal}
                    </span>
                    <button
                      onClick={() => setProformasPage(p => Math.min(proformasTotal, p + 1))}
                      disabled={proformasPage === proformasTotal}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Onglet Stats (contenu existant) ===== */}
      {activeTab === "stats" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Ventes du jour</p>
                  <p className="text-l font-bold text-green-600">{formatCurrency(stats?.ventesJour || 0)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stats?.nbVentesJour} transaction(s)</p>
                </div>
                <div className="bg-green-50 p-3 rounded-full">
                  <Banknote className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Ventes du mois</p>
                  <p className="text-l font-bold text-blue-600">{formatCurrency(stats?.ventesMois || 0)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mois en cours</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Panier moyen</p>
                  <p className="text-l font-bold text-purple-600">{formatCurrency(averagePerSale)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Par transaction</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-full">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Valeur du stock</p>
                  <p className="text-l font-bold text-yellow-600">{formatCurrency(stats?.valeurStock || 0)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stats?.totalProduits} produits</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-full">
                  <Package className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Performance du jour
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Nombre de ventes</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.nbVentesJour}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(((stats?.nbVentesJour || 0) / 50) * 100, 100)}%` }}></div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Chiffre d'affaires</span>
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(stats?.ventesJour || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(((stats?.ventesJour || 0) / 1000) * 100, 100)}%` }}></div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Panier moyen</span>
                    <span className="text-2xl font-bold text-purple-600">{formatCurrency(averagePerSale)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min((averagePerSale / 100) * 100, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Dernières ventes
              </h2>
              <div className="space-y-3">
                {recentSales.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune vente récente</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Vente #{sale.id}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(sale.date_vente!).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">{formatCurrency(sale.total || 0)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{sale.methode_paiement}</p>
                        </div>
                        <button
                          onClick={() => handleViewSaleDetail(sale.id!)}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors shrink-0"
                          title="Voir le détail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Top Performances
            </h2>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as PeriodType)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Top 10 Produits
              </h3>
              <div className="space-y-2">
                {topProducts.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune donnée pour cette période</p>
                ) : (
                  topProducts.map((product, index) => (
                    <div key={product.product_id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-200 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.quantite_vendue} vendus • Marge: {formatCurrency(product.marge)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(product.chiffre_affaires)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Top 10 Clients
              </h3>
              <div className="space-y-2">
                {topClients.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">Aucune donnée pour cette période</p>
                ) : (
                  topClients.map((client, index) => (
                    <div key={client.client_id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-200 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{client.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{client.nb_achats} achat(s) • {client.telephone || "N/A"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(client.chiffre_affaires)}</p>
                        {client.solde_du > 0 && (
                          <p className="text-xs text-red-500">Dette: {formatCurrency(client.solde_du)}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Alertes et Recommandations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats?.stockFaible && stats.stockFaible > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">Stock faible</p>
                  <p className="text-2xl font-bold text-red-600">{stats.stockFaible}</p>
                  <p className="text-xs text-red-700 mt-1">Produits à réapprovisionner</p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-1">Stock OK</p>
                  <p className="text-2xl font-bold text-green-600">✓</p>
                  <p className="text-xs text-green-700 mt-1">Tous les stocks sont suffisants</p>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Total produits</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.totalProduits}</p>
                <p className="text-xs text-blue-700 mt-1">Références en catalogue</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-800 mb-1">Investissement stock</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats?.valeurStock || 0)}</p>
                <p className="text-xs text-purple-700 mt-1">Valeur totale du stock</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Onglet Rapports ===== */}
      {activeTab === "rapports" && (
        <div className="space-y-6">
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date début</label>
              <input
                type="date"
                value={rapportStartDate}
                onChange={(e) => setRapportStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date fin</label>
              <input
                type="date"
                value={rapportEndDate}
                onChange={(e) => setRapportEndDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Valeur des Ventes</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Rapport des produits vendus avec valeur achat, valeur vente et marge
            </p>
            <button
              onClick={printSalesValueReport}
              disabled={generatingReport1}
              className="btn-primary flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              {generatingReport1 ? "Génération..." : "Générer le rapport"}
            </button>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Liste Détaillée des Ventes à Crédit</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Détail de toutes les ventes impayées ou partiellement payées
            </p>
            <button
              onClick={printCreditSalesReport}
              disabled={generatingReport2}
              className="btn-primary flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              {generatingReport2 ? "Génération..." : "Générer le rapport"}
            </button>
          </div>
        </div>
      )}

      {/* Modal détail proforma */}
      {selectedProforma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Proforma {selectedProforma.numero || `#${selectedProforma.id}`}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedProforma.client_nom || "—"} · {selectedProforma.date_proforma ? new Date(selectedProforma.date_proforma).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
              <button
                onClick={() => setSelectedProforma(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mb-4 text-sm">
              {selectedProforma.date_validite && (
                <span className="text-gray-500 dark:text-gray-400">
                  Validité: {new Date(selectedProforma.date_validite).toLocaleDateString("fr-FR")}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedProforma.statut === "convertie" ? "bg-green-100 text-green-700" :
                selectedProforma.statut === "acceptee" ? "bg-blue-100 text-blue-700" :
                selectedProforma.statut === "refusee" ? "bg-red-100 text-red-700" :
                selectedProforma.statut === "expiree" ? "bg-gray-100 text-gray-600" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {selectedProforma.statut === "convertie" ? "Converti" :
                 selectedProforma.statut === "acceptee" ? "Accepté" :
                 selectedProforma.statut === "refusee" ? "Refusé" :
                 selectedProforma.statut === "expiree" ? "Expiré" : "En attente"}
              </span>
            </div>
            <div className="overflow-y-auto max-h-64 border border-gray-100 dark:border-gray-700 rounded-xl">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-3 text-left font-medium">Article</th>
                    <th className="py-2 px-3 text-center font-medium w-12">Qté</th>
                    <th className="py-2 px-3 text-right font-medium">P.U.</th>
                    <th className="py-2 px-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(Array.isArray(selectedProforma.articles)
                    ? selectedProforma.articles
                    : JSON.parse(selectedProforma.articles || "[]")
                  ).map((a: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{a.nom || a.designation || a.nom_produit}</td>
                      <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{a.quantite}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(a.prix_unitaire ?? a.prixUnitaire ?? 0)}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(a.sous_total ?? a.total ?? (a.quantite * (a.prix_unitaire ?? a.prixUnitaire ?? 0)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total TTC</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(selectedProforma.total_ttc ?? 0)}</span>
            </div>
            {selectedProforma.notes && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{selectedProforma.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Modal détail livraison */}
      {selectedLivraison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Livraison #{selectedLivraison.id}
              </h2>
              <button
                onClick={() => { setSelectedLivraison(null); setLivraisonVente(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Client</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedLivraison.client_nom || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Livreur</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedLivraison.livreur || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Adresse</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedLivraison.adresse_livraison || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedLivraison.date_livraison ? new Date(selectedLivraison.date_livraison).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Statut</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedLivraison.statut === "livree" ? "bg-green-100 text-green-700" :
                  selectedLivraison.statut === "en_cours" ? "bg-blue-100 text-blue-700" :
                  selectedLivraison.statut === "annulee" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {selectedLivraison.statut === "livree" ? "Livrée" :
                   selectedLivraison.statut === "en_cours" ? "En cours" :
                   selectedLivraison.statut === "annulee" ? "Annulée" : "En attente"}
                </span>
              </div>
            </div>
            {livraisonVenteLoading && (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
              </div>
            )}
            {livraisonVente && !livraisonVenteLoading && (
              <>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Produits livrés</p>
                <div className="overflow-y-auto max-h-48 border border-gray-100 dark:border-gray-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-3 text-left font-medium">Produit</th>
                        <th className="py-2 px-3 text-center font-medium w-12">Qté</th>
                        <th className="py-2 px-3 text-right font-medium">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {livraisonVente.items?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.nom_produit}</td>
                          <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{item.quantite}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.sous_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                  <span className="text-sm font-bold text-blue-600">{formatCurrency(livraisonVente.total ?? 0)}</span>
                </div>
              </>
            )}
            {!livraisonVente && !livraisonVenteLoading && !selectedLivraison.vente_id && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Aucune vente liée à cette livraison</p>
            )}
          </div>
        </div>
      )}

      {/* Modal aperçu rapport */}
      {showReportPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                <FileText className="w-5 h-5 text-blue-600" />
                Aperçu — {previewTitle}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintFromPreview}
                  className="btn-primary flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
                <button
                  onClick={() => setShowReportPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              className="flex-1 w-full rounded-b-xl"
              title="Aperçu"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Modal détail d'une commande */}
      {selectedCommande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Commande #{selectedCommande.id}
              </h2>
              <button
                onClick={() => setSelectedCommande(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-between text-sm mb-4 text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{selectedCommande.fournisseur_nom}</span>
              <span>{new Date(selectedCommande.date_achat).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="overflow-y-auto max-h-64 border border-gray-100 dark:border-gray-700 rounded-xl">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 px-3 text-left font-medium">Produit</th>
                    <th className="py-2 px-3 text-center font-medium w-12">Qté</th>
                    <th className="py-2 px-3 text-right font-medium">Prix U.</th>
                    <th className="py-2 px-3 text-right font-medium">Sous-total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(selectedCommande.produits || []).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.nom_produit}</td>
                      <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{item.quantite}</td>
                      <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrency(item.prix_unitaire)}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(item.sous_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Payé</span>
                <span className="text-green-600 font-medium">{formatCurrency(selectedCommande.montant_paye ?? 0)}</span>
              </div>
              {(selectedCommande.montant_restant ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Reste</span>
                  <span className="text-red-600 font-medium">{formatCurrency(selectedCommande.montant_restant)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(selectedCommande.total ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail d'une vente */}
      {showSaleDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                {selectedSaleDetail ? `Vente #${selectedSaleDetail.id}` : "Détail de la vente"}
              </h2>
              <button
                onClick={() => { setShowSaleDetailModal(false); setSelectedSaleDetail(null); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saleDetailLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : selectedSaleDetail ? (
              <>
                <div className="flex justify-between text-sm mb-4 text-gray-600 dark:text-gray-400">
                  <span>
                    {new Date(selectedSaleDetail.date_vente).toLocaleString("fr-FR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold">{selectedSaleDetail.methode_paiement}</span>
                </div>
                <div className="overflow-y-auto max-h-64 border border-gray-100 dark:border-gray-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-3 text-left font-medium">Produit</th>
                        <th className="py-2 px-3 text-center font-medium w-12">Qté</th>
                        <th className="py-2 px-3 text-right font-medium">Prix U.</th>
                        <th className="py-2 px-3 text-right font-medium">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {selectedSaleDetail.items?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2 px-3 text-gray-800 dark:text-gray-200">{item.nom_produit}</td>
                          <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{item.quantite}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrency(item.prix_unitaire)}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(item.sous_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(selectedSaleDetail.total ?? 0)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
