// Types pour la licence
export interface LicenseInfo {
  licenseKey: string;
  machineId: string;
  boutiqueId: string;
  type: "trial" | "perpetual" | "subscription";
  expiresAt: string | null;
  features: string[];
  customerName: string;
  accessToken: string;
  refreshToken: string;
  lastValidated: string;
  activatedAt: string;
}

export interface LicenseStatus {
  isValid: boolean;
  isActivated: boolean;
  isOnline: boolean;
  isGracePeriod: boolean;
  daysRemaining?: number;
  graceDaysRemaining?: number;
  error?: string;
  errorCode?: string;
  license?: LicenseInfo;
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  license?: LicenseInfo;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStatsByDate {
  ventesPeriode: number;
  ventesPeriodePrecedente: number;
  nbVentesPeriode: number;
  profitPeriode: number;
  profitPeriodePrecedente: number;
  coutsPeriode: number;
  coutsPeriodePrecedente: number;
  totalProduits: number;
  stockFaible: number;
  valeurStock: number;
  nbFournisseurs: number;
  nbClients: number;
  dateDebut: string;
  dateFin: string;
}

export interface ProfitStats {
  chiffreAffaires: number;
  coutMarchandises: number;
  beneficeBrut: number;
  margePercent: number;
  nbVentes: number;
  nbProduitsVendus: number;
  totalAchats: number;
}

export interface ElectronAPI {
  // Produits
  getProducts: () => Promise<any[]>;
  getProduct: (id: number) => Promise<any>;
  createProduct: (product: any) => Promise<any>;
  updateProduct: (id: number, product: any) => Promise<any>;
  deleteProduct: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;
  searchProducts: (query: string) => Promise<any[]>;
  searchProductsFTS: (query: string, limit?: number) => Promise<any[]>;
  saveProductImage: (base64Data: string) => Promise<string>;
  getProductImage: (filename: string) => Promise<string | null>;
  saveCompanyLogo: (base64Data: string) => Promise<string>;
  getCompanyLogo: () => Promise<string | null>;
  deleteCompanyLogo: () => Promise<void>;

  // Catégories
  getCategories: () => Promise<any[]>;
  createCategory: (category: any) => Promise<any>;
  updateCategory: (id: number, category: any) => Promise<any>;
  deleteCategory: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Ventes
  getSales: () => Promise<any[]>;
  createSale: (sale: any) => Promise<any>;
  getSalesByDate: (startDate: string, endDate: string) => Promise<any[]>;
  deleteSale: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Statistiques
  getDashboardStats: () => Promise<any>;
  getDashboardStatsByDate: (
    startDate: string,
    endDate: string,
  ) => Promise<DashboardStatsByDate>;
  getLowStockProducts: () => Promise<any[]>;

  // Utilisateurs
  login: (email: string, password: string) => Promise<any>;
  getUsers: () => Promise<any[]>;
  createUser: (user: any) => Promise<any>;
  updateUser: (id: number, user: any) => Promise<any>;
  deleteUser: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Fournisseurs
  getSuppliers: () => Promise<any[]>;
  getSupplier: (id: number) => Promise<any>;
  createSupplier: (supplier: any) => Promise<any>;
  updateSupplier: (id: number, supplier: any) => Promise<any>;
  deleteSupplier: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Achats
  getPurchases: () => Promise<any[]>;
  createPurchase: (purchase: any) => Promise<any>;
  getPurchasesBySupplier: (supplierId: number) => Promise<any[]>;
  getPurchase: (id: number) => Promise<any>;
  deletePurchase: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Dettes Fournisseurs
  getSupplierDebts: () => Promise<any[]>;
  getSupplierUnpaidPurchases: (supplierId: number) => Promise<any[]>;

  // Paiements Fournisseurs
  getSupplierPayments: (purchaseId: number) => Promise<any[]>;
  createSupplierPayment: (payment: any) => Promise<any>;

  // Clients
  getClients: () => Promise<any[]>;
  getClient: (id: number) => Promise<any>;
  createClient: (client: any) => Promise<any>;
  updateClient: (id: number, client: any) => Promise<any>;
  deleteClient: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Prix Clients
  getClientPrices: (clientId: number) => Promise<any[]>;
  getClientPrice: (clientId: number, productId: number) => Promise<any>;
  createClientPrice: (clientPrice: any) => Promise<any>;
  updateClientPrice: (id: number, clientPrice: any) => Promise<any>;
  deleteClientPrice: (id: number) => Promise<boolean>;
  bulkCreateClientPrices: (clientId: number, prices: any[]) => Promise<any>;

  // Serveurs
  getServers: () => Promise<any[]>;
  getServer: (id: number) => Promise<any>;
  getActiveServers: () => Promise<any[]>;
  createServer: (server: any) => Promise<any>;
  updateServer: (id: number, server: any) => Promise<any>;
  deleteServer: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Dettes Clients
  getCustomerDebts: () => Promise<any[]>;
  getCustomerUnpaidSales: (clientId: number) => Promise<any[]>;

  // Paiements Clients
  getCustomerPayments: (saleId: number) => Promise<any[]>;
  createCustomerPayment: (payment: any) => Promise<any>;

