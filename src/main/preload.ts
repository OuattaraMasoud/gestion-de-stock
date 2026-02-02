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
  deleteProduct: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-product", id, utilisateur_id, utilisateur_nom),
  searchProducts: (query: string) =>
    ipcRenderer.invoke("search-products", query),
  searchProductsFTS: (query: string, limit?: number) =>
    ipcRenderer.invoke("search-products-fts", query, limit),
  saveProductImage: (base64Data: string) =>
    ipcRenderer.invoke("save-product-image", base64Data),
  getProductImage: (filename: string) =>
    ipcRenderer.invoke("get-product-image", filename),

  // Catégories
  getCategories: () => ipcRenderer.invoke("get-categories"),
  createCategory: (category: any) =>
    ipcRenderer.invoke("create-category", category),
  updateCategory: (id: number, category: any) =>
    ipcRenderer.invoke("update-category", id, category),
  deleteCategory: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
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
  deleteSupplier: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
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
  deletePurchase: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
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
  deleteClient: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-client", id, utilisateur_id, utilisateur_nom),

  // Serveurs
  getServers: () => ipcRenderer.invoke("get-servers"),
  getServer: (id: number) => ipcRenderer.invoke("get-server", id),
  getActiveServers: () => ipcRenderer.invoke("get-active-servers"),
  createServer: (server: any) => ipcRenderer.invoke("create-server", server),
  updateServer: (id: number, server: any) =>
    ipcRenderer.invoke("update-server", id, server),
  deleteServer: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-server", id, utilisateur_id, utilisateur_nom),

  // Paiements Clients
  getCustomerPayments: (saleId: number) =>
    ipcRenderer.invoke("get-customer-payments", saleId),
  createCustomerPayment: (payment: any) =>
    ipcRenderer.invoke("create-customer-payment", payment),

  // Comptabilité
  getAccountingEntries: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-accounting-entries", startDate, endDate),
  getAccountingEntriesPaginated: (page: number, limit: number, startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-accounting-entries-paginated", page, limit, startDate, endDate),
  getTreasury: () => ipcRenderer.invoke("get-treasury"),

  // Factures
  createInvoice: (invoice: any) => ipcRenderer.invoke("create-invoice", invoice),
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
  deleteInvoice: (id: number, utilisateur_id?: number, utilisateur_nom?: string) =>
    ipcRenderer.invoke("delete-invoice", id, utilisateur_id, utilisateur_nom),

  // Configuration
  getConfiguration: () => ipcRenderer.invoke("get-configuration"),
  updateConfiguration: (config: any) =>
    ipcRenderer.invoke("update-configuration", config),
  updateSale: (id: number, sale: any) =>
    ipcRenderer.invoke("update-sale", id, sale),

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
  restoreDatabase: (backupPath: string) => ipcRenderer.invoke("restore-database", backupPath),
  getBackups: () => ipcRenderer.invoke("get-backups"),
  deleteBackup: (filename: string) => ipcRenderer.invoke("delete-backup", filename),
  relaunchApp: () => ipcRenderer.invoke("relaunch-app"),

  // Server-Side Pagination
  getProductsPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-products-paginated", page, limit, search),
  getInvoicesPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-invoices-paginated", page, limit, search),
  getSalesPaginated: (page: number, limit: number, startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("get-sales-paginated", page, limit, startDate, endDate),
  getClientsPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-clients-paginated", page, limit, search),
  getUsersPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-users-paginated", page, limit, search),
  getAuditLogsPaginated: (page: number, limit: number, filters?: { startDate?: string; endDate?: string; table?: string; search?: string }) =>
    ipcRenderer.invoke("get-audit-logs-paginated", page, limit, filters),
  getSuppliersPaginated: (page: number, limit: number, search?: string) =>
    ipcRenderer.invoke("get-suppliers-paginated", page, limit, search),
  getPurchasesPaginated: (page: number, limit: number) =>
    ipcRenderer.invoke("get-purchases-paginated", page, limit),
  getServersPaginated: (page: number, limit: number) =>
    ipcRenderer.invoke("get-servers-paginated", page, limit),

  // Purge & Stats
  purgeOldData: (config?: any) =>
    ipcRenderer.invoke("purge-old-data", config),
  getDatabaseStats: () =>
    ipcRenderer.invoke("get-database-stats"),
  repairDatabase: () =>
    ipcRenderer.invoke("repair-database"),

  // App Info
  getAppInfo: () =>
    ipcRenderer.invoke("get-app-info"),
});
