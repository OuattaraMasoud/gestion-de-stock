export interface Product {
  id?: number;
  nom: string;
  description?: string;
  code_barre?: string;
  prix_achat: number;
  prix_vente: number;
  quantite_stock: number;
  stock_min: number;
  categorie_id?: number;
  categorie_nom?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id?: number;
  nom: string;
  description?: string;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleItem {
  produit_id: number;
  nom_produit?: string;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
}

export interface Sale {
  id?: number;
  client_id?: number;
  client_nom?: string;
  serveur_id?: number;
  serveur_nom?: string;
  total: number;
  montant_paye: number;
  montant_restant: number;
  monnaie_rendue: number;
  statut_paiement: "paye" | "partiel" | "impaye";
  methode_paiement: "especes" | "carte" | "mobile";
  remise_type?: "pourcentage" | "montant";
  remise_valeur?: number;
  total_avant_remise?: number;
  date_vente?: string;
  produits: SaleItem[];
  paiements?: CustomerPayment[];
  utilisateur_id?: number;
  utilisateur_nom?: string;
}

export interface DashboardStats {
  ventesJour: number;
  ventesHier: number;
  ventesMois: number;
  ventesMoisPrecedent: number;
  totalProduits: number;
  stockFaible: number;
  valeurStock: number;
  nbVentesJour: number;
  profitMois: number;
  coutsMois: number;
  nbFournisseurs: number;
  nbClients: number;
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

export interface User {
  id?: number;
  nom: string;
  email: string;
  mot_de_passe?: string;
  role: "admin" | "caissier" | "gestionnaire";
  actif: boolean;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
}

export interface Supplier {
  id?: number;
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  commentaires?: string;
  solde_du?: number;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseItem {
  produit_id: number;
  nom_produit?: string;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
}

export interface Purchase {
  id?: number;
  fournisseur_id: number;
  fournisseur_nom?: string;
  total: number;
  montant_paye: number;
  montant_restant: number;
  statut_paiement: "paye" | "partiel" | "impaye";
  date_achat?: string;
  produits: PurchaseItem[];
  utilisateur_id?: number;
  utilisateur_nom?: string;
}

export interface SupplierPayment {
  id?: number;
  achat_id: number;
  fournisseur_id: number;
  montant: number;
  methode_paiement: "especes" | "carte" | "virement" | "cheque";
  reference?: string;
  commentaire?: string;
  date_paiement?: string;
  utilisateur_id?: number;
  utilisateur_nom?: string;
}

export interface Client {
  id?: number;
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  ville?: string;
  solde_du?: number;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClientPrice {
  id?: number;
  client_id: number;
  produit_id: number;
  produit_nom?: string;
  prix_personnalise: number;
  prix_standard?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Server {
  id?: number;
  nom: string;
  telephone?: string;
  actif: boolean;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPayment {
  id?: number;
  vente_id: number;
  client_id?: number;
  montant: number;
  methode_paiement: "especes" | "carte" | "mobile" | "virement";
  reference?: string;
  commentaire?: string;
  date_paiement?: string;
  utilisateur_id?: number;
  utilisateur_nom?: string;
}

export interface AccountingEntry {
  id?: number;
  type:
    | "vente"
    | "achat"
    | "paiement_client"
    | "paiement_fournisseur"
    | "depense"
    | "autre";
  reference_id?: number;
  description: string;
  montant: number;
  type_mouvement: "entree" | "sortie";
  methode_paiement?: string;
  created_at?: string;
}

export interface InvoiceArticle {
  produit_id?: number;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export interface Invoice {
  id?: number;
  numero: string;
  vente_id: number;
  date_facture: string;
  heure_facture: string;
  vendeur: string;
  client_nom?: string;
  client_telephone?: string;
  client_email?: string;
  serveur_nom?: string;
  total_ttc: number;
  methode_paiement: string;
  montant_paye: number;
  monnaie_rendue: number;
  montant_restant?: number;
  statut_paiement?: "paye" | "partiel" | "impaye";
  remise_type?: "pourcentage" | "montant";
  remise_valeur?: number;
  total_avant_remise?: number;
  articles: InvoiceArticle[];
  created_at?: string;
}

export interface Configuration {
  id?: number;
  nom_entreprise: string;
  description_entreprise?: string;
  logo_url?: string;
  adresse?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  nif?: string;
  ville?: string;
  pays?: string;
  devise?: string;
  message_pied?: string;
  support_text?: string;
  format_facture?: "80mm" | "A4";
}

export interface AuditLog {
  id?: number;
  utilisateur_id?: number;
  utilisateur_nom?: string;
  utilisateur_email?: string;
  utilisateur_role?: string;
  action: string;
  table_cible?: string;
  enregistrement_id?: number;
  details?: string;
  adresse_ip?: string;
  user_agent?: string;
  created_at?: string;
}

export interface Backup {
  filename: string;
  path: string;
  size: number;
  created: Date;
  formattedSize: string;
  formattedDate: string;
}

export interface PurchaseItem {
  produit_id: number;
  nom_produit?: string;
  quantite: number;
  prix_unitaire: number;
  sous_total: number;
}

export interface Purchase {
  id?: number;
  fournisseur_id: number;
  fournisseur_nom?: string;
  total: number;
  montant_paye: number;
  montant_restant: number;
  statut_paiement: "paye" | "partiel" | "impaye";
  date_achat?: string;
  produits: PurchaseItem[];
  utilisateur_id?: number;
  utilisateur_nom?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getProducts: () => Promise<Product[]>;
      getProduct: (id: number) => Promise<Product>;
      createProduct: (product: Product) => Promise<any>;
      updateProduct: (id: number, product: Product) => Promise<any>;
      deleteProduct: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      searchProducts: (query: string) => Promise<Product[]>;
      searchProductsFTS: (query: string, limit?: number) => Promise<Product[]>;
      saveProductImage: (base64Data: string) => Promise<string>;
      getProductImage: (filename: string) => Promise<string | null>;
      saveCompanyLogo: (base64Data: string) => Promise<string>;
      getCompanyLogo: () => Promise<string | null>;
      deleteCompanyLogo: () => Promise<void>;
      getCategories: () => Promise<Category[]>;
      createCategory: (category: Category) => Promise<any>;
      updateCategory: (id: number, category: Category) => Promise<any>;
      deleteCategory: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      getSales: () => Promise<Sale[]>;
      createSale: (sale: Sale) => Promise<any>;
      getSalesByDate: (startDate: string, endDate: string) => Promise<Sale[]>;
      deleteSale: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      getDashboardStats: () => Promise<DashboardStats>;
      getLowStockProducts: () => Promise<Product[]>;
      // Utilisateurs
      login: (email: string, password: string) => Promise<User | null>;
      getUsers: () => Promise<User[]>;
      createUser: (user: User) => Promise<any>;
      updateUser: (id: number, user: User) => Promise<any>;
      deleteUser: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Fournisseurs
      getSuppliers: () => Promise<Supplier[]>;
      getSupplier: (id: number) => Promise<Supplier>;
      createSupplier: (supplier: Supplier) => Promise<any>;
      updateSupplier: (id: number, supplier: Supplier) => Promise<any>;
      deleteSupplier: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Dettes Fournisseurs
      getSupplierDebts: () => Promise<any[]>;
      getSupplierUnpaidPurchases: (supplierId: number) => Promise<any[]>;
      // Achats
      getPurchases: () => Promise<Purchase[]>;
      createPurchase: (purchase: Purchase) => Promise<any>;
      getPurchasesBySupplier: (supplierId: number) => Promise<Purchase[]>;
      getPurchase: (id: number) => Promise<Purchase>;
      deletePurchase: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Paiements Fournisseurs
      getSupplierPayments: (purchaseId: number) => Promise<SupplierPayment[]>;
      createSupplierPayment: (payment: SupplierPayment) => Promise<any>;
      // Clients
      getClients: () => Promise<Client[]>;
      getClient: (id: number) => Promise<Client>;
      createClient: (client: Client) => Promise<any>;
      updateClient: (id: number, client: Client) => Promise<any>;
      deleteClient: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Prix Clients
      getClientPrices: (clientId: number) => Promise<ClientPrice[]>;
      getClientPrice: (clientId: number, productId: number) => Promise<ClientPrice | null>;
      createClientPrice: (clientPrice: ClientPrice) => Promise<any>;
      updateClientPrice: (id: number, clientPrice: ClientPrice) => Promise<any>;
      deleteClientPrice: (id: number) => Promise<any>;
      bulkCreateClientPrices: (clientId: number, prices: ClientPrice[]) => Promise<any>;
      // Serveurs
      getServers: () => Promise<Server[]>;
      getServer: (id: number) => Promise<Server>;
      getActiveServers: () => Promise<Server[]>;
      createServer: (server: Server) => Promise<any>;
      updateServer: (id: number, server: Server) => Promise<any>;
      deleteServer: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Dettes Clients
      getCustomerDebts: () => Promise<any[]>;
      getCustomerUnpaidSales: (clientId: number) => Promise<any[]>;
      // Paiements Clients
      getCustomerPayments: (saleId: number) => Promise<CustomerPayment[]>;
      createCustomerPayment: (payment: CustomerPayment) => Promise<any>;
      // Comptabilité
      getAccountingEntries: (
        startDate?: string,
        endDate?: string,
      ) => Promise<AccountingEntry[]>;
      getAccountingEntriesPaginated: (
        page: number,
        limit: number,
        startDate?: string,
        endDate?: string,
      ) => Promise<{
        data: AccountingEntry[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        totalEntrees: number;
        totalSorties: number;
      }>;
      getTreasury: () => Promise<{ total: number; entries: AccountingEntry[] }>;
      // Factures
      createInvoice: (invoice: Invoice) => Promise<Invoice>;
      getInvoices: () => Promise<Invoice[]>;
      getInvoice: (id: number) => Promise<Invoice>;
      getInvoiceByVenteId: (venteId: number) => Promise<Invoice | null>;
      getInvoiceByNumero: (numero: string) => Promise<Invoice | null>;
      getInvoicesByDate: (
        startDate: string,
        endDate: string,
      ) => Promise<Invoice[]>;
      updateInvoice: (id: number, invoice: Invoice) => Promise<any>;
      deleteInvoice: (
        id: number,
        utilisateur_id?: number,
        utilisateur_nom?: string,
      ) => Promise<any>;
      // Configuration
      getConfiguration: () => Promise<Configuration>;
      updateConfiguration: (config: Configuration) => Promise<Configuration>;
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
      ) => Promise<any>;
      // Firebase
      // firebaseConfigInit: (config: any) => Promise<{ success: boolean }>;
      // firebaseConfigGet: () => Promise<any>;
      // firebaseSyncManual: () => Promise<any>;
      // firebaseSyncStatus: () => Promise<any>;
      checkInternet: () => Promise<boolean>;
      // Licence
      validateLicense: () => Promise<any>;
      activateLicense: (licenseKey: string) => Promise<any>;
      deactivateLicense: () => Promise<any>;
      getLicenseInfo: () => Promise<any>;
      getMachineId: () => Promise<string>;
      // Audit Logs
      getAuditLogs: (limit?: number) => Promise<any[]>;
      getAuditLogsByUser: (
        utilisateurId: number,
        limit?: number,
      ) => Promise<any[]>;
      getAuditLogsByDate: (
        startDate: string,
        endDate: string,
      ) => Promise<any[]>;
      getAuditLogsByTable: (table: string, limit?: number) => Promise<any[]>;
      createAuditLog: (log: any) => Promise<any>;
      // Backup & Restauration
      backupDatabase: () => Promise<{
        success: boolean;
        backupPath: string;
        timestamp: string;
      }>;
      restoreDatabase: (
        backupPath: string,
      ) => Promise<{ success: boolean; message: string }>;
      getBackups: () => Promise<Backup[]>;
      deleteBackup: (filename: string) => Promise<{ success: boolean }>;
      relaunchApp: () => Promise<void>;
      // Inventaire
      getInventoryData: (
        page: number,
        limit: number,
        startDate?: string,
        endDate?: string,
        search?: string,
        categorieId?: number,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        stats: {
          valeur_stock_achat: number;
          valeur_stock_vente: number;
          produits_rupture: number;
          produits_stock_bas: number;
        };
      }>;
      // Server-Side Pagination
      getProductsPaginated: (
        page: number,
        limit: number,
        search?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getInvoicesPaginated: (
        page: number,
        limit: number,
        search?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getSalesPaginated: (
        page: number,
        limit: number,
        startDate?: string,
        endDate?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getClientsPaginated: (
        page: number,
        limit: number,
        search?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getUsersPaginated: (
        page: number,
        limit: number,
        search?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getAuditLogsPaginated: (
        page: number,
        limit: number,
        filters?: {
          startDate?: string;
          endDate?: string;
          table?: string;
          search?: string;
        },
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getSuppliersPaginated: (
        page: number,
        limit: number,
        search?: string,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getPurchasesPaginated: (
        page: number,
        limit: number,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      getServersPaginated: (
        page: number,
        limit: number,
      ) => Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>;
      // Purge & Stats
      purgeOldData: (
        config?: any,
      ) => Promise<{ success: boolean; message: string; stats: any }>;
      getDatabaseStats: () => Promise<{
        totalSize: number;
        tables: any[];
        oldestData: any;
      }>;
      repairDatabase: () => Promise<{
        success: boolean;
        message: string;
        backupPath?: string;
      }>;
      // App Info
      getAppInfo: () => Promise<{
        version: string;
        buildNumber: string;
        buildDate: string;
      }>;
      // Data Management
      clearAllData: () => Promise<{
        success: boolean;
        message: string;
        stats: {
          products: number;
          categories: number;
          sales: number;
          invoices: number;
          proformas: number;
          purchases: number;
          supplierPayments: number;
          customerPayments: number;
          accounting: number;
        };
      }>;
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
    };
  }
}
