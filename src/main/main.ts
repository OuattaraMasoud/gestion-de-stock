import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./database";
import {
  purgeOldData,
  getDatabaseStats,
  repairDatabase,
  clearAllData,
  importProductsFromCSV,
} from "./database";
import { checkInternetConnection } from "./apiClient";

import {
  validateLicense,
  activateLicense,
  deactivateLicense,
  getCurrentLicense,
  getMachineId,
} from "./license";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
    titleBarStyle: "default",
    backgroundColor: "#f3f4f6",
    show: true, // Montrer immédiatement
  });

  // Logger les erreurs de la console web
  mainWindow.webContents.on(
    "console-message",
    (_, level, message, line, sourceId) => {
      console.log(`Console [${level}]:`, message, "at", sourceId, "line", line);
    },
  );

  // Logger les erreurs de chargement
  mainWindow.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription, validatedURL) => {
      console.error(
        "Erreur de chargement:",
        errorCode,
        errorDescription,
        validatedURL,
      );
    },
  );

  // Afficher la fenêtre seulement après le chargement
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow?.show();
  });

  // Ouvrir les DevTools seulement en développement
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // En mode dev
  if (
    process.env.NODE_ENV === "development" ||
    process.env.ELECTRON_RENDERER_URL
  ) {
    if (process.env.ELECTRON_RENDERER_URL) {
      console.log(
        "Chargement en mode dev URL:",
        process.env.ELECTRON_RENDERER_URL,
      );
      mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      console.log("Chargement en mode dev fichier");
      mainWindow.loadFile(path.join(__dirname, "../../dist-react/index.html"));
    }
  } else {
    // Production : charger le fichier build
    const indexPath = path.join(__dirname, "../../dist-react/index.html");
    console.log("Chargement du fichier:", indexPath);
    console.log("Le fichier existe?", require("fs").existsSync(indexPath));

    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    // Initialiser la base de données
    db.initDatabase();
    // Verrouiller les factures > 24h au démarrage et toutes les heures
    db.lockOldInvoices();
    setInterval(() => db.lockOldInvoices(), 3600000);
    // Démarrer le scheduler de synchronisation quotidienne
    const database = db.getDatabase();

    // Créer la fenêtre
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("Erreur au démarrage:", error);
    // Afficher une boîte de dialogue d'erreur
    const { dialog } = require("electron");
    dialog.showErrorBox(
      "Erreur de démarrage",
      `L'application n'a pas pu démarrer: ${error}`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers pour les produits
ipcMain.handle("get-products", async () => {
  return db.getProducts();
});

ipcMain.handle("get-product", async (_, id: number) => {
  return db.getProduct(id);
});

ipcMain.handle("create-product", async (_, product: any) => {
  return db.createProduct(product);
});

ipcMain.handle("update-product", async (_, id: number, product: any) => {
  return db.updateProduct(id, product);
});

ipcMain.handle(
  "delete-product",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteProduct(id, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle("search-products", async (_, query: string) => {
  return db.searchProducts(query);
});

ipcMain.handle(
  "search-products-fts",
  async (_, query: string, limit?: number) => {
    return db.searchProductsFTS(query, limit);
  },
);

ipcMain.handle("save-product-image", async (_, base64Data: string) => {
  return db.saveProductImage(base64Data);
});

ipcMain.handle("get-product-image", async (_, filename: string) => {
  return db.getProductImage(filename);
});

ipcMain.handle("save-company-logo", async (_, base64Data: string) => {
  return db.saveCompanyLogo(base64Data);
});

ipcMain.handle("get-company-logo", async () => {
  return db.getCompanyLogo();
});

ipcMain.handle("delete-company-logo", async () => {
  return db.deleteCompanyLogo();
});

// IPC Handlers pour les catégories
ipcMain.handle("get-categories", async () => {
  return db.getCategories();
});

ipcMain.handle("create-category", async (_, category: any) => {
  return db.createCategory(category);
});

ipcMain.handle("update-category", async (_, id: number, category: any) => {
  return db.updateCategory(id, category);
});

ipcMain.handle(
  "delete-category",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteCategory(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les ventes
ipcMain.handle("get-sales", async () => {
  return db.getSales();
});

ipcMain.handle("create-sale", async (_, sale: any) => {
  return db.createSale(sale);
});

ipcMain.handle(
  "get-sales-by-date",
  async (_, startDate: string, endDate: string) => {
    return db.getSalesByDate(startDate, endDate);
  },
);

ipcMain.handle(
  "delete-sale",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteSale(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les statistiques
ipcMain.handle("get-dashboard-stats", async () => {
  return db.getDashboardStats();
});

ipcMain.handle(
  "get-dashboard-stats-by-date",
  async (_, startDate: string, endDate: string) => {
    return db.getDashboardStatsByDate(startDate, endDate);
  },
);

ipcMain.handle("get-low-stock-products", async () => {
  return db.getLowStockProducts();
});

// IPC Handlers pour les utilisateurs
ipcMain.handle("login", async (_, email: string, password: string) => {
  return db.login(email, password);
});

ipcMain.handle("get-users", async () => {
  return db.getUsers();
});

ipcMain.handle("create-user", async (_, user: any) => {
  return db.createUser(user);
});

ipcMain.handle("update-user", async (_, id: number, user: any) => {
  return db.updateUser(id, user);
});

ipcMain.handle(
  "delete-user",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteUser(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les fournisseurs
ipcMain.handle("get-suppliers", async () => {
  return db.getSuppliers();
});

ipcMain.handle("get-supplier", async (_, id: number) => {
  return db.getSupplier(id);
});

ipcMain.handle("create-supplier", async (_, supplier: any) => {
  return db.createSupplier(supplier);
});

ipcMain.handle("update-supplier", async (_, id: number, supplier: any) => {
  return db.updateSupplier(id, supplier);
});

ipcMain.handle(
  "delete-supplier",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteSupplier(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les achats
ipcMain.handle("get-purchases", async () => {
  return db.getPurchases();
});

ipcMain.handle("create-purchase", async (_, purchase: any) => {
  return db.createPurchase(purchase);
});

ipcMain.handle("get-purchases-by-supplier", async (_, supplierId: number) => {
  return db.getPurchasesBySupplier(supplierId);
});

ipcMain.handle("get-purchase", async (_, id: number) => {
  return db.getPurchase(id);
});

ipcMain.handle(
  "delete-purchase",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deletePurchase(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les dettes fournisseurs
ipcMain.handle("get-supplier-debts", async () => {
  return db.getSupplierDebts();
});

ipcMain.handle(
  "get-supplier-unpaid-purchases",
  async (_, supplierId: number) => {
    return db.getSupplierUnpaidPurchases(supplierId);
  },
);

// IPC Handlers pour les paiements fournisseurs
ipcMain.handle("get-supplier-payments", async (_, purchaseId: number) => {
  return db.getSupplierPayments(purchaseId);
});

ipcMain.handle("create-supplier-payment", async (_, payment: any) => {
  return db.createSupplierPayment(payment);
});

// IPC Handlers pour les clients
ipcMain.handle("get-clients", async () => {
  return db.getClients();
});

ipcMain.handle("get-client", async (_, id: number) => {
  return db.getClient(id);
});

ipcMain.handle("create-client", async (_, client: any) => {
  return db.createClient(client);
});

ipcMain.handle("update-client", async (_, id: number, client: any) => {
  return db.updateClient(id, client);
});

ipcMain.handle(
  "delete-client",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteClient(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les prix personnalisés des clients
ipcMain.handle("get-client-prices", async (_, clientId: number) => {
  return db.getClientPrices(clientId);
});

ipcMain.handle(
  "get-client-price",
  async (_, clientId: number, productId: number) => {
    return db.getClientPrice(clientId, productId);
  },
);

ipcMain.handle("create-client-price", async (_, clientPrice: any) => {
  return db.createClientPrice(clientPrice);
});

ipcMain.handle(
  "update-client-price",
  async (_, id: number, clientPrice: any) => {
    return db.updateClientPrice(id, clientPrice);
  },
);

ipcMain.handle("delete-client-price", async (_, id: number) => {
  return db.deleteClientPrice(id);
});

ipcMain.handle(
  "bulk-create-client-prices",
  async (_, clientId: number, prices: any[]) => {
    return db.bulkCreateClientPrices(clientId, prices);
  },
);

// IPC Handlers pour les serveurs
ipcMain.handle("get-servers", async () => {
  return db.getServers();
});

ipcMain.handle("get-server", async (_, id: number) => {
  return db.getServer(id);
});

ipcMain.handle("get-active-servers", async () => {
  return db.getActiveServers();
});

ipcMain.handle("create-server", async (_, server: any) => {
  return db.createServer(server);
});

ipcMain.handle("update-server", async (_, id: number, server: any) => {
  return db.updateServer(id, server);
});

ipcMain.handle(
  "delete-server",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteServer(id, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour les dettes clients
ipcMain.handle("get-customer-debts", async () => {
  return db.getCustomerDebts();
});

ipcMain.handle("get-customer-unpaid-sales", async (_, clientId: number) => {
  return db.getCustomerUnpaidSales(clientId);
});

// IPC Handlers pour les paiements clients
ipcMain.handle("get-customer-payments", async (_, saleId: number) => {
  return db.getCustomerPayments(saleId);
});

ipcMain.handle("create-customer-payment", async (_, payment: any) => {
  return db.createCustomerPayment(payment);
});

ipcMain.handle(
  "pay-client-debt-by-amount",
  async (_, clientId: number, montant: number, methode: string, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.payClientDebtByAmount(clientId, montant, methode, utilisateur_id, utilisateur_nom);
  },
);

// IPC Handlers pour la comptabilité
ipcMain.handle(
  "get-accounting-entries",
  async (_, startDate?: string, endDate?: string) => {
    return db.getAccountingEntries(startDate, endDate);
  },
);

ipcMain.handle("get-treasury", async () => {
  return db.getTreasury();
});

ipcMain.handle(
  "get-treasury-by-period",
  async (_, startDate: string, endDate: string) => {
    return db.getTreasuryByPeriod(startDate, endDate);
  },
);

ipcMain.handle(
  "get-profit-stats",
  async (_, startDate?: string, endDate?: string) => {
    return db.getProfitStats(startDate, endDate);
  },
);

// Dépenses
ipcMain.handle(
  "get-expenses",
  async (_, startDate?: string, endDate?: string) => {
    return db.getExpenses(startDate, endDate);
  },
);

ipcMain.handle(
  "get-expenses-paginated",
  async (
    _,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    categorie?: string,
  ) => {
    return db.getExpensesPaginated(page, limit, startDate, endDate, categorie);
  },
);

ipcMain.handle("create-expense", async (_, expense: any) => {
  return db.createExpense(expense);
});

ipcMain.handle("update-expense", async (_, id: number, expense: any) => {
  return db.updateExpense(id, expense);
});

ipcMain.handle(
  "delete-expense",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteExpense(id, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle(
  "get-expense-stats",
  async (_, startDate?: string, endDate?: string) => {
    return db.getExpenseStats(startDate, endDate);
  },
);

// Top Produits et Clients
ipcMain.handle(
  "get-top-products",
  async (_, limit?: number, startDate?: string, endDate?: string) => {
    return db.getTopProducts(limit, startDate, endDate);
  },
);

ipcMain.handle(
  "get-top-clients",
  async (_, limit?: number, startDate?: string, endDate?: string) => {
    return db.getTopClients(limit, startDate, endDate);
  },
);

ipcMain.handle(
  "get-accounting-entries-paginated",
  async (
    _,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ) => {
    return db.getAccountingEntriesPaginated(page, limit, startDate, endDate);
  },
);

// // IPC Handlers pour Firebase Sync
// ipcMain.handle("firebase-config-init", async (_, config: any) => {
//   initFirebaseConfig(config);
//   return { success: true };
// });

// ipcMain.handle("firebase-config-get", async () => {
//   return loadFirebaseConfig();
// });

// ipcMain.handle("firebase-sync-manual", async () => {
//   const database = db.getDatabase();
//   if (!database) {
//     throw new Error("Base de données non initialisée");
//   }
//   await triggerManualSync(database);
//   return getSyncStatus();
// });

// ipcMain.handle("firebase-sync-status", async () => {
//   return getSyncStatus();
// });

ipcMain.handle("check-internet", async () => {
  return await checkInternetConnection();
});

// IPC Handlers pour les factures
ipcMain.handle("create-invoice", async (_, invoice: any) => {
  return db.createInvoice(invoice);
});

ipcMain.handle("get-invoices", async () => {
  return db.getInvoices();
});

ipcMain.handle("get-invoice", async (_, id: number) => {
  return db.getInvoice(id);
});

ipcMain.handle("get-invoice-by-vente-id", async (_, venteId: number) => {
  return db.getInvoiceByVenteId(venteId);
});

ipcMain.handle("get-invoice-by-numero", async (_, numero: string) => {
  return db.getInvoiceByNumero(numero);
});

ipcMain.handle(
  "get-invoices-by-date",
  async (_, startDate: string, endDate: string) => {
    return db.getInvoicesByDate(startDate, endDate);
  },
);

ipcMain.handle("update-invoice", async (_, id: number, invoice: any) => {
  return db.updateInvoice(id, invoice);
});

ipcMain.handle(
  "delete-invoice",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteInvoice(id, utilisateur_id, utilisateur_nom);
  },
);

// ===== INVENTAIRE =====

ipcMain.handle(
  "get-inventory-data",
  async (
    _,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
    search?: string,
    categorieId?: number,
  ) => {
    try {
      return db.getInventoryData(
        page,
        limit,
        startDate,
        endDate,
        search,
        categorieId,
      );
    } catch (error) {
      console.error("Erreur get inventory data:", error);
      throw error;
    }
  },
);

// ===== SERVER-SIDE PAGINATION =====

ipcMain.handle(
  "get-products-paginated",
  async (_, page: number, limit: number, search?: string, categorieId?: number, status?: string) => {
    try {
      return db.getProductsPaginated(page, limit, search, categorieId, status);
    } catch (error) {
      console.error("Erreur get products paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-invoices-paginated",
  async (_, page: number, limit: number, search?: string) => {
    try {
      return db.getInvoicesPaginated(page, limit, search);
    } catch (error) {
      console.error("Erreur get invoices paginated:", error);
      throw error;
    }
  },
);

// Factures Proforma
ipcMain.handle(
  "create-proforma-invoice",
  async (
    _,
    proforma: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => {
    return db.createProformaInvoice(proforma, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle("get-proforma-invoices", async () => {
  return db.getProformaInvoices();
});

ipcMain.handle("get-proforma-invoice", async (_, id: number) => {
  return db.getProformaInvoice(id);
});

ipcMain.handle(
  "update-proforma-invoice",
  async (
    _,
    id: number,
    proforma: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => {
    return db.updateProformaInvoice(
      id,
      proforma,
      utilisateur_id,
      utilisateur_nom,
    );
  },
);

ipcMain.handle(
  "update-proforma-status",
  async (
    _,
    id: number,
    statut: string,
    vente_id?: number,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => {
    return db.updateProformaStatus(
      id,
      statut,
      vente_id,
      utilisateur_id,
      utilisateur_nom,
    );
  },
);

ipcMain.handle(
  "delete-proforma-invoice",
  async (_, id: number, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.deleteProformaInvoice(id, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle(
  "get-proforma-invoices-paginated",
  async (_, page: number, limit: number, search?: string, statut?: string) => {
    return db.getProformaInvoicesPaginated(page, limit, search, statut);
  },
);

ipcMain.handle(
  "get-sales-paginated",
  async (
    _,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string,
  ) => {
    try {
      return db.getSalesPaginated(page, limit, startDate, endDate);
    } catch (error) {
      console.error("Erreur get sales paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-clients-paginated",
  async (_, page: number, limit: number, search?: string) => {
    try {
      return db.getClientsPaginated(page, limit, search);
    } catch (error) {
      console.error("Erreur get clients paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-users-paginated",
  async (_, page: number, limit: number, search?: string) => {
    try {
      return db.getUsersPaginated(page, limit, search);
    } catch (error) {
      console.error("Erreur get users paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-audit-logs-paginated",
  async (
    _,
    page: number,
    limit: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      table?: string;
      search?: string;
    },
  ) => {
    try {
      return db.getAuditLogsPaginated(page, limit, filters);
    } catch (error) {
      console.error("Erreur get audit logs paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-suppliers-paginated",
  async (_, page: number, limit: number, search?: string) => {
    try {
      return db.getSuppliersPaginated(page, limit, search);
    } catch (error) {
      console.error("Erreur get suppliers paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-purchases-paginated",
  async (_, page: number, limit: number) => {
    try {
      return db.getPurchasesPaginated(page, limit);
    } catch (error) {
      console.error("Erreur get purchases paginated:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-servers-paginated",
  async (_, page: number, limit: number) => {
    try {
      return db.getServersPaginated(page, limit);
    } catch (error) {
      console.error("Erreur get servers paginated:", error);
      throw error;
    }
  },
);

// ===== FIN SERVER-SIDE PAGINATION =====

// IPC Handlers pour la Configuration
ipcMain.handle("get-configuration", async () => {
  return db.getConfiguration();
});

ipcMain.handle("update-configuration", async (_, config: any) => {
  return db.updateConfiguration(config);
});

ipcMain.handle(
  "update-sale",
  async (
    _,
    id: number,
    sale: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => {
    return db.updateSale(id, sale, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle("can-modify-sale", async (_, venteId: number) => {
  return db.canModifySale(venteId);
});

// IPC Handlers pour la Licence
ipcMain.handle("license-validate", async () => {
  return await validateLicense();
});

ipcMain.handle("license-activate", async (_, licenseKey: string) => {
  return await activateLicense(licenseKey);
});

ipcMain.handle("license-deactivate", async () => {
  return await deactivateLicense();
});

ipcMain.handle("license-get-info", async () => {
  return getCurrentLicense();
});

ipcMain.handle("license-get-machine-id", async () => {
  return getMachineId();
});

// ===== AUDIT LOGS =====

ipcMain.handle("get-audit-logs", async (_, limit: number = 100) => {
  try {
    return db.getAuditLogs(limit);
  } catch (error) {
    console.error("Erreur get audit logs:", error);
    throw error;
  }
});

ipcMain.handle(
  "get-audit-logs-by-user",
  async (_, utilisateurId: number, limit: number = 100) => {
    try {
      return db.getAuditLogsByUser(utilisateurId, limit);
    } catch (error) {
      console.error("Erreur get audit logs by user:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-audit-logs-by-date",
  async (_, startDate: string, endDate: string) => {
    try {
      return db.getAuditLogsByDate(startDate, endDate);
    } catch (error) {
      console.error("Erreur get audit logs by date:", error);
      throw error;
    }
  },
);

ipcMain.handle(
  "get-audit-logs-by-table",
  async (_, table: string, limit: number = 100) => {
    try {
      return db.getAuditLogsByTable(table, limit);
    } catch (error) {
      console.error("Erreur get audit logs by table:", error);
      throw error;
    }
  },
);

ipcMain.handle("create-audit-log", async (_, log: any) => {
  try {
    return db.createAuditLog(log);
  } catch (error) {
    console.error("Erreur create audit log:", error);
    throw error;
  }
});

// ===== BACKUP & RESTAURATION =====

ipcMain.handle("backup-database", async () => {
  try {
    return db.backupDatabase();
  } catch (error) {
    console.error("Erreur backup database:", error);
    throw error;
  }
});

ipcMain.handle("restore-database", async (_, backupPath: string) => {
  try {
    return db.restoreDatabase(backupPath);
  } catch (error) {
    console.error("Erreur restore database:", error);
    throw error;
  }
});

ipcMain.handle("get-backups", async () => {
  try {
    return db.getBackups();
  } catch (error) {
    console.error("Erreur get backups:", error);
    throw error;
  }
});

ipcMain.handle("delete-backup", async (_, filename: string) => {
  try {
    return db.deleteBackup(filename);
  } catch (error) {
    console.error("Erreur delete backup:", error);
    throw error;
  }
});

ipcMain.handle("relaunch-app", async () => {
  try {
    // Fermer toutes les fenêtres
    const { BrowserWindow } = require("electron");
    BrowserWindow.getAllWindows().forEach((window: any) => window.close());

    // Petit délai pour laisser les fenêtres se fermer
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  } catch (error) {
    console.error("Erreur relaunch app:", error);
    throw error;
  }
});

ipcMain.handle("purge-old-data", async (_, config?: any) => {
  try {
    const result = purgeOldData(config);
    return result;
  } catch (error) {
    console.error("Erreur purge old data:", error);
    throw error;
  }
});

ipcMain.handle(
  "clear-all-data",
  async (
    _,
    options?: any,
    utilisateur_id?: number,
    utilisateur_nom?: string,
  ) => {
    try {
      const result = clearAllData(options, utilisateur_id, utilisateur_nom);
      return result;
    } catch (error) {
      console.error("Erreur clear all data:", error);
      throw error;
    }
  },
);

ipcMain.handle("import-products-csv", async (_, csvContent: string) => {
  try {
    const result = importProductsFromCSV(csvContent);
    return result;
  } catch (error) {
    console.error("Erreur import CSV:", error);
    throw error;
  }
});

ipcMain.handle("get-database-stats", async () => {
  try {
    const stats = getDatabaseStats();
    return stats;
  } catch (error) {
    console.error("Erreur get database stats:", error);
    throw error;
  }
});

ipcMain.handle("repair-database", async () => {
  try {
    const result = repairDatabase();
    return result;
  } catch (error) {
    console.error("Erreur repair database:", error);
    throw error;
  }
});

ipcMain.handle("get-app-info", async () => {
  try {
    const version = app.getVersion();
    const buildNumber = process.env.BUILD_NUMBER || "dev";
    const buildDate = process.env.BUILD_DATE || new Date().toISOString();
    return { version, buildNumber, buildDate };
  } catch (error) {
    console.error("Erreur get app info:", error);
    throw error;
  }
});

// IPC Handlers pour la caisse
ipcMain.handle("get-open-caisse", async () => {
  return db.getOpenCaisse();
});

ipcMain.handle("open-caisse", async (_, caisse: any) => {
  return db.openCaisse(caisse);
});

ipcMain.handle("close-caisse", async (_, caisseId: number, data: any) => {
  return db.closeCaisse(caisseId, data);
});

ipcMain.handle("get-caisses", async (_, page: number, limit: number) => {
  return db.getCaisses(page, limit);
});

ipcMain.handle("get-caisse-stats", async (_, caisseId: number) => {
  return db.getCaisseStats(caisseId);
});

ipcMain.handle("get-total-customer-debts-period", async (_, startDate: string, endDate: string) => {
  return db.getTotalCustomerDebtsByPeriod(startDate, endDate);
});

ipcMain.handle("get-total-supplier-debts-period", async (_, startDate: string, endDate: string) => {
  return db.getTotalSupplierDebtsByPeriod(startDate, endDate);
});

ipcMain.handle("get-caisses-by-period", async (_, startDate: string, endDate: string) => {
  return db.getCaissesByPeriod(startDate, endDate);
});

ipcMain.handle("get-treasury-evolution", async (_, startDate: string, endDate: string) => {
  return db.getTreasuryEvolution(startDate, endDate);
});

// IPC Handlers pour les livraisons
ipcMain.handle("get-livraisons", async (_, page: number, limit: number, statut?: string) => {
  return db.getLivraisons(page, limit, statut);
});

ipcMain.handle("create-livraison", async (_, livraison: any) => {
  return db.createLivraison(livraison);
});

ipcMain.handle("update-livraison", async (_, id: number, livraison: any) => {
  return db.updateLivraison(id, livraison);
});

ipcMain.handle("mark-as-delivered", async (_, venteId: number) => {
  return db.markAsDelivered(venteId);
});

// IPC Handler pour les stats client
ipcMain.handle("get-client-stats", async (_, clientId: number, startDate?: string, endDate?: string) => {
  return db.getClientStats(clientId, startDate, endDate);
});

// IPC Handler pour les détails d'une vente
ipcMain.handle("get-vente-details", async (_, venteId: number) => {
  return db.getVenteDetails(venteId);
});

// IPC Handler pour le verrouillage auto des factures
ipcMain.handle("lock-old-invoices", async () => {
  return db.lockOldInvoices();
});

ipcMain.handle("get-dashboard-card-details", async (_, type: string, startDate: string, endDate: string) => {
  return db.getDashboardCardDetails(type, startDate, endDate);
});

ipcMain.handle(
  "pay-supplier-debt-by-amount",
  async (_, supplierId: number, montant: number, methode: string, utilisateur_id?: number, utilisateur_nom?: string) => {
    return db.paySupplierDebtByAmount(supplierId, montant, methode, utilisateur_id, utilisateur_nom);
  },
);

ipcMain.handle("get-sales-value-report", async (_, startDate: string, endDate: string) => {
  return db.getSalesValueReport(startDate, endDate);
});

ipcMain.handle("get-credit-sales-report", async (_, startDate: string, endDate: string) => {
  return db.getCreditSalesDetailedReport(startDate, endDate);
});
