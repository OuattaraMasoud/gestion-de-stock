import { contextBridge, ipcRenderer } from "electron";

// Exposer les API au renderer process de manière sécurisée
contextBridge.exposeInMainWorld("electronAPI", {
  // Produits
  getProducts: () => ipcRenderer.invoke("get-products"),
  getProduct: (id: number) => ipcRenderer.invoke("get-product", id),
  createProduct: (product: any) =>
    ipcRenderer.invoke("create-product", product),
  updateProduct: (id: number, product: any) =>
    ipcRenderer.invoke("update-product", id, product),
  deleteProduct: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-product", id, utilisateur_id, utilisateur_nom),
  searchProducts: (query: string) =>
    ipcRenderer.invoke("search-products", query),
  searchProductsFTS: (query: string, limit?: number) =>
    ipcRenderer.invoke("search-products-fts", query, limit),
  saveProductImage: (base64Data: string) =>
    ipcRenderer.invoke("save-product-image", base64Data),
  getProductImage: (filename: string) =>
    ipcRenderer.invoke("get-product-image", filename),
  saveCompanyLogo: (base64Data: string) =>
    ipcRenderer.invoke("save-company-logo", base64Data),
  getCompanyLogo: () => ipcRenderer.invoke("get-company-logo"),
  deleteCompanyLogo: () => ipcRenderer.invoke("delete-company-logo"),

  // Catégories
  getCategories: () => ipcRenderer.invoke("get-categories"),
  createCategory: (category: any) =>
    ipcRenderer.invoke("create-category", category),
  updateCategory: (id: number, category: any) =>
    ipcRenderer.invoke("update-category", id, category),
  deleteCategory: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-category", id, utilisateur_id, utilisateur_nom),

  // Ventes
  getSales: () => ipcRenderer.invoke("get-sales"),
  createSale: (sale: any) => ipcRenderer.invoke("create-sale", sale),
  getSalesByDate: (startDate: string, endDate: string) =>
    ipcRenderer.invoke("get-sales-by-date", startDate, endDate),
  deleteSale: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-sale", id, utilisateur_id, utilisateur_nom),

  // Statistiques
  getDashboardStats: () => ipcRenderer.invoke("get-dashboard-stats"),
  getDashboardStatsByDate: (startDate: string, endDate: string) =>
    ipcRenderer.invoke("get-dashboard-stats-by-date", startDate, endDate),
  getLowStockProducts: () => ipcRenderer.invoke("get-low-stock-products"),

  // Utilisateurs
  login: (email: string, password: string) =>
    ipcRenderer.invoke("login", email, password),
  getUsers: () => ipcRenderer.invoke("get-users"),
  createUser: (user: any) => ipcRenderer.invoke("create-user", user),
  updateUser: (id: number, user: any) =>
    ipcRenderer.invoke("update-user", id, user),
  deleteUser: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-user", id, utilisateur_id, utilisateur_nom),

  // Fournisseurs
  getSuppliers: () => ipcRenderer.invoke("get-suppliers"),
  getSupplier: (id: number) => ipcRenderer.invoke("get-supplier", id),
  createSupplier: (supplier: any) =>
    ipcRenderer.invoke("create-supplier", supplier),
  updateSupplier: (id: number, supplier: any) =>
    ipcRenderer.invoke("update-supplier", id, supplier),
  deleteSupplier: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-supplier", id, utilisateur_id, utilisateur_nom),

  // Achats
  getPurchases: () => ipcRenderer.invoke("get-purchases"),
  createPurchase: (purchase: any) =>
    ipcRenderer.invoke("create-purchase", purchase),
  getPurchasesBySupplier: (supplierId: number) =>
    ipcRenderer.invoke("get-purchases-by-supplier", supplierId),
  getPurchase: (id: number) => ipcRenderer.invoke("get-purchase", id),

  // Dettes Fournisseurs
  getSupplierDebts: () => ipcRenderer.invoke("get-supplier-debts"),
  getSupplierUnpaidPurchases: (supplierId: number) =>
    ipcRenderer.invoke("get-supplier-unpaid-purchases", supplierId),
  deletePurchase: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-purchase", id, utilisateur_id, utilisateur_nom),

  // Paiements Fournisseurs
  getSupplierPayments: (purchaseId: number) =>
    ipcRenderer.invoke("get-supplier-payments", purchaseId),
  createSupplierPayment: (payment: any) =>
    ipcRenderer.invoke("create-supplier-payment", payment),

  // Clients
  getClients: () => ipcRenderer.invoke("get-clients"),
  getClient: (id: number) => ipcRenderer.invoke("get-client", id),
  createClient: (client: any) => ipcRenderer.invoke("create-client", client),
  updateClient: (id: number, client: any) =>
    ipcRenderer.invoke("update-client", id, client),
  deleteClient: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => ipcRenderer.invoke("delete-client", id, utilisateur_id, utilisateur_nom),

  // Prix Clients
  getClientPrices: (clientId: number) =>
    ipcRenderer.invoke("get-client-prices", clientId),
  getClientPrice: (clientId: number, productId: number) =>
    ipcRenderer.invoke("get-client-price", clientId, productId),
  createClientPrice: (clientPrice: any) =>
    ipcRenderer.invoke("create-client-price", clientPrice),
  updateClientPrice: (id: number, clientPrice: any) =>
    ipcRenderer.invoke("update-client-price", id, clientPrice),
  deleteClientPrice: (id: number) =>
    ipcRenderer.invoke("delete-client-price", id),
  bulkCreateClientPrices: (clientId: number, prices: any[]) =>
    ipcRenderer.invoke("bulk-create-client-prices", clientId, prices),

  // Serveurs
  getServers: () => ipcRenderer.invoke("get-servers"),
  getServer: (id: number) => ipcRenderer.invoke("get-server", id),
  getActiveServers: () => ipcRenderer.invoke("get-active-servers"),
  createServer: (server: any) => ipcRenderer.invoke("create-server", server),
  updateServer: (id: number, server: any) =>
    ipcRenderer.invoke("update-server", id, server),
  deleteServer: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => ipcRenderer.invoke("delete-server", id, utilisateur_id, utilisateur_nom),

  // Dettes Clients
  getCustomerDebts: () => ipcRenderer.invoke("get-customer-debts"),
  getCustomerUnpaidSales: (clientId: number) =>
    ipcRenderer.invoke("get-customer-unpaid-sales", clientId),

  // Paiements Clients
  getCustomerPayments: (saleId: number) =>
    ipcRenderer.invoke("get-customer-payments", saleId),
  createCustomerPayment: (payment: any) =>
    ipcRenderer.invoke("create-customer-payment", payment),

  // Comptabilité
  getAccountingEntries: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-accounting-entries", startDate, endDate),
  getAccountingEntriesPaginated: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ) =>
    ipcRenderer.invoke(
      "get-accounting-entries-paginated",
      page,
      limit,
      startDate,
      endDate,
    ),
  getTreasury: () => ipcRenderer.invoke("get-treasury"),
  getProfitStats: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-profit-stats", startDate, endDate),

  // Dépenses
  getExpenses: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-expenses", startDate, endDate),
  getExpensesPaginated: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    categorie?: string,
  ) =>
    ipcRenderer.invoke(
      "get-expenses-paginated",
      page,
      limit,
      startDate,
      endDate,
      categorie,
    ),
  createExpense: (expense: any) =>
    ipcRenderer.invoke("create-expense", expense),
  updateExpense: (id: number, expense: any) =>
    ipcRenderer.invoke("update-expense", id, expense),
  deleteExpense: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-expense", id, utilisateur_id, utilisateur_nom),
  getExpenseStats: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-expense-stats", startDate, endDate),

  // Top Produits et Clients
  getTopProducts: (limit?: number, startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-top-products", limit, startDate, endDate),
  getTopClients: (limit?: number, startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-top-clients", limit, startDate, endDate),

  // Factures
  createInvoice: (invoice: any) =>
    ipcRenderer.invoke("create-invoice", invoice),
  getInvoices: () => ipcRenderer.invoke("get-invoices"),
  getInvoice: (id: number) => ipcRenderer.invoke("get-invoice", id),
  getInvoiceByVenteId: (venteId: number) =>
    ipcRenderer.invoke("get-invoice-by-vente-id", venteId),
  getInvoiceByNumero: (numero: string) =>
    ipcRenderer.invoke("get-invoice-by-numero", numero),
  getInvoicesByDate: (startDate: string, endDate: string) =>
    ipcRenderer.invoke("get-invoices-by-date", startDate, endDate),
  updateInvoice: (id: number, invoice: any) =>
    ipcRenderer.invoke("update-invoice", id, invoice),
  deleteInvoice: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke("delete-invoice", id, utilisateur_id, utilisateur_nom),

  // Configuration
  getConfiguration: () => ipcRenderer.invoke("get-configuration"),
  updateConfiguration: (config: any) =>
    ipcRenderer.invoke("update-configuration", config),
  updateSale: (
    id: number,
    sale: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "update-sale",
      id,
      sale,
      utilisateur_id,
      utilisateur_nom,
    ),
  canModifySale: (venteId: number) =>
    ipcRenderer.invoke("can-modify-sale", venteId),

  // Factures Proforma
  createProformaInvoice: (
    proforma: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "create-proforma-invoice",
      proforma,
      utilisateur_id,
      utilisateur_nom,
    ),
  getProformaInvoices: () => ipcRenderer.invoke("get-proforma-invoices"),
  getProformaInvoice: (id: number) =>
    ipcRenderer.invoke("get-proforma-invoice", id),
  updateProformaInvoice: (
    id: number,
    proforma: any,
    usuario_id?: number,
    usuario_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "update-proforma-invoice",
      id,
      proforma,
      usuario_id,
      usuario_nom,
    ),
  updateProformaStatus: (
    id: number,
    statut: string,
    vente_id?: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "update-proforma-status",
      id,
      statut,
      vente_id,
      utilisateur_id,
      utilisateur_nom,
    ),
  deleteProformaInvoice: (
    id: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "delete-proforma-invoice",
      id,
      utilisateur_id,
      utilisateur_nom,
    ),
  getProformaInvoicesPaginated: (
    page: number,
    limit: number,
    search?: string,
    statut?: string,
  ) =>
    ipcRenderer.invoke(
      "get-proforma-invoices-paginated",
      page,
      limit,
      search,
      statut,
    ),

  // // Firebase Sync
  // firebaseConfigInit: (config: any) => ipcRenderer.invoke('firebase-config-init', config),
  // firebaseConfigGet: () => ipcRenderer.invoke('firebase-config-get'),
  // firebaseSyncManual: () => ipcRenderer.invoke('firebase-sync-manual'),
  // firebaseSyncStatus: () => ipcRenderer.invoke('firebase-sync-status'),
  checkInternet: () => ipcRenderer.invoke("check-internet"),

  // Licence
  validateLicense: () => ipcRenderer.invoke("license-validate"),
  activateLicense: (licenseKey: string) =>
    ipcRenderer.invoke("license-activate", licenseKey),
  deactivateLicense: () => ipcRenderer.invoke("license-deactivate"),
  getLicenseInfo: () => ipcRenderer.invoke("license-get-info"),
  getMachineId: () => ipcRenderer.invoke("license-get-machine-id"),

  // Audit Logs
  getAuditLogs: (limit: number = 100) =>
    ipcRenderer.invoke("get-audit-logs", limit),
  getAuditLogsByDate: (startDate: string, endDate: string) =>
    ipcRenderer.invoke("get-audit-logs-by-date", startDate, endDate),
  getAuditLogsByTable: (table: string, limit: number = 100) =>
    ipcRenderer.invoke("get-audit-logs-by-table", table, limit),
  createAuditLog: (log: any) => ipcRenderer.invoke("create-audit-log", log),

  // Backup & Restauration
  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  restoreDatabase: (backupPath: string) =>
    ipcRenderer.invoke("restore-database", backupPath),
  getBackups: () => ipcRenderer.invoke("get-backups"),
  deleteBackup: (filename: string) =>
    ipcRenderer.invoke("delete-backup", filename),
  relaunchApp: () => ipcRenderer.invoke("relaunch-app"),

  // Inventaire
  getInventoryData: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    search?: string,
    categorieId?: number,
  ) =>
    ipcRenderer.invoke(
      "get-inventory-data",
      page,
      limit,
      startDate,
      endDate,
      search,
      categorieId,
    ),

  // Server-Side Pagination
  getProductsPaginated: (page: number, limit: number, search?: string, categorieId?: number, status?: string) =>
    ipcRenderer.invoke("get-products-paginated", page, limit, search, categorieId, status),
  getInvoicesPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-invoices-paginated", page, limit, search),
  getSalesPaginated: (
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ) =>
    ipcRenderer.invoke("get-sales-paginated", page, limit, startDate, endDate),
  getClientsPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-clients-paginated", page, limit, search),
  getUsersPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-users-paginated", page, limit, search),
  getAuditLogsPaginated: (
    page: number,
    limit: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      table?: string;
      search?: string;
    },
  ) => ipcRenderer.invoke("get-audit-logs-paginated", page, limit, filters),
  getSuppliersPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-suppliers-paginated", page, limit, search),
  getPurchasesPaginated: (page: number, limit: number) =>
    ipcRenderer.invoke("get-purchases-paginated", page, limit),
  getServersPaginated: (page: number, limit: number) =>
    ipcRenderer.invoke("get-servers-paginated", page, limit),

  // Purge & Stats
  purgeOldData: (config?: any) => ipcRenderer.invoke("purge-old-data", config),
  getDatabaseStats: () => ipcRenderer.invoke("get-database-stats"),
  repairDatabase: () => ipcRenderer.invoke("repair-database"),
  clearAllData: (
    options?: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) =>
    ipcRenderer.invoke(
      "clear-all-data",
      options,
      utilisateur_id,
      utilisateur_nom,
    ),
  importProductsCSV: (csvContent: string) =>
    ipcRenderer.invoke("import-products-csv", csvContent),

  // App Info
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),

  // Caisse (ouverture/fermeture)
  getOpenCaisse: () => ipcRenderer.invoke("get-open-caisse"),
  openCaisse: (caisse: any) => ipcRenderer.invoke("open-caisse", caisse),
  closeCaisse: (caisseId: number, data: any) => ipcRenderer.invoke("close-caisse", caisseId, data),
  getCaisses: (page: number, limit: number) => ipcRenderer.invoke("get-caisses", page, limit),
  getCaisseStats: (caisseId: number) => ipcRenderer.invoke("get-caisse-stats", caisseId),

  // Livraisons
  getLivraisons: (page: number, limit: number, statut?: string) =>
    ipcRenderer.invoke("get-livraisons", page, limit, statut),
  createLivraison: (livraison: any) => ipcRenderer.invoke("create-livraison", livraison),
  updateLivraison: (id: number, livraison: any) => ipcRenderer.invoke("update-livraison", id, livraison),
  markAsDelivered: (venteId: number) => ipcRenderer.invoke("mark-as-delivered", venteId),

  // Statistiques Client
  getClientStats: (clientId: number, startDate?: string, endDate?: string) => ipcRenderer.invoke("get-client-stats", clientId, startDate, endDate),
  getVenteDetails: (venteId: number) => ipcRenderer.invoke("get-vente-details", venteId),

  // Verrou automatique des factures
  lockOldInvoices: () => ipcRenderer.invoke("lock-old-invoices"),
});
