import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, ShoppingCart, Package, Percent, Users, UserCheck, Clock, Printer } from 'lucide-react';
import { AccountingEntry } from '../types';
import { formatCurrency } from '../utils/formatters';
import Pagination from '../components/Pagination';

interface ProfitStats {
  chiffreAffaires: number;
  coutMarchandises: number;
  beneficeBrut: number;
  margePercent: number;
  nbVentes: number;
  nbProduitsVendus: number;
  totalAchats: number;
}

interface TreasuryEvolution {
  date: string;
  ca_jour: number;
  tresorerie_cumulee: number;
}

interface CaisseHistory {
  id: number;
  date_ouverture: string;
  heure_ouverture: string;
  date_fermeture: string | null;
  heure_fermeture: string | null;
  fonds_roulement: number;
  vendeur_nom: string | null;
  total_ventes: number | null;
  statut: string;
}

type PeriodType = "today" | "yesterday" | "last3days" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

const periodLabels: Record<PeriodType, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  last3days: "3 derniers jours",
  thisWeek: "Cette semaine",
  lastWeek: "Semaine dernière",
  thisMonth: "Ce mois",
  lastMonth: "Mois dernier",
  custom: "Personnalisé",
};

const getDateRange = (period: PeriodType, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  switch (period) {
    case "today":
      return { start: formatDate(today), end: formatDate(today) };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: formatDate(yesterday), end: formatDate(yesterday) };
    }
    case "last3days": {
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      return { start: formatDate(threeDaysAgo), end: formatDate(today) };
    }
    case "thisWeek": {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return { start: formatDate(startOfWeek), end: formatDate(today) };
    }
    case "lastWeek": {
      const startOfLastWeek = new Date(today);
      const day = startOfLastWeek.getDay();
      const diff = startOfLastWeek.getDate() - day + (day === 0 ? -6 : 1) - 7;
      startOfLastWeek.setDate(diff);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      return { start: formatDate(startOfLastWeek), end: formatDate(endOfLastWeek) };
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
    case "custom":
      return { start: customStart || formatDate(today), end: customEnd || formatDate(today) };
    default:
      return { start: formatDate(today), end: formatDate(today) };
  }
};

