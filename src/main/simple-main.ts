import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    show: true,
  });

  // Logger les erreurs de la console web
  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`Console [${level}]:`, message, 'at', sourceId, 'line', line);
  });

  // Ouvrir les DevTools
  mainWindow.webContents.openDevTools();

  // Production
  const indexPath = path.join(__dirname, '../../dist-react/index-prod.html');
  console.log('Chemin de chargement:', indexPath);
  console.log('Fichier existe?', require('fs').existsSync(indexPath));

  if (require('fs').existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Fallback
    mainWindow.loadFile(path.join(__dirname, '../../dist-react/index.html'));
  }
}

app.whenReady().then(() => {
  try {
    db.initDatabase();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Erreur au démarrage:', error);
    dialog.showErrorBox('Erreur de démarrage', `L'application n'a pas pu démarrer: ${error}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Exposer directement les APIs globales pour le renderer
global.electronAPI = {
  // Produits
  getProducts: () => ipcRenderer.invoke('get-products'),
  getProduct: (id: number) => ipcRenderer.invoke('get-product', id),
  createProduct: (product: any) => ipcRenderer.invoke('create-product', product),
  updateProduct: (id: number, product: any) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
  searchProducts: (query: string) => ipcRenderer.invoke('search-products', query),

  // Utilisateurs
  login: (email: string, password: string) => ipcRenderer.invoke('login', email, password),
  getUsers: () => ipcRenderer.invoke('get-users'),
  createUser: (user: any) => ipcRenderer.invoke('create-user', user),
  updateUser: (id: number, user: any) => ipcRenderer.invoke('update-user', id, user),
  deleteUser: (id: number) => ipcRenderer.invoke('delete-user', id),

  // Catégories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  createCategory: (category: any) => ipcRenderer.invoke('create-category', category),
  updateCategory: (id: number, category: any) => ipcRenderer.invoke('update-category', id, category),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),

  // Ventes
  getSales: () => ipcRenderer.invoke('get-sales'),
  createSale: (sale: any) => ipcRenderer.invoke('create-sale', sale),
  getSalesByDate: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('get-sales-by-date', startDate, endDate),

  // Statistiques
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getLowStockProducts: () => ipcRenderer.invoke('get-low-stock-products'),

  // Fournisseurs
  getSuppliers: () => ipcRenderer.invoke('get-suppliers'),
  createSupplier: (supplier: any) => ipcRenderer.invoke('create-supplier', supplier),
  updateSupplier: (id: number, supplier: any) => ipcRenderer.invoke('update-supplier', id, supplier),
  deleteSupplier: (id: number) => ipcRenderer.invoke('delete-supplier', id),

  // Clients
  getClients: () => ipcRenderer.invoke('get-clients'),
  createClient: (client: any) => ipcRenderer.invoke('create-client', client),
  updateClient: (id: number, client: any) => ipcRenderer.invoke('update-client', id, client),
  deleteClient: (id: number) => ipcRenderer.invoke('delete-client', id),

  // Autres...
  getPurchases: () => ipcRenderer.invoke('get-purchases'),
  createPurchase: (purchase: any) => ipcRenderer.invoke('create-purchase', purchase),
  getTreasury: () => ipcRenderer.invoke('get-treasury'),
};

// Tous les handlers IPC...
ipcMain.handle('get-products', async () => {
  return db.getProducts();
});

ipcMain.handle('get-product', async (_, id: number) => {
  return db.getProduct(id);
});

ipcMain.handle('create-product', async (_, product: any) => {
  return db.createProduct(product);
});

ipcMain.handle('update-product', async (_, id: number, product: any) => {
  return db.updateProduct(id, product);
});

ipcMain.handle('delete-product', async (_, id: number) => {
  return db.deleteProduct(id);
});

ipcMain.handle('search-products', async (_, query: string) => {
  return db.searchProducts(query);
});

ipcMain.handle('login', async (_, email: string, password: string) => {
  return db.login(email, password);
});

ipcMain.handle('get-users', async () => {
  return db.getUsers();
});

ipcMain.handle('create-user', async (_, user: any) => {
  return db.createUser(user);
});

ipcMain.handle('update-user', async (_, id: number, user: any) => {
  return db.updateUser(id, user);
});

ipcMain.handle('delete-user', async (_, id: number) => {
  return db.deleteUser(id);
});

ipcMain.handle('get-categories', async () => {
  return db.getCategories();
});

ipcMain.handle('create-category', async (_, category: any) => {
  return db.createCategory(category);
});

ipcMain.handle('update-category', async (_, id: number, category: any) => {
  return db.updateCategory(id, category);
});

ipcMain.handle('delete-category', async (_, id: number) => {
  return db.deleteCategory(id);
});

ipcMain.handle('get-sales', async () => {
  return db.getSales();
});

ipcMain.handle('create-sale', async (_, sale: any) => {
  return db.createSale(sale);
});

ipcMain.handle('get-sales-by-date', async (_, startDate: string, endDate: string) => {
  return db.getSalesByDate(startDate, endDate);
});

ipcMain.handle('get-dashboard-stats', async () => {
  return db.getDashboardStats();
});

ipcMain.handle('get-low-stock-products', async () => {
  return db.getLowStockProducts();
});

ipcMain.handle('get-suppliers', async () => {
  return db.getSuppliers();
});

ipcMain.handle('create-supplier', async (_, supplier: any) => {
  return db.createSupplier(supplier);
});

ipcMain.handle('update-supplier', async (_, id: number, supplier: any) => {
  return db.updateSupplier(id, supplier);
});

ipcMain.handle('delete-supplier', async (_, id: number) => {
  return db.deleteSupplier(id);
});

ipcMain.handle('get-clients', async () => {
  return db.getClients();
});

ipcMain.handle('create-client', async (_, client: any) => {
  return db.createClient(client);
});

ipcMain.handle('update-client', async (_, id: number, client: any) => {
  return db.updateClient(id, client);
});

ipcMain.handle('delete-client', async (_, id: number) => {
  return db.deleteClient(id);
});

ipcMain.handle('get-purchases', async () => {
  return db.getPurchases();
});

ipcMain.handle('create-purchase', async (_, purchase: any) => {
  return db.createPurchase(purchase);
});

ipcMain.handle('get-treasury', async () => {
  return db.getTreasury();
});