  // Comptabilité
  getAccountingEntries: (
    startDate?: string,
    endDate?: string,
  ) => Promise<any[]>;
  getTreasury: () => Promise<any>;
  getProfitStats: (
    startDate?: string,
    endDate?: string,
  ) => Promise<ProfitStats>;

  // Factures
  createInvoice: (invoice: any) => Promise<any>;
  getInvoices: () => Promise<any[]>;
  getInvoice: (id: number) => Promise<any>;
  getInvoiceByVenteId: (venteId: number) => Promise<any>;
  getInvoiceByNumero: (numero: string) => Promise<any>;
  getInvoicesByDate: (startDate: string, endDate: string) => Promise<any[]>;
  updateInvoice: (id: number, invoice: any) => Promise<any>;
  deleteInvoice: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<boolean>;

  // Configuration
  getConfiguration: () => Promise<any>;
  updateConfiguration: (config: any) => Promise<any>;
  updateSale: (
    id: number,
    sale: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<any>;
  canModifySale: (
    venteId: number,
  ) => Promise<{ canModify: boolean; reason?: string }>;

  // Factures Proforma
  createProformaInvoice: (
    proforma: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<any>;
  getProformaInvoices: () => Promise<any[]>;
  getProformaInvoice: (id: number) => Promise<any>;
  updateProformaInvoice: (
    id: number,
    proforma: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<any>;
  updateProformaStatus: (
    id: number,
    statut: string,
    vente_id?: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<any>;
  deleteProformaInvoice: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<any>;
  getProformaInvoicesPaginated: (
    page: number,
    limit: number,
    search?: string,
    statut?: string,
  ) => Promise<PaginatedResponse<any>>;

  // Firebase
  firebaseConfigInit: (config: any) => Promise<{ success: boolean }>;
  firebaseConfigGet: () => Promise<any>;
  firebaseSyncManual: () => Promise<any>;
  firebaseSyncStatus: () => Promise<any>;
  checkInternet: () => Promise<boolean>;

  // Inventaire
  getInventoryData: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    search?: string,
    categorieId?: number,
  ) => Promise<
    PaginatedResponse<any> & {
      stats: {
        valeur_stock_achat: number;
        valeur_stock_vente: number;
        produits_rupture: number;
        produits_stock_bas: number;
      };
    }
  >;

  // Server-Side Pagination
  getProductsPaginated: (
    page: number,
    limit: number,
    search?: string,
    categorieId?: number,
    status?: string,
  ) => Promise<PaginatedResponse<any>>;
  getInvoicesPaginated: (
    page: number,
    limit: number,
    search?: string,
  ) => Promise<PaginatedResponse<any>>;
  getSalesPaginated: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ) => Promise<PaginatedResponse<any>>;
  getClientsPaginated: (
    page: number,
    limit: number,
    search?: string,
  ) => Promise<PaginatedResponse<any>>;
  getUsersPaginated: (
    page: number,
    limit: number,
    search?: string,
  ) => Promise<PaginatedResponse<any>>;
  getAuditLogsPaginated: (
    page: number,
    limit: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      table?: string;
      search?: string;
    },
  ) => Promise<PaginatedResponse<any>>;
  getSuppliersPaginated: (
    page: number,
    limit: number,
    search?: string,
  ) => Promise<PaginatedResponse<any>>;
  getPurchasesPaginated: (
    page: number,
    limit: number,
  ) => Promise<PaginatedResponse<any>>;
  getServersPaginated: (
    page: number,
    limit: number,
  ) => Promise<PaginatedResponse<any>>;

  // Licence
  validateLicense: () => Promise<LicenseStatus>;
  activateLicense: (licenseKey: string) => Promise<ActivationResult>;
  deactivateLicense: () => Promise<{ success: boolean; error?: string }>;
  getLicenseInfo: () => Promise<LicenseInfo | null>;
  getMachineId: () => Promise<string>;

  // Audit Logs
  getAuditLogs: (limit?: number) => Promise<any[]>;
  getAuditLogsByDate: (startDate: string, endDate: string) => Promise<any[]>;
  getAuditLogsByTable: (table: string, limit?: number) => Promise<any[]>;
  createAuditLog: (log: any) => Promise<any>;

  // Backup & Restauration
  backupDatabase: () => Promise<any>;
  restoreDatabase: (backupPath: string) => Promise<any>;
  getBackups: () => Promise<any[]>;
  deleteBackup: (filename: string) => Promise<boolean>;
  relaunchApp: () => Promise<void>;

  // Purge & Stats
  purgeOldData: (config?: any) => Promise<any>;
  getDatabaseStats: () => Promise<any>;
  repairDatabase: () => Promise<any>;
  clearAllData: (
    options?: {
      produits?: boolean;
      ventes?: boolean;
      factures?: boolean;
      proforma?: boolean;
    },
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => Promise<{ success: boolean; message: string; stats: any }>;
  importProductsCSV: (csvContent: string) => Promise<{
    success: boolean;
    message: string;
    stats: {
      categoriesCreated: number;
      productsCreated: number;
      productsUpdated: number;
      productsSkipped: number;
    };
  }>;

  // App Info
  getAppInfo: () => Promise<{
    version: string;
    buildNumber: string;
    buildDate: string;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