const Accounting: React.FC = () => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [treasury, setTreasury] = useState<number>(0);
  const [profitStats, setProfitStats] = useState<ProfitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalEntrees, setTotalEntrees] = useState(0);
  const [totalSorties, setTotalSorties] = useState(0);
  const [customerDebts, setCustomerDebts] = useState<number>(0);
  const [supplierDebts, setSupplierDebts] = useState<number>(0);
  const [caissesHistory, setCaissesHistory] = useState<CaisseHistory[]>([]);
  const [treasuryEvolution, setTreasuryEvolution] = useState<TreasuryEvolution[]>([]);

  useEffect(() => {
    loadAllData();
  }, [selectedPeriod, customStartDate, customEndDate, currentPage, itemsPerPage]);

  const loadAllData = async () => {
    const { start, end } = getDateRange(selectedPeriod, customStartDate, customEndDate);

    try {
      setLoading(true);
      const [statsResult, entriesResult, customerDebtsResult, supplierDebtsResult, caissesResult, evolutionResult, treasuryResult] = await Promise.all([
        window.electronAPI.getProfitStats(start, end),
        window.electronAPI.getAccountingEntriesPaginated(currentPage, itemsPerPage, start, end),
        window.electronAPI.getTotalCustomerDebtsByPeriod(start, end),
        window.electronAPI.getTotalSupplierDebtsByPeriod(start, end),
        window.electronAPI.getCaissesByPeriod(start, end),
        window.electronAPI.getTreasuryEvolution(start, end),
        window.electronAPI.getTreasuryByPeriod(start, end)
      ]);

      setProfitStats(statsResult);
      setEntries(entriesResult.data);
      setTotalItems(entriesResult.total);
      setTotalEntrees(entriesResult.totalEntrees);
      setTotalSorties(entriesResult.totalSorties);
      setCustomerDebts(customerDebtsResult);
      setSupplierDebts(supplierDebtsResult);
      setCaissesHistory(caissesResult);
      setTreasuryEvolution(evolutionResult);
      setTreasury(treasuryResult.total);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: PeriodType) => {
    setSelectedPeriod(period);
    setCurrentPage(1);
    if (period === "custom") {
      setShowCustomDates(true);
      if (!customStartDate) {
        const today = new Date().toISOString().split("T")[0];
        setCustomStartDate(today);
        setCustomEndDate(today);
      }
    } else {
      setShowCustomDates(false);
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'vente': 'Vente',
      'achat': 'Achat',
      'paiement_client': 'Paiement Client',
      'paiement_fournisseur': 'Paiement Fournisseur',
      'depense': 'Dépense',
      'ouverture_caisse': 'Ouverture Caisse',
      'autre': 'Autre',
    };
    return labels[type] || type;
  };

  const handlePrintStats = () => {
    const periodLabel = selectedPeriod === "custom" && customStartDate && customEndDate
      ? `Du ${new Date(customStartDate).toLocaleDateString("fr-FR")} au ${new Date(customEndDate).toLocaleDateString("fr-FR")}`
      : periodLabels[selectedPeriod];

    const totalCa = treasuryEvolution.reduce((sum, d) => sum + d.ca_jour, 0);
    const lastTreasury = treasuryEvolution[treasuryEvolution.length - 1]?.tresorerie_cumulee || 0;

    const maxCa = Math.max(...treasuryEvolution.map(e => e.ca_jour), 1);
    const minTreasury = Math.min(...treasuryEvolution.map(d => d.tresorerie_cumulee), 0);
    const maxTreasuryAbs = Math.max(...treasuryEvolution.map(d => Math.abs(d.tresorerie_cumulee)), Math.abs(minTreasury), 1);

    const caPoints = treasuryEvolution.map((day, i) => {
      const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 350 + 25;
      const y = 150 - (day.ca_jour / maxCa) * 130;
      return `${x},${y}`;
    }).join(' ');
    const caAreaPoints = `25,150 ${caPoints} 375,150`;

    const treasuryPoints = treasuryEvolution.map((day, i) => {
      const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 350 + 25;
      const y = 100 - (day.tresorerie_cumulee / maxTreasuryAbs) * 80;
      return `${x},${y}`;
    }).join(' ');
    const treasuryAreaPoints = `25,100 ${treasuryPoints} 375,100`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport Comptabilité - ${periodLabel}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
            .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #1e40af; margin-bottom: 20px; }
            .header h1 { font-size: 22px; color: #1e40af; margin-bottom: 5px; }
            .header p { font-size: 14px; color: #666; }
            .section-title { font-size: 14px; font-weight: bold; color: #1e40af; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .stats-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-card { background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .stat-card.blue { border-left: 4px solid #3b82f6; }
            .stat-card.orange { border-left: 4px solid #f97316; }
            .stat-card.green { border-left: 4px solid #22c55e; }
            .stat-card.purple { border-left: 4px solid #a855f7; }
            .stat-card.emerald { border-left: 4px solid #10b981; }
            .stat-card.cyan { border-left: 4px solid #06b6d4; }
            .stat-card.red { border-left: 4px solid #ef4444; }
            .stat-card.amber { border-left: 4px solid #f59e0b; }
            .stat-card.pink { border-left: 4px solid #ec4899; }
            .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .stat-value { font-size: 18px; font-weight: bold; color: #1e293b; }
            .stat-sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
            .graphs-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            .graph-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .graph-title { font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 10px; text-align: center; }
            .graph-container { position: relative; height: 180px; margin-bottom: 10px; }
            .graph-svg { width: 100%; height: 100%; }
            .graph-total { text-align: center; padding-top: 10px; border-top: 1px solid #e2e8f0; }
            .graph-total-value { font-size: 20px; font-weight: bold; }
            .graph-total-value.blue { color: #3b82f6; }
            .graph-total-value.green { color: #22c55e; }
            .graph-total-value.red { color: #ef4444; }
            .graph-total-label { font-size: 11px; color: #64748b; }
            .x-labels { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; margin-top: 5px; padding: 0 25px; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rapport Comptabilité</h1>
            <p>${periodLabel}</p>
          </div>

          <div class="section-title">Indicateurs de Performance</div>
          <div class="stats-grid">
            <div class="stat-card blue">
              <div class="stat-label">Chiffre d'Affaires</div>
              <div class="stat-value">${formatCurrency(profitStats?.chiffreAffaires || 0)}</div>
              <div class="stat-sub">${profitStats?.nbVentes || 0} ventes • ${profitStats?.nbProduitsVendus || 0} produits</div>
            </div>
            <div class="stat-card orange">
              <div class="stat-label">Coût Marchandises</div>
              <div class="stat-value">${formatCurrency(profitStats?.coutMarchandises || 0)}</div>
              <div class="stat-sub">Prix d'achat des produits vendus</div>
            </div>
            <div class="stat-card green">
              <div class="stat-label">Bénéfice Brut</div>
              <div class="stat-value">${formatCurrency(profitStats?.beneficeBrut || 0)}</div>
              <div class="stat-sub">CA - Coût marchandises</div>
            </div>
            <div class="stat-card purple">
              <div class="stat-label">Marge Bénéficiaire</div>
              <div class="stat-value">${(profitStats?.margePercent || 0).toFixed(1)}%</div>
              <div class="stat-sub">Bénéfice / CA × 100</div>
            </div>
          </div>

          <div class="section-title">Mouvements de Trésorerie</div>
          <div class="stats-grid-5">
            <div class="stat-card emerald">
              <div class="stat-label">Flux de Trésorerie</div>
              <div class="stat-value">${formatCurrency(treasury)}</div>
              <div class="stat-sub">Entrées - Sorties</div>
            </div>
            <div class="stat-card cyan">
              <div class="stat-label">Total Entrées</div>
              <div class="stat-value">${formatCurrency(totalEntrees)}</div>
              <div class="stat-sub">Ventes + Paiements</div>
            </div>
            <div class="stat-card red">
              <div class="stat-label">Total Sorties</div>
              <div class="stat-value">${formatCurrency(totalSorties)}</div>
              <div class="stat-sub">Achats + Dépenses</div>
            </div>
            <div class="stat-card amber">
              <div class="stat-label">Dettes Clients</div>
              <div class="stat-value">${formatCurrency(customerDebts)}</div>
              <div class="stat-sub">Créances à recouvrer</div>
            </div>
            <div class="stat-card pink">
              <div class="stat-label">Dettes Fournisseurs</div>
              <div class="stat-value">${formatCurrency(supplierDebts)}</div>
              <div class="stat-sub">Factures à payer</div>
            </div>
          </div>

          <div class="graphs-section">
            <div class="graph-card">
              <div class="graph-title">Évolution du Chiffre d'Affaires</div>
              <div class="graph-container">
                <svg class="graph-svg" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
                      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05"/>
                    </linearGradient>
                  </defs>
                  <line x1="25" y1="150" x2="375" y2="150" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                  <polygon points="${caAreaPoints}" fill="url(#caGradient)"/>
                  <polyline points="${caPoints}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  ${treasuryEvolution.map((day, i) => {
                    const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 350 + 25;
                    const y = 150 - (day.ca_jour / maxCa) * 130;
                    return `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6"/>`;
                  }).join('')}
                </svg>
              </div>
              <div class="x-labels">
                <span>${new Date(treasuryEvolution[0]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                ${treasuryEvolution.length > 2 ? `<span>${new Date(treasuryEvolution[Math.floor(treasuryEvolution.length / 2)]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>` : ''}
                <span>${new Date(treasuryEvolution[treasuryEvolution.length - 1]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
              </div>
              <div class="graph-total">
                <div class="graph-total-value blue">${formatCurrency(totalCa)}</div>
                <div class="graph-total-label">Total CA</div>
              </div>
            </div>
            <div class="graph-card">
              <div class="graph-title">Évolution de la Trésorerie</div>
              <div class="graph-container">
                <svg class="graph-svg" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
                      <stop offset="100%" stop-color="#10b981" stop-opacity="0.05"/>
                    </linearGradient>
                  </defs>
                  <line x1="25" y1="100" x2="375" y2="100" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4"/>
                  <polygon points="${treasuryAreaPoints}" fill="${lastTreasury >= 0 ? 'url(#treasuryGradient)' : 'rgba(239, 68, 68, 0.15)'}"/>
                  <polyline points="${treasuryPoints}" fill="none" stroke="${lastTreasury >= 0 ? '#10b981' : '#ef4444'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  ${treasuryEvolution.map((day, i) => {
                    const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 350 + 25;
                    const y = 100 - (day.tresorerie_cumulee / maxTreasuryAbs) * 80;
                    return `<circle cx="${x}" cy="${y}" r="3" fill="${day.tresorerie_cumulee >= 0 ? '#10b981' : '#ef4444'}"/>`;
                  }).join('')}
                </svg>
              </div>
              <div class="x-labels">
                <span>${new Date(treasuryEvolution[0]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                ${treasuryEvolution.length > 2 ? `<span>${new Date(treasuryEvolution[Math.floor(treasuryEvolution.length / 2)]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>` : ''}
                <span>${new Date(treasuryEvolution[treasuryEvolution.length - 1]?.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
              </div>
              <div class="graph-total">
                <div class="graph-total-value ${lastTreasury >= 0 ? 'green' : 'red'}">${formatCurrency(lastTreasury)}</div>
                <div class="graph-total-label">Trésorerie Actuelle</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const maxCa = Math.max(...treasuryEvolution.map(e => e.ca_jour), 1);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Comptabilité</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {selectedPeriod === "custom" && customStartDate && customEndDate
              ? `Du ${new Date(customStartDate).toLocaleDateString("fr-FR")} au ${new Date(customEndDate).toLocaleDateString("fr-FR")}`
              : periodLabels[selectedPeriod]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintStats}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-2" />
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodType)}
              className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer pr-8"
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {showCustomDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <span className="text-gray-500 dark:text-gray-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.chiffreAffaires || 0)}</p>
              <p className="text-blue-200 text-xs mt-1">{profitStats?.nbVentes || 0} ventes • {profitStats?.nbProduitsVendus || 0} produits</p>
            </div>
            <ShoppingCart className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Coût Marchandises</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.coutMarchandises || 0)}</p>
              <p className="text-orange-200 text-xs mt-1">Prix d'achat des produits vendus</p>
            </div>
            <Package className="w-10 h-10 text-orange-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Bénéfice Brut</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(profitStats?.beneficeBrut || 0)}</p>
              <p className="text-green-200 text-xs mt-1">CA - Coût marchandises</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Marge Bénéficiaire</p>
              <p className="text-2xl font-bold mt-1">{(profitStats?.margePercent || 0).toFixed(1)}%</p>
              <p className="text-purple-200 text-xs mt-1">Bénéfice / CA × 100</p>
            </div>
            <Percent className="w-10 h-10 text-purple-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Flux de Trésorerie</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(treasury)}</p>
              <p className="text-emerald-200 text-xs mt-1">Entrées - Sorties (période)</p>
            </div>
            <DollarSign className="w-10 h-10 text-emerald-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm">Total Entrées</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalEntrees)}</p>
              <p className="text-cyan-200 text-xs mt-1">Ventes + Paiements clients</p>
            </div>
            <TrendingUp className="w-10 h-10 text-cyan-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Sorties</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalSorties)}</p>
              <p className="text-red-200 text-xs mt-1">Achats + Paiements fournisseurs</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">Dettes Clients</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(customerDebts)}</p>
              <p className="text-amber-200 text-xs mt-1">Créées dans la période</p>
            </div>
            <Users className="w-10 h-10 text-amber-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-100 text-sm">Dettes Fournisseurs</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(supplierDebts)}</p>
              <p className="text-rose-200 text-xs mt-1">Créées dans la période</p>
            </div>
            <UserCheck className="w-10 h-10 text-rose-200" />
          </div>
        </div>
      </div>

      {treasuryEvolution.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-6 pt-6">
              Évolution du Chiffre d'Affaires
            </h3>
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-1 bg-blue-500 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">CA Journalier</span>
              </div>
              <div className="relative h-64">
                <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  {(() => {
                    const points = treasuryEvolution.map((day, i) => {
                      const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 380 + 10;
                      const y = 190 - (day.ca_jour / maxCa) * 170;
                      return `${x},${y}`;
                    }).join(' ');
                    const areaPoints = `10,190 ${points} 390,190`;
                    return (
                      <>
                        <polygon points={areaPoints} fill="url(#caGradient)" />
                        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        {treasuryEvolution.map((day, i) => {
                          const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 380 + 10;
                          const y = 190 - (day.ca_jour / maxCa) * 170;
                          return (
                            <g key={day.date}>
                              <circle cx={x} cy={y} r="4" fill="#3b82f6"/>
                              <title>{`${new Date(day.date).toLocaleDateString('fr-FR')}: ${formatCurrency(day.ca_jour)}`}</title>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400 px-2">
                  {treasuryEvolution.length <= 7 ? treasuryEvolution.map((day) => (
                    <span key={day.date}>{new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  )) : (
                    <>
                      <span>{new Date(treasuryEvolution[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                      <span>{new Date(treasuryEvolution[Math.floor(treasuryEvolution.length / 2)].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                      <span>{new Date(treasuryEvolution[treasuryEvolution.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(treasuryEvolution.reduce((sum, d) => sum + d.ca_jour, 0))}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">Total CA</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-6 pt-6">
              Évolution de la Trésorerie
            </h3>
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-1 bg-emerald-500 rounded"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Trésorerie Cumulée</span>
              </div>
              <div className="relative h-64">
                <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="treasuryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  <line x1="10" y1="100" x2="390" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4"/>
                  {(() => {
                    const minTreasury = Math.min(...treasuryEvolution.map(d => d.tresorerie_cumulee), 0);
                    const maxTreasuryAbs = Math.max(...treasuryEvolution.map(d => Math.abs(d.tresorerie_cumulee)), Math.abs(minTreasury), 1);
                    const points = treasuryEvolution.map((day, i) => {
                      const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 380 + 10;
                      const y = 100 - (day.tresorerie_cumulee / maxTreasuryAbs) * 80;
                      return `${x},${y}`;
                    }).join(' ');
                    const areaPoints = `10,100 ${points} 390,100`;
                    const lastTreasury = treasuryEvolution[treasuryEvolution.length - 1].tresorerie_cumulee;
                    const lineColor = lastTreasury >= 0 ? '#10b981' : '#ef4444';
                    return (
                      <>
                        <polygon points={areaPoints} fill={lastTreasury >= 0 ? "url(#treasuryGradient)" : "rgba(239, 68, 68, 0.15)"} />
                        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        {treasuryEvolution.map((day, i) => {
                          const x = (i / Math.max(treasuryEvolution.length - 1, 1)) * 380 + 10;
                          const y = 100 - (day.tresorerie_cumulee / maxTreasuryAbs) * 80;
                          return (
                            <g key={day.date}>
                              <circle cx={x} cy={y} r="4" fill={day.tresorerie_cumulee >= 0 ? '#10b981' : '#ef4444'}/>
                              <title>{`${new Date(day.date).toLocaleDateString('fr-FR')}: ${formatCurrency(day.tresorerie_cumulee)}`}</title>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400 px-2">
                  {treasuryEvolution.length <= 7 ? treasuryEvolution.map((day) => (
                    <span key={day.date}>{new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  )) : (
                    <>
                      <span>{new Date(treasuryEvolution[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                      <span>{new Date(treasuryEvolution[Math.floor(treasuryEvolution.length / 2)].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                      <span>{new Date(treasuryEvolution[treasuryEvolution.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className={`text-2xl font-bold ${treasuryEvolution[treasuryEvolution.length - 1].tresorerie_cumulee >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(treasuryEvolution[treasuryEvolution.length - 1].tresorerie_cumulee)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">Trésorerie actuelle</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-6 pt-6">
          Journal des mouvements
          {loading && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">Chargement...</span>}
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Méthode
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(entry.created_at!).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.type_mouvement === 'entree'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {getTypeLabel(entry.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {entry.methode_paiement || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                    <span className={entry.type_mouvement === 'entree' ? 'text-green-600' : 'text-red-600'}>
                      {entry.type_mouvement === 'entree' ? '+' : '-'} {formatCurrency(entry.montant)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemsPerPageOptions={[20, 50, 100]}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>

      {caissesHistory.length > 0 && (
        <div className="card overflow-hidden">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 px-6 pt-6">
            Historique des ouvertures/fermetures de caisse
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Ouverture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Fonds de roulement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Vendeur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Fermeture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Total Ventes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {caissesHistory.map((caisse) => (
                  <tr key={caisse.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(caisse.date_ouverture).toLocaleDateString('fr-FR')} à {caisse.heure_ouverture}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(caisse.fonds_roulement)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {caisse.vendeur_nom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {caisse.date_fermeture ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {new Date(caisse.date_fermeture).toLocaleDateString('fr-FR')} à {caisse.heure_fermeture}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {caisse.total_ventes !== null ? formatCurrency(caisse.total_ventes) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        caisse.statut === 'ouverte'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {caisse.statut === 'ouverte' ? 'Ouverte' : 'Fermée'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
