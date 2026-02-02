import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";

let db: Database.Database;

// Version actuelle du schéma de la base de données
// Incrémentez ce numéro à chaque nouveau changement de schéma
const CURRENT_SCHEMA_VERSION = 4;

// Vérifier l'intégrité de la base de données
function checkAndRepairDatabase(): { success: boolean; message: string } {
  try {
    const result = db.pragma("integrity_check", { simple: true }) as string;
    if (result === "ok") {
      return { success: true, message: "Base de données saine" };
    } else {
      return { success: false, message: result || "Erreur d'intégrité détectée" };
    }
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// Recréer les tables FTS5 si elles sont corrompues
function recreateFTSTables() {
  try {
    // Supprimer les tables FTS5 si elles existent
    db.exec(`
      DROP TABLE IF EXISTS produits_fts;
      DROP TABLE IF EXISTS clients_fts;
      DROP TABLE IF EXISTS fournisseurs_fts;
      DROP TABLE IF EXISTS utilisateurs_fts;
    `);

    // Supprimer les triggers associés
    db.exec(`
      DROP TRIGGER IF EXISTS produits_ai;
      DROP TRIGGER IF EXISTS produits_ad;
      DROP TRIGGER IF EXISTS produits_au;
      DROP TRIGGER IF EXISTS clients_ai;
      DROP TRIGGER IF EXISTS clients_ad;
      DROP TRIGGER IF EXISTS clients_au;
      DROP TRIGGER IF EXISTS fournisseurs_ai;
      DROP TRIGGER IF EXISTS fournisseurs_ad;
      DROP TRIGGER IF EXISTS fournisseurs_au;
      DROP TRIGGER IF EXISTS utilisateurs_ai;
      DROP TRIGGER IF EXISTS utilisateurs_ad;
      DROP TRIGGER IF EXISTS utilisateurs_au;
    `);

    // VACUUM pour nettoyer la base de données
    db.exec("VACUUM");

    console.log("Tables FTS5 supprimées et nettoyage effectué");
  } catch (error) {
    console.error("Erreur lors de la suppression des tables FTS5:", error);
    throw error;
  }
}

// Réparer une base de données corrompue en dumpant et restaurant
export function repairDatabase(): { success: boolean; message: string; backupPath?: string } {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "data", "gestion_stock.db");
  const backupDir = path.join(userDataPath, "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `corrupted_db_${timestamp}.db`);

  try {
    // Créer le dossier de backups s'il n'existe pas
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Copier la base de données corrompue comme sauvegarde
    fs.copyFileSync(dbPath, backupPath);

    // Essayer d'exporter les données
    try {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
      `).all() as { name: string }[];

      const dump: string[] = [];
      for (const table of tables) {
        if (["produits_fts", "clients_fts", "fournisseurs_fts", "utilisateurs_fts"].includes(table.name)) {
          continue; // Ignorer les tables FTS5 corrompues
        }

        try {
          const data = db.prepare(`SELECT * FROM ${table.name}`).all();
          dump.push(`-- Table: ${table.name}`);
          // On pourrait faire un dump complet ici mais c'est complexe
          // Pour l'instant, on va juste recréer les tables FTS5
        } catch (error) {
          console.log(`Impossible d'exporter la table ${table.name}:`, error);
        }
      }

      // Recréer les tables FTS5
      recreateFTSTables();

      // Réinitialiser les tables avec createTables() qui recréera les FTS5
      runMigrations();
      createTables();

      return {
        success: true,
        message: "Base de données réparée avec succès",
        backupPath,
      };
    } catch (exportError) {
      console.error("Erreur lors de l'export:", exportError);
      return {
        success: false,
        message: "Impossible de réparer la base de données automatiquement",
        backupPath,
      };
    }
  } catch (error) {
    console.error("Erreur réparation base de données:", error);
    return {
      success: false,
      message: String(error),
    };
  }
}

// Obtenir l'instance de la base de données
export function getDatabase(): Database.Database {
  return db;
}

// Fermer la connexion à la base de données
export function closeDatabase() {
  if (db) {
    db.close();
  }
}

// Réinitialiser la connexion à la base de données
export function reopenDatabase() {
  const userDataPath = app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  const dbPath = path.join(dbDir, "gestion_stock.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = DELETE");
}

// Initialiser la connexion SQLite
export function initDatabase() {
  // Créer le dossier de données s'il n'existe pas
  const userDataPath = app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "gestion_stock.db");
  console.log("Base de données SQLite:", dbPath);

  db = new Database(dbPath);
  db.pragma("journal_mode = DELETE");

  // Vérifier l'intégrité de la base de données et réparer si nécessaire
  const integrityCheck = checkAndRepairDatabase();
  if (!integrityCheck.success) {
    console.error("Erreur d'intégrité de la base de données:", integrityCheck.message);
    // Tenter de recréer les tables FTS5 si elles sont corrompues
    try {
      recreateFTSTables();
      console.log("Tables FTS5 recréées avec succès");
    } catch (ftsError) {
      console.error("Erreur lors de la recréation des tables FTS5:", ftsError);
    }
  }

  // Exécuter les migrations AVANT de créer les tables
  // Cela permet de mettre à jour les anciennes bases de données
  runMigrations();

  // Créer les tables si elles n'existent pas
  createTables();

  // Créer un utilisateur admin par défaut
  createDefaultUser();
}

// Créer la table de versioning du schéma
function createSchemaVersionTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Détecter les migrations déjà appliquées sur une ancienne base de données
// Ceci est important pour les utilisateurs qui mettent à jour depuis une version
// qui n'avait pas encore le système de versioning
function detectExistingMigrations() {
  // Si la table schema_versions est vide mais que la base a des données,
  // on détecte quelles migrations ont déjà été appliquées
  const hasVersions = db.prepare("SELECT COUNT(*) as count FROM schema_versions").get() as { count: number };

  if (hasVersions.count > 0) {
    return; // Les versions sont déjà trackées
  }

  // Vérifier si c'est une ancienne base de données avec des tables
  if (!tableExists("ventes")) {
    return; // Nouvelle installation, pas besoin de détecter
  }

  console.log("🔍 Détection des migrations existantes sur ancienne base de données...");

  // Détecter migration 1: client_id dans ventes
  if (columnExists("ventes", "client_id")) {
    console.log("  → Migration 1 déjà appliquée (client_id existe)");
    recordMigration(1, "Ajout client_id et serveur_id à ventes (pré-existant)");
  }

  // Détecter migration 2: serveur_id dans ventes
  if (columnExists("ventes", "serveur_id")) {
    console.log("  → Migration 2 déjà appliquée (serveur_id existe)");
    recordMigration(2, "Ajout serveur_id à ventes (pré-existant)");
  }

  // Détecter migration 3: serveur_nom dans factures
  if (tableExists("factures") && columnExists("factures", "serveur_nom")) {
    console.log("  → Migration 3 déjà appliquée (serveur_nom existe)");
    recordMigration(3, "Ajout serveur_nom à factures (pré-existant)");
  }

  // Détecter migration 4: colonnes de remise
  if (columnExists("ventes", "remise_type")) {
    console.log("  → Migration 4 déjà appliquée (remise_type existe)");
    recordMigration(4, "Ajout colonnes de remise à ventes et factures (pré-existant)");
  }

  console.log("✓ Détection terminée");
}

// Obtenir la version actuelle du schéma
function getCurrentSchemaVersion(): number {
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'")
      .all();

    if (tables.length === 0) {
      return 0; // Nouvelle base ou ancienne version sans tracking
    }

    const result = db.prepare("SELECT MAX(version) as version FROM schema_versions").get() as { version: number | null };
    return result?.version || 0;
  } catch {
    return 0;
  }
}

// Enregistrer une migration appliquée
function recordMigration(version: number, description: string) {
  db.prepare("INSERT OR IGNORE INTO schema_versions (version, description) VALUES (?, ?)").run(version, description);
}

// Vérifier si une colonne existe dans une table
function columnExists(tableName: string, columnName: string): boolean {
  try {
    const tableInfo = db.pragma(`table_info('${tableName}')`);
    const columns = (tableInfo as any[]).map((col) => col.name);
    return columns.includes(columnName);
  } catch {
    return false;
  }
}

// Vérifier si une table existe
function tableExists(tableName: string): boolean {
  const result = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
  return !!result;
}

// Créer un backup avant migration
function createMigrationBackup(): string | null {
  try {
    const userDataPath = app.getPath("userData");
    const backupDir = path.join(userDataPath, "backups");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `pre_migration_${timestamp}.db`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dbPath = path.join(userDataPath, "data", "gestion_stock.db");
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✓ Backup créé: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error("Erreur lors de la création du backup:", error);
    return null;
  }
}

// ==================== DÉFINITION DES MIGRATIONS ====================
// Chaque migration a un numéro de version unique et une fonction up()
// IMPORTANT: Ne jamais modifier une migration existante, toujours en créer une nouvelle

interface Migration {
  version: number;
  description: string;
  up: () => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Ajout client_id et serveur_id à ventes",
    up: () => {
      // Migration pour ajouter client_id à ventes (ancienne logique préservée)
      if (tableExists("ventes") && !columnExists("ventes", "client_id")) {
        console.log("Migration 1: Ajout de client_id à ventes...");

        // Sauvegarder TOUTES les données existantes
        const oldVentes = db.prepare("SELECT * FROM ventes").all();
        const oldVentesProduits = tableExists("ventes_produits")
          ? db.prepare("SELECT * FROM ventes_produits").all()
          : [];
        const oldPaiementsClients = tableExists("paiements_clients")
          ? db.prepare("SELECT * FROM paiements_clients").all()
          : [];

        console.log(`  Sauvegarde: ${oldVentes.length} ventes, ${oldVentesProduits.length} produits, ${oldPaiementsClients.length} paiements`);

        // Supprimer les tables dépendantes
        db.exec("DROP TABLE IF EXISTS ventes_produits");
        db.exec("DROP TABLE IF EXISTS paiements_clients");
        db.exec("DROP TABLE IF EXISTS ventes");

        // Recréer la table ventes avec les nouvelles colonnes
        db.exec(`
          CREATE TABLE ventes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            total REAL NOT NULL,
            montant_paye REAL NOT NULL,
            montant_restant REAL DEFAULT 0,
            monnaie_rendue REAL NOT NULL DEFAULT 0,
            statut_paiement TEXT NOT NULL DEFAULT 'paye' CHECK(statut_paiement IN ('paye', 'partiel', 'impaye')),
            methode_paiement TEXT NOT NULL CHECK(methode_paiement IN ('especes', 'carte', 'mobile')),
            date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
          )
        `);

        // Restaurer les ventes
        if (oldVentes.length > 0) {
          const insertStmt = db.prepare(`
            INSERT INTO ventes (id, total, montant_paye, montant_restant, monnaie_rendue, statut_paiement, methode_paiement, date_vente)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const vente of oldVentes as any[]) {
            try {
              insertStmt.run(
                vente.id,
                vente.total,
                vente.montant_paye,
                vente.montant_restant || 0,
                vente.monnaie_rendue || 0,
                vente.statut_paiement || "paye",
                vente.methode_paiement || "especes",
                vente.date_vente,
              );
            } catch (e) {
              console.log(`  Impossible de restaurer vente ${vente.id}:`, e);
            }
          }
        }

        // Recréer ventes_produits
        db.exec(`
          CREATE TABLE ventes_produits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vente_id INTEGER NOT NULL,
            produit_id INTEGER NOT NULL,
            quantite INTEGER NOT NULL,
            prix_unitaire REAL NOT NULL,
            sous_total REAL NOT NULL,
            FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
            FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
          )
        `);

        // Restaurer ventes_produits
        if (oldVentesProduits.length > 0) {
          const insertVPStmt = db.prepare(`
            INSERT INTO ventes_produits (id, vente_id, produit_id, quantite, prix_unitaire, sous_total)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          for (const vp of oldVentesProduits as any[]) {
            try {
              insertVPStmt.run(vp.id, vp.vente_id, vp.produit_id, vp.quantite, vp.prix_unitaire, vp.sous_total);
            } catch (e) {
              console.log(`  Impossible de restaurer vente_produit ${vp.id}:`, e);
            }
          }
        }

        // Recréer paiements_clients
        db.exec(`
          CREATE TABLE paiements_clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vente_id INTEGER NOT NULL,
            client_id INTEGER,
            montant REAL NOT NULL,
            methode_paiement TEXT NOT NULL CHECK(methode_paiement IN ('especes', 'carte', 'mobile', 'virement')),
            reference TEXT,
            commentaire TEXT,
            date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
          )
        `);

        // Restaurer paiements_clients
        if (oldPaiementsClients.length > 0) {
          const insertPCStmt = db.prepare(`
            INSERT INTO paiements_clients (id, vente_id, client_id, montant, methode_paiement, reference, commentaire, date_paiement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const pc of oldPaiementsClients as any[]) {
            try {
              insertPCStmt.run(
                pc.id,
                pc.vente_id,
                pc.client_id || null,
                pc.montant,
                pc.methode_paiement || "especes",
                pc.reference || null,
                pc.commentaire || null,
                pc.date_paiement,
              );
            } catch (e) {
              console.log(`  Impossible de restaurer paiement_client ${pc.id}:`, e);
            }
          }
        }

        console.log(`✓ Migration 1: ${oldVentes.length} vente(s), ${oldVentesProduits.length} produit(s), ${oldPaiementsClients.length} paiement(s) migré(s)`);
      }
    },
  },
  {
    version: 2,
    description: "Ajout serveur_id à ventes",
    up: () => {
      if (tableExists("ventes") && !columnExists("ventes", "serveur_id")) {
        console.log("Migration 2: Ajout de serveur_id à ventes...");
        db.exec("ALTER TABLE ventes ADD COLUMN serveur_id INTEGER");
        console.log("✓ Migration 2 terminée");
      }
    },
  },
  {
    version: 3,
    description: "Ajout serveur_nom à factures",
    up: () => {
      if (tableExists("factures") && !columnExists("factures", "serveur_nom")) {
        console.log("Migration 3: Ajout de serveur_nom à factures...");
        db.exec("ALTER TABLE factures ADD COLUMN serveur_nom TEXT");
        console.log("✓ Migration 3 terminée");
      }
    },
  },
  {
    version: 4,
    description: "Ajout colonnes de remise à ventes et factures",
    up: () => {
      // Remise dans ventes
      if (tableExists("ventes") && !columnExists("ventes", "remise_type")) {
        console.log("Migration 4: Ajout des colonnes de remise à ventes...");
        db.exec("ALTER TABLE ventes ADD COLUMN remise_type TEXT DEFAULT NULL");
        db.exec("ALTER TABLE ventes ADD COLUMN remise_valeur REAL DEFAULT 0");
        db.exec("ALTER TABLE ventes ADD COLUMN total_avant_remise REAL DEFAULT NULL");
      }

      // Remise dans factures
      if (tableExists("factures") && !columnExists("factures", "remise_type")) {
        console.log("Migration 4: Ajout des colonnes de remise à factures...");
        db.exec("ALTER TABLE factures ADD COLUMN remise_type TEXT DEFAULT NULL");
        db.exec("ALTER TABLE factures ADD COLUMN remise_valeur REAL DEFAULT 0");
        db.exec("ALTER TABLE factures ADD COLUMN total_avant_remise REAL DEFAULT NULL");
      }
      console.log("✓ Migration 4 terminée");
    },
  },
  // ==================== AJOUTEZ VOS NOUVELLES MIGRATIONS ICI ====================
  // Exemple:
  // {
  //   version: 5,
  //   description: "Description de votre migration",
  //   up: () => {
  //     // Votre code de migration
  //   },
  // },
];

function runMigrations() {
  console.log("=== DEBUT DES MIGRATIONS ===");

  try {
    // Créer la table de versioning
    createSchemaVersionTable();

    // Détecter les migrations déjà appliquées sur les anciennes bases de données
    // (avant le système de versioning)
    detectExistingMigrations();

    const currentVersion = getCurrentSchemaVersion();
    console.log(`Version actuelle du schéma: ${currentVersion}`);
    console.log(`Version cible du schéma: ${CURRENT_SCHEMA_VERSION}`);

    // Filtrer les migrations à appliquer
    const pendingMigrations = migrations.filter((m) => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log("✓ Base de données à jour, aucune migration nécessaire");
      console.log("=== FIN DES MIGRATIONS ===");
      return;
    }

    console.log(`${pendingMigrations.length} migration(s) à appliquer`);

    // Créer un backup avant les migrations
    const backupPath = createMigrationBackup();
    if (!backupPath) {
      console.warn("⚠️  Impossible de créer un backup, continuation avec précaution...");
    }

    // Appliquer chaque migration dans l'ordre
    for (const migration of pendingMigrations.sort((a, b) => a.version - b.version)) {
      console.log(`\n--- Migration ${migration.version}: ${migration.description} ---`);

      try {
        // Exécuter la migration dans une transaction
        db.exec("BEGIN TRANSACTION");
        migration.up();
        recordMigration(migration.version, migration.description);
        db.exec("COMMIT");
        console.log(`✓ Migration ${migration.version} appliquée avec succès`);
      } catch (migrationError) {
        db.exec("ROLLBACK");
        console.error(`❌ Échec de la migration ${migration.version}:`, migrationError);

        // Informer l'utilisateur du backup disponible
        if (backupPath) {
          console.error(`💾 Un backup est disponible: ${backupPath}`);
        }

        throw new Error(
          `Échec de la migration ${migration.version}: ${(migrationError as Error).message}`,
        );
      }
    }

    console.log(`\n✓ Toutes les migrations ont été appliquées avec succès`);
    console.log(`Version du schéma: ${currentVersion} → ${CURRENT_SCHEMA_VERSION}`);
  } catch (error) {
    console.error("❌ ERREUR CRITIQUE lors de la migration:", error);
    console.error("Stack trace:", (error as Error).stack);
    throw new Error(
      `Échec de la migration de la base de données: ${(error as Error).message}`,
    );
  }

  console.log("=== FIN DES MIGRATIONS ===");
}

function createTables() {
  // Table categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table produits
  db.exec(`
    CREATE TABLE IF NOT EXISTS produits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      code_barre TEXT UNIQUE,
      prix_achat REAL NOT NULL DEFAULT 0,
      prix_vente REAL NOT NULL DEFAULT 0,
      quantite_stock INTEGER NOT NULL DEFAULT 0,
      stock_min INTEGER NOT NULL DEFAULT 5,
      categorie_id INTEGER,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  // Table clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT,
      email TEXT,
      adresse TEXT,
      ville TEXT,
      solde_du REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table serveurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS serveurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      telephone TEXT,
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table ventes (modifiée)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ventes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_nom TEXT,
      serveur_id INTEGER,
      total REAL NOT NULL,
      montant_paye REAL NOT NULL,
      montant_restant REAL DEFAULT 0,
      monnaie_rendue REAL NOT NULL DEFAULT 0,
      statut_paiement TEXT NOT NULL DEFAULT 'paye' CHECK(statut_paiement IN ('paye', 'partiel', 'impaye')),
      methode_paiement TEXT NOT NULL CHECK(methode_paiement IN ('especes', 'carte', 'mobile')),
      remise_type TEXT DEFAULT NULL,
      remise_valeur REAL DEFAULT 0,
      total_avant_remise REAL DEFAULT NULL,
      date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (serveur_id) REFERENCES serveurs(id) ON DELETE SET NULL
    )
  `);

  // Table ventes_produits
  db.exec(`
    CREATE TABLE IF NOT EXISTS ventes_produits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vente_id INTEGER NOT NULL,
      produit_id INTEGER NOT NULL,
      quantite INTEGER NOT NULL,
      prix_unitaire REAL NOT NULL,
      sous_total REAL NOT NULL,
      FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
      FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
    )
  `);

  // Table paiements_clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS paiements_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vente_id INTEGER NOT NULL,
      client_id INTEGER,
      montant REAL NOT NULL,
      methode_paiement TEXT NOT NULL CHECK(methode_paiement IN ('especes', 'carte', 'mobile', 'virement')),
      reference TEXT,
      commentaire TEXT,
      date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `);

  // Table fournisseurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS fournisseurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT,
      email TEXT,
      adresse TEXT,
      ville TEXT,
      pays TEXT,
      commentaires TEXT,
      solde_du REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table achats
  db.exec(`
    CREATE TABLE IF NOT EXISTS achats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fournisseur_id INTEGER NOT NULL,
      total REAL NOT NULL,
      montant_paye REAL NOT NULL,
      montant_restant REAL DEFAULT 0,
      statut_paiement TEXT NOT NULL DEFAULT 'paye' CHECK(statut_paiement IN ('paye', 'partiel', 'impaye')),
      date_achat DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE CASCADE
    )
  `);

  // Table achats_produits
  db.exec(`
    CREATE TABLE IF NOT EXISTS achats_produits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achat_id INTEGER NOT NULL,
      produit_id INTEGER NOT NULL,
      quantite INTEGER NOT NULL,
      prix_unitaire REAL NOT NULL,
      sous_total REAL NOT NULL,
      FOREIGN KEY (achat_id) REFERENCES achats(id) ON DELETE CASCADE,
      FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
    )
  `);

  // Table paiements_fournisseurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS paiements_fournisseurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achat_id INTEGER NOT NULL,
      fournisseur_id INTEGER NOT NULL,
      montant REAL NOT NULL,
      methode_paiement TEXT NOT NULL CHECK(methode_paiement IN ('especes', 'carte', 'virement', 'cheque')),
      reference TEXT,
      commentaire TEXT,
      date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (achat_id) REFERENCES achats(id) ON DELETE CASCADE,
      FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE CASCADE
    )
  `);

  // Table comptabilite
  db.exec(`
    CREATE TABLE IF NOT EXISTS comptabilite (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('vente', 'achat', 'paiement_client', 'paiement_fournisseur', 'depense', 'autre')),
      reference_id INTEGER,
      description TEXT NOT NULL,
      montant REAL NOT NULL,
      type_mouvement TEXT NOT NULL CHECK(type_mouvement IN ('entree', 'sortie')),
      methode_paiement TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mot_de_passe TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'caissier', 'gestionnaire')),
      actif INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Table factures
  db.exec(`
    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      vente_id INTEGER NOT NULL,
      date_facture TEXT NOT NULL,
      heure_facture TEXT NOT NULL,
      vendeur TEXT NOT NULL,
      client_nom TEXT DEFAULT 'Client comptoir',
      serveur_nom TEXT,
      total_ttc REAL NOT NULL,
      methode_paiement TEXT NOT NULL,
      montant_paye REAL NOT NULL,
      monnaie_rendue REAL DEFAULT 0,
      articles TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE
    )
  `);

  // Table configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuration (
      id INTEGER PRIMARY KEY,
      nom_entreprise TEXT NOT NULL DEFAULT 'Mon Entreprise',
      logo_url TEXT,
      adresse TEXT,
      telephone TEXT,
      telephone2 TEXT,
      email TEXT,
      nif TEXT,
      ville TEXT,
      pays TEXT,
      devise TEXT DEFAULT 'FCFA',
      message_pied TEXT DEFAULT 'Merci de votre visite !',
      support_text TEXT,
      format_facture TEXT DEFAULT '80mm' CHECK(format_facture IN ('80mm', 'A4'))
    )
  `);

  // Table audit
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER,
      utilisateur_nom TEXT,
      action TEXT NOT NULL,
      table_cible TEXT,
      enregistrement_id INTEGER,
      details TEXT,
      adresse_ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
    )
  `);

  // Créer des index simples pour améliorer les performances
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(categorie_id);
    CREATE INDEX IF NOT EXISTS idx_produits_code_barre ON produits(code_barre);
    CREATE INDEX IF NOT EXISTS idx_produits_created_at ON produits(created_at);
    CREATE INDEX IF NOT EXISTS idx_produits_nom ON produits(nom);
    CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(date_vente);
    CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(client_id);
    CREATE INDEX IF NOT EXISTS idx_ventes_serveur ON ventes(serveur_id);
    CREATE INDEX IF NOT EXISTS idx_ventes_produits_vente ON ventes_produits(vente_id);
    CREATE INDEX IF NOT EXISTS idx_ventes_produits_produit ON ventes_produits(produit_id);
    CREATE INDEX IF NOT EXISTS idx_paiements_clients_vente ON paiements_clients(vente_id);
    CREATE INDEX IF NOT EXISTS idx_achats_fournisseur ON achats(fournisseur_id);
    CREATE INDEX IF NOT EXISTS idx_achats_produits_achat ON achats_produits(achat_id);
    CREATE INDEX IF NOT EXISTS idx_paiements_fournisseurs_achat ON paiements_fournisseurs(achat_id);
    CREATE INDEX IF NOT EXISTS idx_comptabilite_type ON comptabilite(type);
    CREATE INDEX IF NOT EXISTS idx_comptabilite_date ON comptabilite(created_at);
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_email ON utilisateurs(email);
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_nom ON utilisateurs(nom);
    CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);
    CREATE INDEX IF NOT EXISTS idx_fournisseurs_nom ON fournisseurs(nom);
    CREATE INDEX IF NOT EXISTS idx_factures_vente ON factures(vente_id);
    CREATE INDEX IF NOT EXISTS idx_factures_numero ON factures(numero);
    CREATE INDEX IF NOT EXISTS idx_factures_date ON factures(date_facture);
    CREATE INDEX IF NOT EXISTS idx_audit_utilisateur ON audit_logs(utilisateur_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_cible);
    CREATE INDEX IF NOT EXISTS idx_achats_date ON achats(date_achat);
    CREATE INDEX IF NOT EXISTS idx_serveurs_actif ON serveurs(actif);
  `);

  // Créer des index COMPOSÉS pour pagination optimisée (critique pour 1M+)
  db.exec(`
    -- Index composés pour pagination optimisée (created_at + id)
    CREATE INDEX IF NOT EXISTS idx_produits_created_id ON produits(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ventes_date_id ON ventes(date_vente DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_factures_date_id ON factures(date_facture DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_achats_date_id ON achats(date_achat DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_created_id ON audit_logs(created_at DESC, id DESC);

    -- Index composés pour recherche + tri
    CREATE INDEX IF NOT EXISTS idx_clients_nom_id ON clients(nom ASC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_fournisseurs_nom_id ON fournisseurs(nom ASC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_utilisateurs_nom_id ON utilisateurs(nom ASC, id DESC);

    -- Index composés pour jointures
    CREATE INDEX IF NOT EXISTS idx_produits_cat_created ON produits(categorie_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ventes_client_date ON ventes(client_id, date_vente DESC);
    CREATE INDEX IF NOT EXISTS idx_ventes_serveur_date ON ventes(serveur_id, date_vente DESC);
  `);

  // Créer tables FTS5 pour recherche full-text ultra-rapide
  db.exec(`
    -- Table FTS5 pour produits (recherche nom, description, code_barre)
    CREATE VIRTUAL TABLE IF NOT EXISTS produits_fts USING fts5(
      nom,
      description,
      code_barre,
      content='produits',
      content_rowid='id'
    );

    -- Trigger pour synchroniser produits_fts avec produits
    CREATE TRIGGER IF NOT EXISTS produits_ai AFTER INSERT ON produits BEGIN
      INSERT INTO produits_fts(rowid, nom, description, code_barre)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.description, ''), COALESCE(NEW.code_barre, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS produits_ad AFTER DELETE ON produits BEGIN
      DELETE FROM produits_fts WHERE rowid = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS produits_au AFTER UPDATE ON produits BEGIN
      DELETE FROM produits_fts WHERE rowid = OLD.id;
      INSERT INTO produits_fts(rowid, nom, description, code_barre)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.description, ''), COALESCE(NEW.code_barre, ''));
    END;

    -- Table FTS5 pour clients
    CREATE VIRTUAL TABLE IF NOT EXISTS clients_fts USING fts5(
      nom,
      email,
      telephone,
      content='clients',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS clients_ai AFTER INSERT ON clients BEGIN
      INSERT INTO clients_fts(rowid, nom, email, telephone)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.email, ''), COALESCE(NEW.telephone, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS clients_ad AFTER DELETE ON clients BEGIN
      DELETE FROM clients_fts WHERE rowid = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS clients_au AFTER UPDATE ON clients BEGIN
      DELETE FROM clients_fts WHERE rowid = OLD.id;
      INSERT INTO clients_fts(rowid, nom, email, telephone)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.email, ''), COALESCE(NEW.telephone, ''));
    END;

    -- Table FTS5 pour fournisseurs
    CREATE VIRTUAL TABLE IF NOT EXISTS fournisseurs_fts USING fts5(
      nom,
      email,
      telephone,
      content='fournisseurs',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS fournisseurs_ai AFTER INSERT ON fournisseurs BEGIN
      INSERT INTO fournisseurs_fts(rowid, nom, email, telephone)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.email, ''), COALESCE(NEW.telephone, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS fournisseurs_ad AFTER DELETE ON fournisseurs BEGIN
      DELETE FROM fournisseurs_fts WHERE rowid = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS fournisseurs_au AFTER UPDATE ON fournisseurs BEGIN
      DELETE FROM fournisseurs_fts WHERE rowid = OLD.id;
      INSERT INTO fournisseurs_fts(rowid, nom, email, telephone)
      VALUES (NEW.id, NEW.nom, COALESCE(NEW.email, ''), COALESCE(NEW.telephone, ''));
    END;

    -- Table FTS5 pour utilisateurs
    CREATE VIRTUAL TABLE IF NOT EXISTS utilisateurs_fts USING fts5(
      nom,
      email,
      content='utilisateurs',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS utilisateurs_ai AFTER INSERT ON utilisateurs BEGIN
      INSERT INTO utilisateurs_fts(rowid, nom, email)
      VALUES (NEW.id, NEW.nom, NEW.email);
    END;

    CREATE TRIGGER IF NOT EXISTS utilisateurs_ad AFTER DELETE ON utilisateurs BEGIN
      DELETE FROM utilisateurs_fts WHERE rowid = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS utilisateurs_au AFTER UPDATE ON utilisateurs BEGIN
      DELETE FROM utilisateurs_fts WHERE rowid = OLD.id;
      INSERT INTO utilisateurs_fts(rowid, nom, email)
      VALUES (NEW.id, NEW.nom, NEW.email);
    END;
  `);

  // Table de métadonnées pour COUNT pré-calculés (ultra-rapide)
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Insérer les compteurs initiaux
    INSERT OR IGNORE INTO metadata (key, value)
    SELECT 'produits_count', (SELECT COUNT(*) FROM produits)
    UNION ALL
    SELECT 'clients_count', (SELECT COUNT(*) FROM clients)
    UNION ALL
    SELECT 'fournisseurs_count', (SELECT COUNT(*) FROM fournisseurs)
    UNION ALL
    SELECT 'utilisateurs_count', (SELECT COUNT(*) FROM utilisateurs)
    UNION ALL
    SELECT 'ventes_count', (SELECT COUNT(*) FROM ventes)
    UNION ALL
    SELECT 'factures_count', (SELECT COUNT(*) FROM factures)
    UNION ALL
    SELECT 'achats_count', (SELECT COUNT(*) FROM achats)
    UNION ALL
    SELECT 'audit_logs_count', (SELECT COUNT(*) FROM audit_logs);
  `);

  // Triggers pour mettre à jour les compteurs automatiquement
  db.exec(`
    -- Produits
    CREATE TRIGGER IF NOT EXISTS produits_count_ai AFTER INSERT ON produits BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'produits_count';
    END;
    CREATE TRIGGER IF NOT EXISTS produits_count_ad AFTER DELETE ON produits BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'produits_count';
    END;

    -- Clients
    CREATE TRIGGER IF NOT EXISTS clients_count_ai AFTER INSERT ON clients BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'clients_count';
    END;
    CREATE TRIGGER IF NOT EXISTS clients_count_ad AFTER DELETE ON clients BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'clients_count';
    END;

    -- Fournisseurs
    CREATE TRIGGER IF NOT EXISTS fournisseurs_count_ai AFTER INSERT ON fournisseurs BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'fournisseurs_count';
    END;
    CREATE TRIGGER IF NOT EXISTS fournisseurs_count_ad AFTER DELETE ON fournisseurs BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'fournisseurs_count';
    END;

    -- Utilisateurs
    CREATE TRIGGER IF NOT EXISTS utilisateurs_count_ai AFTER INSERT ON utilisateurs BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'utilisateurs_count';
    END;
    CREATE TRIGGER IF NOT EXISTS utilisateurs_count_ad AFTER DELETE ON utilisateurs BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'utilisateurs_count';
    END;

    -- Ventes
    CREATE TRIGGER IF NOT EXISTS ventes_count_ai AFTER INSERT ON ventes BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'ventes_count';
    END;
    CREATE TRIGGER IF NOT EXISTS ventes_count_ad AFTER DELETE ON ventes BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'ventes_count';
    END;

    -- Factures
    CREATE TRIGGER IF NOT EXISTS factures_count_ai AFTER INSERT ON factures BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'factures_count';
    END;
    CREATE TRIGGER IF NOT EXISTS factures_count_ad AFTER DELETE ON factures BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'factures_count';
    END;

    -- Achats
    CREATE TRIGGER IF NOT EXISTS achats_count_ai AFTER INSERT ON achats BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'achats_count';
    END;
    CREATE TRIGGER IF NOT EXISTS achats_count_ad AFTER DELETE ON achats BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'achats_count';
    END;

    -- Audit logs
    CREATE TRIGGER IF NOT EXISTS audit_logs_count_ai AFTER INSERT ON audit_logs BEGIN
      UPDATE metadata SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'audit_logs_count';
    END;
    CREATE TRIGGER IF NOT EXISTS audit_logs_count_ad AFTER DELETE ON audit_logs BEGIN
      UPDATE metadata SET value = value - 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'audit_logs_count';
    END;
  `);

  console.log("Tables créées avec succès");
}

export function saveProductImage(base64Data: string): string {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Format d'image invalide");
    }

    const mimeType = matches[1];
    const extension = mimeType.split("/")[1];
    const timestamp = Date.now();
    const filename = `product_${timestamp}.${extension}`;
    const filepath = path.join(imagesDir, filename);

    fs.writeFileSync(filepath, matches[2], "base64");
    return filename;
  } catch (error) {
    console.error("Erreur sauvegarde image:", error);
    throw error;
  }
}

export function getProductImage(filename: string): string | null {
  try {
    if (!filename) return null;
    const userDataPath = app.getPath("userData");
    const filepath = path.join(userDataPath, "images", filename);
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filepath).substring(1);
      const buffer = fs.readFileSync(filepath);
      const base64 = buffer.toString("base64");
      return `data:image/${ext};base64,${base64}`;
    }
    return null;
  } catch (error) {
    console.error("Erreur lecture image:", error);
    return null;
  }
}

// export function deleteProductImage(filename: string): void {
//   try {
//     if (!filename) {
//       return;
//     }
//     const userDataPath = app.getPath('userData');
//     const filepath = path.join(userDataPath, 'images', filename);
//     if (fs.existsSync(filepath)) {
//       fs.unlinkSync(filepath);
//     }
//   } catch (error) {
//     console.error('Erreur suppression image:', error);
//   }
// }

// export async function syncProductImagesToFirebase(boutiqueId: string): Promise<number> {
//   try {
//     const { syncProductImages } = require('./firebaseStorage');
//     return await syncProductImages(boutiqueId);
//   } catch (error) {
//     console.error('Erreur sync images Firebase:', error);
//     return 0;
//   }
// }

function createDefaultUser() {
  try {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM utilisateurs");
    const result = stmt.get() as { count: number };

    if (result.count === 0) {
      const insert = db.prepare(`
        INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif)
        VALUES (?, ?, ?, ?, ?)
      `);

      insert.run("Administrateur", "admin@example.com", "admin123", "admin", 1);
      console.log(
        "Utilisateur admin créé - Email: admin@example.com, Mot de passe: admin123",
      );
    }
  } catch (error) {
    console.error("Erreur création utilisateur par défaut:", error);
  }
}

// ===== PRODUITS =====

export function getProducts(limit: number = 1000) {
  try {
    const stmt = db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (error) {
    console.error("Erreur get products:", error);
    throw error;
  }
}

export function getProduct(id: number) {
  try {
    const stmt = db.prepare("SELECT * FROM produits WHERE id = ?");
    return stmt.get(id);
  } catch (error) {
    console.error("Erreur get product:", error);
    throw error;
  }
}

export function createProduct(product: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO produits (nom, description, code_barre, prix_achat, prix_vente,
       quantite_stock, stock_min, categorie_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      product.nom,
      product.description || null,
      product.code_barre || null,
      product.prix_achat,
      product.prix_vente,
      product.quantite_stock,
      product.stock_min || 5,
      product.categorie_id || null,
      product.image_url || null,
    );

    const productId = result.lastInsertRowid;

    logAudit(
      "créer produit",
      "produits",
      Number(productId),
      `Produit: ${product.nom} - Quantité: ${product.quantite_stock} - Prix: ${product.prix_vente}`,
      product.utilisateur_id,
      product.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create product:", error);
    throw error;
  }
}

export function updateProduct(id: number, product: any) {
  try {
    const oldProduct = db.prepare("SELECT * FROM produits WHERE id = ?").get(id) as any;
    
    if (!oldProduct) {
      throw new Error("Produit non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE produits SET
       nom = ?, description = ?, code_barre = ?, prix_achat = ?,
       prix_vente = ?, quantite_stock = ?, stock_min = ?,
       categorie_id = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = stmt.run(
      product.nom,
      product.description,
      product.code_barre,
      product.prix_achat,
      product.prix_vente,
      product.quantite_stock,
      product.stock_min,
      product.categorie_id,
      product.image_url,
      id,
    );

    const changes = [];
    if (oldProduct.nom !== product.nom) changes.push(`nom: "${oldProduct.nom}" → "${product.nom}"`);
    if (oldProduct.description !== product.description) changes.push(`description: "${oldProduct.description}" → "${product.description}"`);
    if (oldProduct.code_barre !== product.code_barre) changes.push(`code_barre: "${oldProduct.code_barre}" → "${product.code_barre}"`);
    if (oldProduct.prix_achat !== product.prix_achat) changes.push(`prix_achat: ${oldProduct.prix_achat} → ${product.prix_achat}`);
    if (oldProduct.prix_vente !== product.prix_vente) changes.push(`prix_vente: ${oldProduct.prix_vente} → ${product.prix_vente}`);
    if (oldProduct.quantite_stock !== product.quantite_stock) changes.push(`quantite_stock: ${oldProduct.quantite_stock} → ${product.quantite_stock}`);
    if (oldProduct.stock_min !== product.stock_min) changes.push(`stock_min: ${oldProduct.stock_min} → ${product.stock_min}`);
    if (oldProduct.categorie_id !== product.categorie_id) changes.push(`categorie_id: ${oldProduct.categorie_id} → ${product.categorie_id}`);
    if (oldProduct.image_url !== product.image_url) changes.push(`image_url: "${oldProduct.image_url}" → "${product.image_url}"`);

    const details = changes.length > 0 
      ? `Modifications: ${changes.join(", ")}`
      : `Produit: ${product.nom}`;

    logAudit(
      "modifier produit",
      "produits",
      id,
      details,
      product.utilisateur_id,
      product.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update product:", error);
    throw error;
  }
}

export function deleteProduct(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const product = db.prepare("SELECT * FROM produits WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM produits WHERE id = ?");
    const result = stmt.run(id);

    if (product) {
      logAudit(
        "supprimer produit",
        "produits",
        id,
        `Produit supprimé: ${product.nom} - Quantité: ${product.quantite_stock} - Prix: ${product.prix_vente}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete product:", error);
    throw error;
  }
}

export function searchProducts(query: string, limit: number = 100) {
  try {
    const searchTerm = `%${query}%`;
    const stmt = db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.nom LIKE ? OR p.code_barre LIKE ? OR p.description LIKE ?
      ORDER BY p.nom
      LIMIT ?
    `);
    return stmt.all(searchTerm, searchTerm, searchTerm, limit);
  } catch (error) {
    console.error("Erreur search products:", error);
    throw error;
  }
}

// ===== CATÉGORIES =====

export function getCategories() {
  try {
    const stmt = db.prepare("SELECT * FROM categories ORDER BY nom");
    return stmt.all();
  } catch (error) {
    console.error("Erreur get categories:", error);
    throw error;
  }
}

export function createCategory(category: any) {
  try {
    const stmt = db.prepare(
      "INSERT INTO categories (nom, description) VALUES (?, ?)",
    );
    const result = stmt.run(category.nom, category.description || null);
    
    const categoryId = result.lastInsertRowid;
    logAudit(
      "créer catégorie",
      "categories",
      Number(categoryId),
      `Catégorie: ${category.nom}`,
      category.utilisateur_id,
      category.utilisateur_nom,
    );
    
    return result;
  } catch (error) {
    console.error("Erreur create category:", error);
    throw error;
  }
}

export function updateCategory(id: number, category: any) {
  try {
    const oldCategory = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as any;
    
    if (!oldCategory) {
      throw new Error("Catégorie non trouvée");
    }
    
    const stmt = db.prepare(`
      UPDATE categories
      SET nom = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(category.nom, category.description || null, id);
    
    const changes = [];
    if (oldCategory.nom !== category.nom) changes.push(`nom: "${oldCategory.nom}" → "${category.nom}"`);
    if (oldCategory.description !== category.description) changes.push(`description: "${oldCategory.description}" → "${category.description}"`);
    
    const details = changes.length > 0
      ? `Modifications: ${changes.join(", ")}`
      : `Catégorie: ${category.nom}`;
    
    logAudit(
      "modifier catégorie",
      "categories",
      id,
      details,
      category.utilisateur_id,
      category.utilisateur_nom,
    );
    
    return result;
  } catch (error) {
    console.error("Erreur update category:", error);
    throw error;
  }
}

export function deleteCategory(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM categories WHERE id = ?");
    const result = stmt.run(id);

    if (category) {
      logAudit(
        "supprimer catégorie",
        "categories",
        id,
        `Catégorie supprimée: ${category.nom}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete category:", error);
    throw error;
  }
}

// ===== VENTES =====

export function getSales() {
  try {
    const stmt = db.prepare(`
      SELECT v.*, c.nom as client_nom, s.nom as serveur_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN serveurs s ON v.serveur_id = s.id
      ORDER BY v.date_vente DESC
      LIMIT 100
    `);
    const sales = stmt.all() as any[];

    // Récupérer les produits pour chaque vente
    const prodStmt = db.prepare(`
      SELECT vp.*, p.nom as nom_produit
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      WHERE vp.vente_id = ?
    `);

    // Récupérer les paiements pour chaque vente
    const paymentStmt = db.prepare(`
      SELECT * FROM paiements_clients
      WHERE vente_id = ?
      ORDER BY date_paiement DESC
    `);

    return sales.map((sale) => ({
      ...sale,
      produits: prodStmt.all(sale.id),
      paiements: paymentStmt.all(sale.id),
    }));
  } catch (error) {
    console.error("Erreur get sales:", error);
    throw error;
  }
}

export function createSale(sale: any) {
  try {
    return db.transaction(() => {
      // Ajouter les colonnes manquantes si elles n'existent pas
      try {
        db.exec("ALTER TABLE ventes ADD COLUMN client_nom TEXT");
      } catch (e) {
        // La colonne existe déjà, ignorer l'erreur
      }
      try {
        db.exec("ALTER TABLE ventes ADD COLUMN remise_type TEXT DEFAULT NULL");
      } catch (e) {
        // La colonne existe déjà, ignorer l'erreur
      }
      try {
        db.exec("ALTER TABLE ventes ADD COLUMN remise_valeur REAL DEFAULT 0");
      } catch (e) {
        // La colonne existe déjà, ignorer l'erreur
      }
      try {
        db.exec("ALTER TABLE ventes ADD COLUMN total_avant_remise REAL DEFAULT NULL");
      } catch (e) {
        // La colonne existe déjà, ignorer l'erreur
      }

      // Créer la vente avec remise
      const saleStmt = db.prepare(`
        INSERT INTO ventes (client_id, client_nom, serveur_id, total, montant_paye, montant_restant, monnaie_rendue, statut_paiement, methode_paiement, remise_type, remise_valeur, total_avant_remise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const montantRestant =
        sale.montant_restant || sale.total - sale.montant_paye;
      const statutPaiement =
        sale.statut_paiement ||
        (montantRestant <= 0
          ? "paye"
          : montantRestant < sale.total
            ? "partiel"
            : "impaye");

      const result = saleStmt.run(
        sale.client_id || null,
        sale.client_nom || null,
        sale.serveur_id || null,
        sale.total,
        sale.montant_paye,
        montantRestant,
        sale.monnaie_rendue,
        statutPaiement,
        sale.methode_paiement,
        sale.remise_type || null,
        sale.remise_valeur || 0,
        sale.total_avant_remise || null,
      );

      const venteId = result.lastInsertRowid;

      // Ajouter les produits vendus
      const prodStmt = db.prepare(`
        INSERT INTO ventes_produits (vente_id, produit_id, quantite, prix_unitaire, sous_total)
        VALUES (?, ?, ?, ?, ?)
      `);

      const updateStockStmt = db.prepare(`
        UPDATE produits SET quantite_stock = quantite_stock - ? WHERE id = ?
      `);

      for (const item of sale.produits) {
        prodStmt.run(
          venteId,
          item.produit_id,
          item.quantite,
          item.prix_unitaire,
          item.sous_total,
        );

        // Décrémenter le stock
        updateStockStmt.run(item.quantite, item.produit_id);
      }

      // Mettre à jour le solde du client si vente à crédit
      if (sale.client_id && montantRestant > 0) {
        const updateClientStmt = db.prepare(`
          UPDATE clients SET solde_du = solde_du + ? WHERE id = ?
        `);
        updateClientStmt.run(montantRestant, sale.client_id);
      }

      // Enregistrer dans la comptabilité (utiliser sale.total qui est le montant après remise)
      if (sale.total > 0) {
        const comptaStmt = db.prepare(`
          INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        comptaStmt.run(
          "vente",
          venteId,
          `Vente #${venteId}${sale.remise_valeur ? ` (remise: ${sale.remise_type === 'pourcentage' ? sale.remise_valeur + '%' : sale.remise_valeur + ' FCFA'})` : ''}`,
          sale.total,
          "entree",
          sale.methode_paiement,
        );
      }

      // Enregistrer dans les audits
      logAudit(
        "créer vente",
        "ventes",
        Number(venteId),
        `Vente #${venteId} créée pour ${sale.total}`,
        sale.utilisateur_id,
        sale.utilisateur_nom,
      );

      return { id: venteId, ...sale };
    })();
  } catch (error) {
    console.error("Erreur create sale:", error);
    throw error;
  }
}

export function getSalesByDate(startDate: string, endDate: string) {
  try {
    // Charger les ventes avec LIMIT 1000 pour éviter le crash
    const stmt = db.prepare(`
      SELECT v.*, c.nom as client_nom, s.nom as serveur_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN serveurs s ON v.serveur_id = s.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
      ORDER BY v.date_vente DESC
      LIMIT 1000
    `);
    const sales = stmt.all(startDate, endDate) as any[];

    if (sales.length === 0) {
      return [];
    }

    // Optimisation: charger tous les produits et paiements en 2 requêtes au lieu de N*2
    const saleIds = sales.map(s => s.id);

    const placeholders = saleIds.map(() => '?').join(',');
    const productsStmt = db.prepare(`
      SELECT vp.*, p.nom as nom_produit
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      WHERE vp.vente_id IN (${placeholders})
      ORDER BY vp.vente_id, vp.id
    `);

    const paymentsStmt = db.prepare(`
      SELECT * FROM paiements_clients
      WHERE vente_id IN (${placeholders})
      ORDER BY vente_id, date_paiement DESC
    `);

    const allProducts = productsStmt.all(...saleIds) as any[];
    const allPayments = paymentsStmt.all(...saleIds) as any[];

    // Grouper les résultats par vente_id
    const productsBySale: Record<number, any[]> = {};
    allProducts.forEach(prod => {
      if (!productsBySale[prod.vente_id]) {
        productsBySale[prod.vente_id] = [];
      }
      productsBySale[prod.vente_id].push(prod);
    });

    const paymentsBySale: Record<number, any[]> = {};
    allPayments.forEach(payment => {
      if (!paymentsBySale[payment.vente_id]) {
        paymentsBySale[payment.vente_id] = [];
      }
      paymentsBySale[payment.vente_id].push(payment);
    });

    return sales.map((sale) => ({
      ...sale,
      produits: productsBySale[sale.id] || [],
      paiements: paymentsBySale[sale.id] || [],
    }));
  } catch (error) {
    console.error("Erreur get sales by date:", error);
    throw error;
  }
}

export function deleteSale(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    return db.transaction(() => {
      const sale = db.prepare("SELECT * FROM ventes WHERE id = ?").get(id) as any;

      if (!sale) {
        throw new Error("Vente non trouvée");
      }

      const productsStmt = db.prepare(`
        SELECT vp.*, p.nom as nom_produit
        FROM ventes_produits vp
        JOIN produits p ON vp.produit_id = p.id
        WHERE vp.vente_id = ?
      `);
      const products = productsStmt.all(id) as any[];

      const updateStockStmt = db.prepare(`
        UPDATE produits SET quantite_stock = quantite_stock + ? WHERE id = ?
      `);

      for (const product of products) {
        updateStockStmt.run(product.quantite, product.produit_id);
      }

      if (sale.client_id && sale.montant_restant > 0) {
        const updateClientStmt = db.prepare(`
          UPDATE clients SET solde_du = solde_du - ? WHERE id = ?
        `);
        updateClientStmt.run(sale.montant_restant, sale.client_id);
      }

      const deleteComptaStmt = db.prepare(`
        DELETE FROM comptabilite WHERE type = 'vente' AND reference_id = ?
      `);
      deleteComptaStmt.run(id);

      const deleteVentesProduitsStmt = db.prepare(`
        DELETE FROM ventes_produits WHERE vente_id = ?
      `);
      deleteVentesProduitsStmt.run(id);

      const deletePaiementsStmt = db.prepare(`
        DELETE FROM paiements_clients WHERE vente_id = ?
      `);
      deletePaiementsStmt.run(id);

      const deleteInvoicesStmt = db.prepare(`
        DELETE FROM factures WHERE vente_id = ?
      `);
      deleteInvoicesStmt.run(id);

      const deleteSaleStmt = db.prepare("DELETE FROM ventes WHERE id = ?");
      const result = deleteSaleStmt.run(id);

      if (sale) {
        logAudit(
          "supprimer vente",
          "ventes",
          id,
          `Vente supprimée: ${sale.id} - Total: ${sale.total} - Produits restaurés: ${products.length}`,
          utilisateur_id,
          utilisateur_nom,
        );
      }

      return result;
    })();
  } catch (error) {
    console.error("Erreur delete sale:", error);
    throw error;
  }
}

// ===== STATISTIQUES =====

export function getDashboardStats() {
  try {
    // Total des ventes aujourd'hui
    const ventesJour = db
      .prepare(
        `
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventes
      WHERE DATE(date_vente) = DATE('now')
    `,
      )
      .get() as { total: number };

    // Total des ventes hier
    const ventesHier = db
      .prepare(
        `
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventes
      WHERE DATE(date_vente) = DATE('now', '-1 day')
    `,
      )
      .get() as { total: number };

    // Total des ventes ce mois
    const ventesMois = db
      .prepare(
        `
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventes
      WHERE strftime('%Y-%m', date_vente) = strftime('%Y-%m', 'now')
    `,
      )
      .get() as { total: number };

    // Total des ventes le mois précédent
    const ventesMoisPrecedent = db
      .prepare(
        `
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventes
      WHERE strftime('%Y-%m', date_vente) = strftime('%Y-%m', 'now', '-1 month')
    `,
      )
      .get() as { total: number };

    // Nombre total de produits
    const totalProduits = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM produits
    `,
      )
      .get() as { count: number };

    // Produits en stock faible
    const stockFaible = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM produits
      WHERE quantite_stock <= stock_min
    `,
      )
      .get() as { count: number };

    // Valeur totale du stock
    const valeurStock = db
      .prepare(
        `
      SELECT COALESCE(SUM(prix_achat * quantite_stock), 0) as valeur
      FROM produits
    `,
      )
      .get() as { valeur: number };

    // Nombre de ventes aujourd'hui
    const nbVentesJour = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM ventes
      WHERE DATE(date_vente) = DATE('now')
    `,
      )
      .get() as { count: number };

    // Profit total ce mois (somme des marges)
    const profitMois = db
      .prepare(
        `
      SELECT COALESCE(SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite), 0) as profit
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now')
    `,
      )
      .get() as { profit: number };

    // Coûts ce mois (prix d'achat des produits vendus)
    const coutsMois = db
      .prepare(
        `
      SELECT COALESCE(SUM(p.prix_achat * vp.quantite), 0) as couts
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now')
    `,
      )
      .get() as { couts: number };

    // Nombre de fournisseurs
    const nbFournisseurs = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM fournisseurs
    `,
      )
      .get() as { count: number };

    // Nombre de clients
    const nbClients = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM clients
    `,
      )
      .get() as { count: number };

    return {
      ventesJour: ventesJour.total,
      ventesHier: ventesHier.total,
      ventesMois: ventesMois.total,
      ventesMoisPrecedent: ventesMoisPrecedent.total,
      totalProduits: totalProduits.count,
      stockFaible: stockFaible.count,
      valeurStock: valeurStock.valeur,
      nbVentesJour: nbVentesJour.count,
      profitMois: profitMois.profit,
      coutsMois: coutsMois.couts,
      nbFournisseurs: nbFournisseurs.count,
      nbClients: nbClients.count,
    };
  } catch (error) {
    console.error("Erreur get dashboard stats:", error);
    throw error;
  }
}

export function getLowStockProducts() {
  try {
    const stmt = db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      WHERE p.quantite_stock <= p.stock_min
      ORDER BY p.quantite_stock ASC
      LIMIT 100
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get low stock products:", error);
    throw error;
  }
}

// ===== UTILISATEURS =====

export function login(email: string, password: string) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM utilisateurs
      WHERE email = ? AND mot_de_passe = ? AND actif = 1
    `);

    const user = stmt.get(email, password) as any;

    if (user) {
      // Update last login
      const updateStmt = db.prepare(`
        UPDATE utilisateurs SET last_login = CURRENT_TIMESTAMP WHERE id = ?
      `);
      updateStmt.run(user.id);

      // Don't return password
      delete user.mot_de_passe;
      return user;
    }
    return null;
  } catch (error) {
    console.error("Erreur login:", error);
    throw error;
  }
}

export function getUsers(limit: number = 500) {
  try {
    const stmt = db.prepare(`
      SELECT id, nom, email, role, actif, created_at, updated_at, last_login
      FROM utilisateurs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (error) {
    console.error("Erreur get users:", error);
    throw error;
  }
}

export function createUser(user: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      user.nom,
      user.email,
      user.mot_de_passe,
      user.role,
      user.actif ? 1 : 0,
    );

    const userId = result.lastInsertRowid;
    logAudit(
      "créer utilisateur",
      "utilisateurs",
      Number(userId),
      `Utilisateur: ${user.nom} (${user.email}) - Rôle: ${user.role}`,
      user.utilisateur_id,
      user.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create user:", error);
    throw error;
  }
}

export function updateUser(id: number, user: any) {
  try {
    const oldUser = db.prepare("SELECT * FROM utilisateurs WHERE id = ?").get(id) as any;

    if (!oldUser) {
      throw new Error("Utilisateur non trouvé");
    }

    const fields = [];
    const values = [];

    if (user.nom) {
      fields.push("nom = ?");
      values.push(user.nom);
    }
    if (user.email) {
      fields.push("email = ?");
      values.push(user.email);
    }
    if (user.mot_de_passe) {
      fields.push("mot_de_passe = ?");
      values.push(user.mot_de_passe);
    }
    if (user.role) {
      fields.push("role = ?");
      values.push(user.role);
    }
    if (user.actif !== undefined) {
      fields.push("actif = ?");
      values.push(user.actif ? 1 : 0);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = db.prepare(
      `UPDATE utilisateurs SET ${fields.join(", ")} WHERE id = ?`,
    );
    const result = stmt.run(...values);

    const changes = [];
    if (oldUser.nom !== user.nom && user.nom) changes.push(`nom: "${oldUser.nom}" → "${user.nom}"`);
    if (oldUser.email !== user.email && user.email) changes.push(`email: "${oldUser.email}" → "${user.email}"`);
    if (oldUser.role !== user.role && user.role) changes.push(`role: "${oldUser.role}" → "${user.role}"`);
    if (oldUser.actif !== user.actif && user.actif !== undefined) changes.push(`actif: ${oldUser.actif} → ${user.actif}`);

    const details = changes.length > 0
      ? `Modifications: ${changes.join(", ")}`
      : `Utilisateur: ${oldUser.nom}`;

    logAudit(
      "modifier utilisateur",
      "utilisateurs",
      id,
      details,
      user.utilisateur_id,
      user.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update user:", error);
    throw error;
  }
}

export function deleteUser(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const user = db.prepare("SELECT * FROM utilisateurs WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM utilisateurs WHERE id = ?");
    const result = stmt.run(id);

    if (user) {
      logAudit(
        "supprimer utilisateur",
        "utilisateurs",
        id,
        `Utilisateur supprimé: ${user.nom} (${user.email})`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete user:", error);
    throw error;
  }
}

// ===== FOURNISSEURS =====

export function getSuppliers() {
  try {
    const stmt = db.prepare("SELECT * FROM fournisseurs ORDER BY nom LIMIT 1000");
    return stmt.all();
  } catch (error) {
    console.error("Erreur get suppliers:", error);
    throw error;
  }
}

export function getSupplier(id: number) {
  try {
    const stmt = db.prepare("SELECT * FROM fournisseurs WHERE id = ?");
    return stmt.get(id);
  } catch (error) {
    console.error("Erreur get supplier:", error);
    throw error;
  }
}

export function createSupplier(supplier: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO fournisseurs (nom, telephone, email, adresse, ville, pays, commentaires)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      supplier.nom,
      supplier.telephone || null,
      supplier.email || null,
      supplier.adresse || null,
      supplier.ville || null,
      supplier.pays || null,
      supplier.commentaires || null,
    );

    const supplierId = result.lastInsertRowid;
    logAudit(
      "créer fournisseur",
      "fournisseurs",
      Number(supplierId),
      `Fournisseur: ${supplier.nom} - Téléphone: ${supplier.telephone || 'N/A'}`,
      supplier.utilisateur_id,
      supplier.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create supplier:", error);
    throw error;
  }
}

export function updateSupplier(id: number, supplier: any) {
  try {
    const oldSupplier = db.prepare("SELECT * FROM fournisseurs WHERE id = ?").get(id) as any;

    if (!oldSupplier) {
      throw new Error("Fournisseur non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE fournisseurs
      SET nom = ?, telephone = ?, email = ?, adresse = ?, ville = ?, pays = ?,
          commentaires = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(
      supplier.nom,
      supplier.telephone,
      supplier.email,
      supplier.adresse,
      supplier.ville,
      supplier.pays,
      supplier.commentaires,
      id,
    );

    const changes = [];
    if (oldSupplier.nom !== supplier.nom) changes.push(`nom: "${oldSupplier.nom}" → "${supplier.nom}"`);
    if (oldSupplier.telephone !== supplier.telephone) changes.push(`telephone: "${oldSupplier.telephone}" → "${supplier.telephone}"`);
    if (oldSupplier.email !== supplier.email) changes.push(`email: "${oldSupplier.email}" → "${supplier.email}"`);
    if (oldSupplier.adresse !== supplier.adresse) changes.push(`adresse: "${oldSupplier.adresse}" → "${supplier.adresse}"`);
    if (oldSupplier.ville !== supplier.ville) changes.push(`ville: "${oldSupplier.ville}" → "${supplier.ville}"`);

    const details = changes.length > 0
      ? `Modifications: ${changes.join(", ")}`
      : `Fournisseur: ${supplier.nom}`;

    logAudit(
      "modifier fournisseur",
      "fournisseurs",
      id,
      details,
      supplier.utilisateur_id,
      supplier.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update supplier:", error);
    throw error;
  }
}

export function deleteSupplier(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const supplier = db.prepare("SELECT * FROM fournisseurs WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM fournisseurs WHERE id = ?");
    const result = stmt.run(id);

    if (supplier) {
      logAudit(
        "supprimer fournisseur",
        "fournisseurs",
        id,
        `Fournisseur supprimé: ${supplier.nom}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete supplier:", error);
    throw error;
  }
}

// ===== ACHATS =====

export function getPurchases() {
  try {
    const stmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      ORDER BY a.date_achat DESC
      LIMIT 100
    `);
    const purchases = stmt.all() as any[];

    const prodStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id = ?
    `);

    return purchases.map((purchase) => ({
      ...purchase,
      produits: prodStmt.all(purchase.id),
    }));
  } catch (error) {
    console.error("Erreur get purchases:", error);
    throw error;
  }
}

export function createPurchase(purchase: any) {
  try {
    return db.transaction(() => {
      // Créer l'achat
      const purchaseStmt = db.prepare(`
        INSERT INTO achats (fournisseur_id, total, montant_paye, montant_restant, statut_paiement)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = purchaseStmt.run(
        purchase.fournisseur_id,
        purchase.total,
        purchase.montant_paye,
        purchase.montant_restant,
        purchase.statut_paiement,
      );

      const achatId = result.lastInsertRowid;

      // Ajouter les produits achetés
      const prodStmt = db.prepare(`
        INSERT INTO achats_produits (achat_id, produit_id, quantite, prix_unitaire, sous_total)
        VALUES (?, ?, ?, ?, ?)
      `);

      const updateStockStmt = db.prepare(`
        UPDATE produits SET quantite_stock = quantite_stock + ? WHERE id = ?
      `);

      for (const item of purchase.produits) {
        prodStmt.run(
          achatId,
          item.produit_id,
          item.quantite,
          item.prix_unitaire,
          item.sous_total,
        );

        // Incrémenter le stock
        updateStockStmt.run(item.quantite, item.produit_id);
      }

      // Mettre à jour le solde du fournisseur
      if (purchase.montant_restant > 0) {
        const updateSupplierStmt = db.prepare(`
          UPDATE fournisseurs SET solde_du = solde_du + ? WHERE id = ?
        `);
        updateSupplierStmt.run(
          purchase.montant_restant,
          purchase.fournisseur_id,
        );
      }

      // Enregistrer dans la comptabilité
      const comptaStmt = db.prepare(`
        INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
        VALUES (?, ?, ?, ?, ?, ?)
      `      );
      comptaStmt.run(
        "achat",
        achatId,
        `Achat #${achatId}`,
        purchase.montant_paye,
        "sortie",
        "especes",
      );

      // Log d'audit
      logAudit(
        "créer achat",
        "achats",
        Number(achatId),
        `Achat: ${purchase.fournisseur_nom} - Total: ${purchase.total} - ${purchase.produits?.length || 0} produit(s)`,
        purchase.utilisateur_id,
        purchase.utilisateur_nom,
      );

      return { id: achatId, ...purchase };
    })();
  } catch (error) {
    console.error("Erreur create purchase:", error);
    throw error;
  }
}

export function getPurchasesBySupplier(supplierId: number) {
  try {
    // Charger les achats avec LIMIT 1000 pour éviter le crash
    const stmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      WHERE a.fournisseur_id = ?
      ORDER BY a.date_achat DESC
      LIMIT 1000
    `);
    const purchases = stmt.all(supplierId) as any[];

    if (purchases.length === 0) {
      return [];
    }

    // Optimisation: charger tous les produits en 1 requête au lieu de N
    const purchaseIds = purchases.map(p => p.id);

    const placeholders = purchaseIds.map(() => '?').join(',');
    const productsStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id IN (${placeholders})
      ORDER BY ap.achat_id, ap.id
    `);

    const allProducts = productsStmt.all(...purchaseIds) as any[];

    // Grouper les produits par achat_id
    const productsByPurchase: Record<number, any[]> = {};
    allProducts.forEach(prod => {
      if (!productsByPurchase[prod.achat_id]) {
        productsByPurchase[prod.achat_id] = [];
      }
      productsByPurchase[prod.achat_id].push(prod);
    });

    return purchases.map((purchase) => ({
      ...purchase,
      produits: productsByPurchase[purchase.id] || [],
    }));
  } catch (error) {
    console.error("Erreur get purchases by supplier:", error);
    throw error;
  }
}

export function getSupplierDebts() {
  try {
    const stmt = db.prepare(`
      SELECT
        f.id as fournisseur_id,
        f.nom as fournisseur_nom,
        f.telephone,
        f.solde_du,
        COUNT(a.id) as nb_achats_impayes,
        SUM(a.montant_restant) as total_restant
      FROM fournisseurs f
      LEFT JOIN achats a ON f.id = a.fournisseur_id AND a.montant_restant > 0
      WHERE f.solde_du > 0
      GROUP BY f.id
      ORDER BY f.solde_du DESC
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get supplier debts:", error);
    throw error;
  }
}

export function getSupplierUnpaidPurchases(supplierId: number) {
  try {
    const stmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      WHERE a.fournisseur_id = ? AND a.montant_restant > 0
      ORDER BY a.date_achat DESC
    `);
    const purchases = stmt.all(supplierId) as any[];

    if (purchases.length === 0) {
      return [];
    }

    const purchaseIds = purchases.map(p => p.id);
    const placeholders = purchaseIds.map(() => '?').join(',');
    const productsStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id IN (${placeholders})
      ORDER BY ap.achat_id, ap.id
    `);

    const allProducts = productsStmt.all(...purchaseIds) as any[];

    const productsByPurchase: Record<number, any[]> = {};
    allProducts.forEach(prod => {
      if (!productsByPurchase[prod.achat_id]) {
        productsByPurchase[prod.achat_id] = [];
      }
      productsByPurchase[prod.achat_id].push(prod);
    });

    return purchases.map((purchase) => ({
      ...purchase,
      produits: productsByPurchase[purchase.id] || [],
    }));
  } catch (error) {
    console.error("Erreur get supplier unpaid purchases:", error);
    throw error;
  }
}

// ===== PAIEMENTS FOURNISSEURS =====

export function getSupplierPayments(purchaseId: number) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM paiements_fournisseurs
      WHERE achat_id = ?
      ORDER BY date_paiement DESC
    `);
    return stmt.all(purchaseId);
  } catch (error) {
    console.error("Erreur get supplier payments:", error);
    throw error;
  }
}

export function createSupplierPayment(payment: any) {
  try {
    return db.transaction(() => {
      // Enregistrer le paiement
      const stmt = db.prepare(`
        INSERT INTO paiements_fournisseurs (achat_id, fournisseur_id, montant, methode_paiement, reference, commentaire)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        payment.achat_id,
        payment.fournisseur_id,
        payment.montant,
        payment.methode_paiement,
        payment.reference || null,
        payment.commentaire || null,
      );

      // Mettre à jour l'achat
      const updatePurchaseStmt = db.prepare(`
        UPDATE achats
        SET montant_paye = montant_paye + ?,
            montant_restant = montant_restant - ?,
            statut_paiement = CASE
              WHEN montant_restant - ? <= 0 THEN 'paye'
              ELSE 'partiel'
            END
        WHERE id = ?
      `);
      updatePurchaseStmt.run(
        payment.montant,
        payment.montant,
        payment.montant,
        payment.achat_id,
      );

      // Mettre à jour le solde du fournisseur
      const updateSupplierStmt = db.prepare(`
        UPDATE fournisseurs SET solde_du = solde_du - ? WHERE id = ?
      `);
      updateSupplierStmt.run(payment.montant, payment.fournisseur_id);

      // Enregistrer dans la comptabilité
      const comptaStmt = db.prepare(`
        INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      comptaStmt.run(
        "paiement_fournisseur",
        result.lastInsertRowid,
        `Paiement fournisseur pour achat #${payment.achat_id}`,
        payment.montant,
        "sortie",
        payment.methode_paiement,
      );

      // Enregistrer dans les audits
      logAudit(
        "payer dette fournisseur",
        "paiements_fournisseurs",
        Number(result.lastInsertRowid),
        `Paiement de ${payment.montant} pour achat #${payment.achat_id} - Méthode: ${payment.methode_paiement}${payment.reference ? ` - Réf: ${payment.reference}` : ''}`,
        payment.utilisateur_id,
        payment.utilisateur_nom,
      );

      return result;
    })();
  } catch (error) {
    console.error("Erreur create supplier payment:", error);
    throw error;
  }
}

// ===== CLIENTS =====

export function getClients(limit: number = 1000) {
  try {
    const stmt = db.prepare("SELECT * FROM clients ORDER BY nom LIMIT ?");
    return stmt.all(limit);
  } catch (error) {
    console.error("Erreur get clients:", error);
    throw error;
  }
}

export function getClient(id: number) {
  try {
    const stmt = db.prepare("SELECT * FROM clients WHERE id = ?");
    return stmt.get(id);
  } catch (error) {
    console.error("Erreur get client:", error);
    throw error;
  }
}

export function createClient(client: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO clients (nom, telephone, email, adresse, ville)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      client.nom,
      client.telephone || null,
      client.email || null,
      client.adresse || null,
      client.ville || null,
    );

    const clientId = result.lastInsertRowid;
    logAudit(
      "créer client",
      "clients",
      Number(clientId),
      `Client: ${client.nom} - Téléphone: ${client.telephone || 'N/A'}`,
      client.utilisateur_id,
      client.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create client:", error);
    throw error;
  }
}

export function updateClient(id: number, client: any) {
  try {
    const oldClient = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;

    if (!oldClient) {
      throw new Error("Client non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE clients
      SET nom = ?, telephone = ?, email = ?, adresse = ?, ville = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(
      client.nom,
      client.telephone,
      client.email,
      client.adresse,
      client.ville,
      id,
    );

    const changes = [];
    if (oldClient.nom !== client.nom) changes.push(`nom: "${oldClient.nom}" → "${client.nom}"`);
    if (oldClient.telephone !== client.telephone) changes.push(`telephone: "${oldClient.telephone}" → "${client.telephone}"`);
    if (oldClient.email !== client.email) changes.push(`email: "${oldClient.email}" → "${client.email}"`);
    if (oldClient.adresse !== client.adresse) changes.push(`adresse: "${oldClient.adresse}" → "${client.adresse}"`);
    if (oldClient.ville !== client.ville) changes.push(`ville: "${oldClient.ville}" → "${client.ville}"`);

    const details = changes.length > 0
      ? `Modifications: ${changes.join(", ")}`
      : `Client: ${client.nom}`;

    logAudit(
      "modifier client",
      "clients",
      id,
      details,
      client.utilisateur_id,
      client.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update client:", error);
    throw error;
  }
}

export function deleteClient(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM clients WHERE id = ?");
    const result = stmt.run(id);

    if (client) {
      logAudit(
        "supprimer client",
        "clients",
        id,
        `Client supprimé: ${client.nom}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete client:", error);
    throw error;
  }
}

// ===== SERVEURS =====

export function getServers() {
  try {
    const stmt = db.prepare("SELECT * FROM serveurs ORDER BY nom");
    return stmt.all();
  } catch (error) {
    console.error("Erreur get servers:", error);
    throw error;
  }
}

export function getServer(id: number) {
  try {
    const stmt = db.prepare("SELECT * FROM serveurs WHERE id = ?");
    return stmt.get(id);
  } catch (error) {
    console.error("Erreur get server:", error);
    throw error;
  }
}

export function getActiveServers() {
  try {
    const stmt = db.prepare("SELECT * FROM serveurs WHERE actif = 1 ORDER BY nom");
    return stmt.all();
  } catch (error) {
    console.error("Erreur get active servers:", error);
    throw error;
  }
}

export function createServer(server: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO serveurs (nom, telephone, actif)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      server.nom,
      server.telephone || null,
      server.actif ? 1 : 0,
    );

    const serverId = result.lastInsertRowid;
    logAudit(
      "créer serveur",
      "serveurs",
      Number(serverId),
      `Serveur: ${server.nom} - Téléphone: ${server.telephone || 'N/A'} - Actif: ${server.actif}`,
      server.utilisateur_id,
      server.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create server:", error);
    throw error;
  }
}

export function updateServer(id: number, server: any) {
  try {
    const oldServer = db.prepare("SELECT * FROM serveurs WHERE id = ?").get(id) as any;

    if (!oldServer) {
      throw new Error("Serveur non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE serveurs
      SET nom = ?, telephone = ?, actif = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(
      server.nom,
      server.telephone,
      server.actif ? 1 : 0,
      id,
    );

    const changes = [];
    if (oldServer.nom !== server.nom) changes.push(`nom: "${oldServer.nom}" → "${server.nom}"`);
    if (oldServer.telephone !== server.telephone) changes.push(`telephone: "${oldServer.telephone}" → "${server.telephone}"`);
    if (oldServer.actif !== server.actif) changes.push(`actif: ${oldServer.actif} → ${server.actif}`);

    const details = changes.length > 0
      ? `Modifications: ${changes.join(", ")}`
      : `Serveur: ${server.nom}`;

    logAudit(
      "modifier serveur",
      "serveurs",
      id,
      details,
      server.utilisateur_id,
      server.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update server:", error);
    throw error;
  }
}

export function deleteServer(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const server = db.prepare("SELECT * FROM serveurs WHERE id = ?").get(id) as any;
    const stmt = db.prepare("DELETE FROM serveurs WHERE id = ?");
    const result = stmt.run(id);

    if (server) {
      logAudit(
        "supprimer serveur",
        "serveurs",
        id,
        `Serveur supprimé: ${server.nom}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete server:", error);
    throw error;
  }
}

// ===== PAIEMENTS CLIENTS =====

export function getCustomerPayments(saleId: number) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM paiements_clients
      WHERE vente_id = ?
      ORDER BY date_paiement DESC
    `);
    return stmt.all(saleId);
  } catch (error) {
    console.error("Erreur get customer payments:", error);
    throw error;
  }
}

export function createCustomerPayment(payment: any) {
  try {
    return db.transaction(() => {
      // Enregistrer le paiement
      const stmt = db.prepare(`
        INSERT INTO paiements_clients (vente_id, client_id, montant, methode_paiement, reference, commentaire)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        payment.vente_id,
        payment.client_id || null,
        payment.montant,
        payment.methode_paiement,
        payment.reference || null,
        payment.commentaire || null,
      );

      // Mettre à jour la vente
      const updateSaleStmt = db.prepare(`
        UPDATE ventes
        SET montant_paye = montant_paye + ?,
            montant_restant = montant_restant - ?,
            statut_paiement = CASE
              WHEN montant_restant - ? <= 0 THEN 'paye'
              ELSE 'partiel'
            END
        WHERE id = ?
      `);
      updateSaleStmt.run(
        payment.montant,
        payment.montant,
        payment.montant,
        payment.vente_id,
      );

      // Mettre à jour le solde du client si applicable
      if (payment.client_id) {
        const updateClientStmt = db.prepare(`
          UPDATE clients SET solde_du = solde_du - ? WHERE id = ?
        `);
        updateClientStmt.run(payment.montant, payment.client_id);
      }

      // Enregistrer dans la comptabilité
      const comptaStmt = db.prepare(`
        INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      comptaStmt.run(
        "paiement_client",
        result.lastInsertRowid,
        `Paiement client pour vente #${payment.vente_id}`,
        payment.montant,
        "entree",
        payment.methode_paiement,
      );

      return result;
    })();
  } catch (error) {
    console.error("Erreur create customer payment:", error);
    throw error;
  }
}

// ===== COMPTABILITÉ =====

export function getAccountingEntries(startDate?: string, endDate?: string) {
  try {
    let query = "SELECT * FROM comptabilite";
    const params: any[] = [];

    if (startDate && endDate) {
      query += " WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    query += " ORDER BY created_at DESC LIMIT 500";

    const stmt = db.prepare(query);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  } catch (error) {
    console.error("Erreur get accounting entries:", error);
    throw error;
  }
}

export function getAccountingEntriesPaginated(page: number = 1, limit: number = 20, startDate?: string, endDate?: string) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = '';
    let params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)';
      params.push(startDate, endDate);
    }

    // Count total
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM comptabilite ${whereClause}`);
    const { total } = (params.length > 0 ? countStmt.get(...params) : countStmt.get()) as { total: number };

    // Get paginated data
    const dataStmt = db.prepare(`
      SELECT * FROM comptabilite
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const data = params.length > 0
      ? dataStmt.all(...params, limit, offset)
      : dataStmt.all(limit, offset);

    // Calculate totals for the filtered period (not just the page)
    const totalsStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type_mouvement = 'entree' THEN montant ELSE 0 END), 0) as totalEntrees,
        COALESCE(SUM(CASE WHEN type_mouvement = 'sortie' THEN montant ELSE 0 END), 0) as totalSorties
      FROM comptabilite
      ${whereClause}
    `);
    const totals = (params.length > 0 ? totalsStmt.get(...params) : totalsStmt.get()) as { totalEntrees: number; totalSorties: number };

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalEntrees: totals.totalEntrees,
      totalSorties: totals.totalSorties
    };
  } catch (error) {
    console.error("Erreur get accounting entries paginated:", error);
    throw error;
  }
}

export function getTreasury() {
  try {
    const entrees = db
      .prepare(
        `
      SELECT COALESCE(SUM(montant), 0) as total
      FROM comptabilite
      WHERE type_mouvement = 'entree'
    `,
      )
      .get() as { total: number };

    const sorties = db
      .prepare(
        `
      SELECT COALESCE(SUM(montant), 0) as total
      FROM comptabilite
      WHERE type_mouvement = 'sortie'
    `,
      )
      .get() as { total: number };

    const recentEntries = db
      .prepare(
        `
      SELECT * FROM comptabilite
      ORDER BY created_at DESC
      LIMIT 20
    `,
      )
      .all();

    return {
      total: entrees.total - sorties.total,
      entries: recentEntries,
    };
  } catch (error) {
    console.error("Erreur get treasury:", error);
    throw error;
  }
}

// ===== FACTURES =====

export function createInvoice(invoice: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO factures (numero, vente_id, date_facture, heure_facture, vendeur, client_nom, serveur_nom, total_ttc, methode_paiement, montant_paye, monnaie_rendue, remise_type, remise_valeur, total_avant_remise, articles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoice.numero,
      invoice.vente_id,
      invoice.date_facture,
      invoice.heure_facture,
      invoice.vendeur,
      invoice.client_nom || "Client comptoir",
      invoice.serveur_nom || null,
      invoice.total_ttc,
      invoice.methode_paiement,
      invoice.montant_paye,
      invoice.monnaie_rendue || 0,
      invoice.remise_type || null,
      invoice.remise_valeur || 0,
      invoice.total_avant_remise || null,
      JSON.stringify(invoice.articles),
    );

    return { id: result.lastInsertRowid, ...invoice };
  } catch (error) {
    console.error("Erreur create invoice:", error);
    throw error;
  }
}

export function getInvoices() {
  try {
    const stmt = db.prepare(`
      SELECT f.*, v.client_id
      FROM factures f
      LEFT JOIN ventes v ON f.vente_id = v.id
      ORDER BY f.created_at DESC
      LIMIT 100
    `);
    const invoices = stmt.all() as any[];

    return invoices.map((invoice) => ({
      ...invoice,
      articles: JSON.parse(invoice.articles),
    }));
  } catch (error) {
    console.error("Erreur get invoices:", error);
    throw error;
  }
}

export function getInvoice(id: number) {
  try {
    const stmt = db.prepare(`
      SELECT f.*, v.client_id
      FROM factures f
      LEFT JOIN ventes v ON f.vente_id = v.id
      WHERE f.id = ?
    `);
    const invoice = stmt.get(id) as any;

    if (invoice) {
      invoice.articles = JSON.parse(invoice.articles);
    }

    return invoice;
  } catch (error) {
    console.error("Erreur get invoice:", error);
    throw error;
  }
}

export function getInvoiceByVenteId(venteId: number) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM factures WHERE vente_id = ?
    `);
    const invoice = stmt.get(venteId) as any;

    if (invoice) {
      invoice.articles = JSON.parse(invoice.articles);
    }

    return invoice;
  } catch (error) {
    console.error("Erreur get invoice by vente id:", error);
    throw error;
  }
}

export function getInvoiceByNumero(numero: string) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM factures WHERE numero = ?
    `);
    const invoice = stmt.get(numero) as any;

    if (invoice) {
      invoice.articles = JSON.parse(invoice.articles);
    }

    return invoice;
  } catch (error) {
    console.error("Erreur get invoice by numero:", error);
    throw error;
  }
}

export function getInvoicesByDate(startDate: string, endDate: string) {
  try {
    const stmt = db.prepare(`
      SELECT * FROM factures
      WHERE date_facture BETWEEN ? AND ?
      ORDER BY created_at DESC
      LIMIT 1000
    `);
    const invoices = stmt.all(startDate, endDate) as any[];

    return invoices.map((invoice) => ({
      ...invoice,
      articles: JSON.parse(invoice.articles),
    }));
  } catch (error) {
    console.error("Erreur get invoices by date:", error);
    throw error;
  }
}

export function getConfiguration() {
  try {
    const stmt = db.prepare("SELECT * FROM configuration WHERE id = 1");
    const config = stmt.get() as any;

    if (!config) {
      return {
        id: 1,
        nom_entreprise: "Mon Entreprise",
        logo_url: null,
        adresse: "",
        telephone: "",
        telephone2: "",
        email: "",
        nif: "",
        ville: "",
        pays: "",
        devise: "FCFA",
        message_pied: "Merci de votre visite !",
        support_text: "",
        format_facture: "80mm",
      };
    }

    return config;
  } catch (error) {
    console.error("Erreur get configuration:", error);
    throw error;
  }
}

export function updateConfiguration(config: any) {
  try {
    const checkStmt = db.prepare("SELECT id FROM configuration WHERE id = 1");
    const exists = checkStmt.get();

    if (exists) {
      const stmt = db.prepare(`
        UPDATE configuration
        SET nom_entreprise = ?, logo_url = ?, adresse = ?, telephone = ?, telephone2 = ?, email = ?, nif = ?, ville = ?, pays = ?, devise = ?, message_pied = ?, support_text = ?, format_facture = ?
        WHERE id = 1
      `);
      stmt.run(
        config.nom_entreprise,
        config.logo_url || null,
        config.adresse || "",
        config.telephone || "",
        config.telephone2 || "",
        config.email || "",
        config.nif || "",
        config.ville || "",
        config.pays || "",
        config.devise || "FCFA",
        config.message_pied || "Merci de votre visite !",
        config.support_text || "",
        config.format_facture || "80mm",
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO configuration (id, nom_entreprise, logo_url, adresse, telephone, telephone2, email, nif, ville, pays, devise, message_pied, support_text, format_facture)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        config.nom_entreprise,
        config.logo_url || null,
        config.adresse || "",
        config.telephone || "",
        config.telephone2 || "",
        config.email || "",
        config.nif || "",
        config.ville || "",
        config.pays || "",
        config.devise || "FCFA",
        config.message_pied || "Merci de votre visite !",
        config.support_text || "",
        config.format_facture || "80mm",
      );
    }

    return getConfiguration();
  } catch (error) {
    console.error("Erreur update configuration:", error);
    throw error;
  }
}

export function updateSale(id: number, sale: any) {
  try {
    db.transaction(() => {
      const venteStmt = db.prepare(`
        UPDATE ventes
        SET client_id = ?, serveur_id = ?, total = ?, montant_paye = ?, montant_restant = ?, monnaie_rendue = ?, statut_paiement = ?, methode_paiement = ?
        WHERE id = ?
      `);
      venteStmt.run(
        sale.client_id || null,
        sale.serveur_id || null,
        sale.total,
        sale.montant_paye,
        sale.montant_restant || 0,
        sale.monnaie_rendue || 0,
        sale.statut_paiement || "paye",
        sale.methode_paiement,
        id,
      );

      const deleteStmt = db.prepare("DELETE FROM ventes_produits WHERE vente_id = ?");
      deleteStmt.run(id);

      const insertStmt = db.prepare(`
        INSERT INTO ventes_produits (vente_id, produit_id, quantite, prix_unitaire, sous_total)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of sale.produits) {
        insertStmt.run(id, item.produit_id, item.quantite, item.prix_unitaire, item.sous_total);
      }
    })();

    return { id, ...sale };
  } catch (error) {
    console.error("Erreur update sale:", error);
    throw error;
  }
}

// ===== AUDIT LOGS =====

export function createAuditLog(log: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (utilisateur_id, utilisateur_nom, action, table_cible, enregistrement_id, details, adresse_ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      log.utilisateur_id || null,
      log.utilisateur_nom || "Système",
      log.action,
      log.table_cible || null,
      log.enregistrement_id || null,
      log.details || null,
      log.adresse_ip || null,
      log.user_agent || null,
    );
  } catch (error) {
    console.error("Erreur création log audit:", error);
    throw error;
  }
}

export function logAudit(action: string, table: string, recordId?: number, details?: string, userId?: number, userName?: string) {
  try {
    createAuditLog({
      utilisateur_id: userId,
      utilisateur_nom: userName,
      action,
      table_cible: table,
      enregistrement_id: recordId,
      details,
    });
  } catch (error) {
    console.error("Erreur log audit:", error);
  }
}

export function getAuditLogs(limit: number = 100) {
  try {
    const stmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (error) {
    console.error("Erreur get audit logs:", error);
    throw error;
  }
}

export function getAuditLogsByUser(utilisateurId: number, limit: number = 100) {
  try {
    const stmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      WHERE al.utilisateur_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `);
    return stmt.all(utilisateurId, limit);
  } catch (error) {
    console.error("Erreur get audit logs by user:", error);
    throw error;
  }
}

export function getAuditLogsByDate(startDate: string, endDate: string) {
  try {
    const stmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      WHERE DATE(al.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY al.created_at DESC
      LIMIT 500
    `);
    return stmt.all(startDate, endDate);
  } catch (error) {
    console.error("Erreur get audit logs by date:", error);
    throw error;
  }
}

export function getAuditLogsByTable(table: string, limit: number = 100) {
  try {
    const stmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      WHERE al.table_cible = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `);
    return stmt.all(table, limit);
  } catch (error) {
    console.error("Erreur get audit logs by table:", error);
    throw error;
  }
}

// ===== BACKUP & RESTAURATION =====

export function backupDatabase() {
  try {
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "data");
    const dbPath = path.join(dbDir, "gestion_stock.db");

    if (!fs.existsSync(dbPath)) {
      throw new Error("Base de données introuvable");
    }

    const backupsDir = path.join(userDataPath, "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupsDir, `backup-${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    return { success: true, backupPath, timestamp };
  } catch (error) {
    console.error("Erreur backup database:", error);
    throw error;
  }
}

export function restoreDatabase(backupFilePath: string) {
  try {
    const userDataPath = app.getPath("userData");
    const dbDir = path.join(userDataPath, "data");
    const dbPath = path.join(dbDir, "gestion_stock.db");

    if (!fs.existsSync(backupFilePath)) {
      throw new Error("Fichier de backup introuvable");
    }

    // Fermer la connexion à la base de données
    closeDatabase();

    // Supprimer l'ancienne base de données
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Copier le backup
    fs.copyFileSync(backupFilePath, dbPath);

    return { success: true, message: "Base de données restaurée avec succès" };
  } catch (error) {
    console.error("Erreur restore database:", error);
    // Réouvrir la base de données en cas d'erreur
    reopenDatabase();
    throw error;
  }
}

export function getBackups() {
  try {
    const userDataPath = app.getPath("userData");
    const backupsDir = path.join(userDataPath, "backups");

    if (!fs.existsSync(backupsDir)) {
      return [];
    }

    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith("backup-") && file.endsWith(".db"))
      .map(file => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          formattedSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          formattedDate: stats.birthtime.toLocaleString("fr-FR"),
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return files;
  } catch (error) {
    console.error("Erreur get backups:", error);
    throw error;
  }
}

export function deleteBackup(filename: string) {
  try {
    const userDataPath = app.getPath("userData");
    const backupsDir = path.join(userDataPath, "backups");
    const backupPath = path.join(backupsDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error("Fichier de backup introuvable");
    }

    fs.unlinkSync(backupPath);

    return { success: true };
  } catch (error) {
    console.error("Erreur delete backup:", error);
    throw error;
  }
}

export function getPurchase(id: number) {
  try {
    const stmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      WHERE a.id = ?
    `);
    const purchase = stmt.get(id) as any;

    if (!purchase) {
      throw new Error("Achat introuvable");
    }

    const prodStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id = ?
    `);

    return {
      ...purchase,
      produits: prodStmt.all(id),
    };
  } catch (error) {
    console.error("Erreur get purchase:", error);
    throw error;
  }
}

export function deletePurchase(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const purchase = db.prepare("SELECT * FROM achats WHERE id = ?").get(id) as any;

    if (!purchase) {
      throw new Error("Achat introuvable");
    }

    const stmt = db.prepare("DELETE FROM achats WHERE id = ?");
    const result = stmt.run(id);

    logAudit(
      "supprimer achat",
      "achats",
      id,
      `Achat supprimé: ${purchase.fournisseur_nom} - Total: ${purchase.total}`,
      utilisateur_id,
      utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur delete purchase:", error);
    throw error;
  }
}

export function updateInvoice(id: number, invoice: any) {
  try {
    const oldInvoice = db.prepare("SELECT * FROM factures WHERE id = ?").get(id) as any;

    if (!oldInvoice) {
      throw new Error("Facture introuvable");
    }

    const stmt = db.prepare(`
      UPDATE factures
      SET client_nom = ?, total_ttc = ?, methode_paiement = ?, montant_paye = ?, monnaie_rendue = ?, articles = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      invoice.client_nom || oldInvoice.client_nom,
      invoice.total_ttc,
      invoice.methode_paiement,
      invoice.montant_paye,
      invoice.monnaie_rendue || 0,
      JSON.stringify(invoice.articles),
      id,
    );

    logAudit(
      "modifier facture",
      "factures",
      id,
      `Facture ${invoice.numero} modifiée`,
      invoice.utilisateur_id,
      invoice.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update invoice:", error);
    throw error;
  }
}

export function deleteInvoice(id: number, utilisateur_id?: number, utilisateur_nom?: string) {
  try {
    const invoice = db.prepare("SELECT * FROM factures WHERE id = ?").get(id) as any;

    if (!invoice) {
      throw new Error("Facture introuvable");
    }

    const stmt = db.prepare("DELETE FROM factures WHERE id = ?");
    const result = stmt.run(id);

    logAudit(
      "supprimer facture",
      "factures",
      id,
      `Facture ${invoice.numero} supprimée - Total: ${invoice.total_ttc}`,
      utilisateur_id,
      utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur delete invoice:", error);
    throw error;
  }
}

// ===== SERVER-SIDE PAGINATION FUNCTIONS =====

// Recherche FTS5 ultra-rapide (pour autocomplete/dropdowns)
export function searchProductsFTS(query: string, limit: number = 50): any[] {
  try {
    if (!query || !query.trim()) {
      return [];
    }

    const searchTerm = query.trim();

    // Essayer FTS5 en premier (ultra-rapide)
    try {
      const ftsStmt = db.prepare(`
        SELECT p.*, c.nom as categorie_nom
        FROM produits_fts pf
        JOIN produits p ON p.id = pf.rowid
        LEFT JOIN categories c ON p.categorie_id = c.id
        WHERE produits_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const results = ftsStmt.all(searchTerm, limit);
      return results;
    } catch (ftsError) {
      // Fallback vers LIKE si FTS5 non disponible
      const likeStmt = db.prepare(`
        SELECT p.*, c.nom as categorie_nom
        FROM produits p
        LEFT JOIN categories c ON p.categorie_id = c.id
        WHERE p.nom LIKE ? OR p.code_barre LIKE ?
        ORDER BY p.nom
        LIMIT ?
      `);
      const searchTermLike = `%${searchTerm}%`;
      const results = likeStmt.all(searchTermLike, searchTermLike, limit);
      return results;
    }
  } catch (error) {
    console.error("Erreur search products FTS:", error);
    return [];
  }
}

// Helper pour obtenir le COUNT ultra-rapide depuis la table metadata
function getFastCount(tableName: string, whereClause: string = '', params: any[] = []): number {
  if (!whereClause) {
    // COUNT simple : utiliser la table metadata (O(1))
    try {
      const key = `${tableName}_count`;
      const result = db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: number } | undefined;
      if (result) {
        return result.value;
      }
    } catch (error) {
      console.log("Metadata non disponible, fallback vers COUNT(*)");
    }
  }

  // COUNT avec filtres ou fallback : utiliser COUNT(*) classique
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`);
  const { total } = countStmt.get(...params) as { total: number };
  return total;
}

export function getProductsPaginated(page: number = 1, limit: number = 10, search?: string) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = '';
    let params: any[] = [];

    // Optimisation FTS5 pour recherche rapide
    if (search && search.trim()) {
      const searchQuery = search.trim();
      // Essayer d'abord FTS5 si disponible
      try {
        const ftsStmt = db.prepare(`
          SELECT p.id, snippet(produits_fts, 0, '<mark>', '</mark>', '...', 20) as snippet
          FROM produits_fts pf
          JOIN produits p ON p.id = pf.rowid
          WHERE produits_fts MATCH ?
          ORDER BY rank
          LIMIT ? OFFSET ?
        `);
        const ftsData = ftsStmt.all(searchQuery, limit, offset);

        if (ftsData.length > 0) {
          const ids = ftsData.map((row: any) => row.id);
          const idList = ids.join(',');

          const fullDataStmt = db.prepare(`
            SELECT p.*, c.nom as categorie_nom
            FROM produits p
            LEFT JOIN categories c ON p.categorie_id = c.id
            WHERE p.id IN (${idList})
            ORDER BY p.id DESC
          `);
          const data = fullDataStmt.all();

          return {
            data,
            total: data.length,
            page,
            limit,
            totalPages: Math.ceil(data.length / limit)
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      whereClause = 'WHERE (p.nom LIKE ? OR p.code_barre = ?)';
      params = [searchTerm, searchQuery];
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM produits p
      ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    const dataStmt = db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get products paginated:", error);
    throw error;
  }
}

export function getInvoicesPaginated(page: number = 1, limit: number = 10, search?: string) {
  try {
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      const searchQuery = search.trim();
      const searchTerm = `%${searchQuery}%`;
      const whereClause = 'WHERE f.numero LIKE ? OR f.client_nom LIKE ?';
      const params = [searchTerm, searchTerm];

      const total = getFastCount('factures f', whereClause, params);

      const dataStmt = db.prepare(`
        SELECT f.* FROM factures f
        ${whereClause}
        ORDER BY f.date_facture DESC, f.id DESC
        LIMIT ? OFFSET ?
      `);
      const data = dataStmt.all(...params, limit, offset) as any[];

      return {
        data: data.map((invoice) => ({
          ...invoice,
          articles: JSON.parse(invoice.articles),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const total = getFastCount('factures');

    const dataStmt = db.prepare(`
      SELECT f.* FROM factures f
      ORDER BY f.date_facture DESC, f.id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset) as any[];

    return {
      data: data.map((invoice) => ({
        ...invoice,
        articles: JSON.parse(invoice.articles),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get invoices paginated:", error);
    throw error;
  }
}

export function getSalesPaginated(page: number = 1, limit: number = 10, startDate?: string, endDate?: string) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = '';
    let params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)';
      params = [startDate, endDate];
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM ventes v
      ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    // Charger les ventes avec pagination
    const dataStmt = db.prepare(`
      SELECT v.*, c.nom as client_nom, s.nom as serveur_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN serveurs s ON v.serveur_id = s.id
      ${whereClause}
      ORDER BY v.date_vente DESC
      LIMIT ? OFFSET ?
    `);
    const sales = dataStmt.all(...params, limit, offset) as any[];

    // Optimisation: charger tous les produits et paiements en 2 requêtes au lieu de N*2
    const saleIds = sales.map(s => s.id);
    if (saleIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const placeholders = saleIds.map(() => '?').join(',');
    const productsStmt = db.prepare(`
      SELECT vp.*, p.nom as nom_produit
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      WHERE vp.vente_id IN (${placeholders})
      ORDER BY vp.vente_id, vp.id
    `);

    const paymentsStmt = db.prepare(`
      SELECT * FROM paiements_clients
      WHERE vente_id IN (${placeholders})
      ORDER BY vente_id, date_paiement DESC
    `);

    const allProducts = productsStmt.all(...saleIds) as any[];
    const allPayments = paymentsStmt.all(...saleIds) as any[];

    // Grouper les résultats par vente_id
    const productsBySale: Record<number, any[]> = {};
    allProducts.forEach(prod => {
      if (!productsBySale[prod.vente_id]) {
        productsBySale[prod.vente_id] = [];
      }
      productsBySale[prod.vente_id].push(prod);
    });

    const paymentsBySale: Record<number, any[]> = {};
    allPayments.forEach(payment => {
      if (!paymentsBySale[payment.vente_id]) {
        paymentsBySale[payment.vente_id] = [];
      }
      paymentsBySale[payment.vente_id].push(payment);
    });

    return {
      data: sales.map((sale) => ({
        ...sale,
        produits: productsBySale[sale.id] || [],
        paiements: paymentsBySale[sale.id] || [],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get sales paginated:", error);
    throw error;
  }
}

export function getClientsPaginated(page: number = 1, limit: number = 10, search?: string) {
  try {
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      const searchQuery = search.trim();
      try {
        const ftsStmt = db.prepare(`
          SELECT c.id, snippet(clients_fts, 0, '<mark>', '</mark>', '...', 20) as snippet
          FROM clients_fts cf
          JOIN clients c ON c.id = cf.rowid
          WHERE clients_fts MATCH ?
          ORDER BY c.nom ASC
          LIMIT ? OFFSET ?
        `);
        const ftsData = ftsStmt.all(searchQuery, limit, offset);

        if (ftsData.length > 0) {
          const ids = ftsData.map((row: any) => row.id);
          const idList = ids.join(',');

          const fullDataStmt = db.prepare(`
            SELECT * FROM clients
            WHERE id IN (${idList})
            ORDER BY nom ASC
          `);
          const data = fullDataStmt.all();

          return {
            data,
            total: data.length,
            page,
            limit,
            totalPages: Math.ceil(data.length / limit)
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause = 'WHERE nom LIKE ? OR telephone LIKE ? OR email LIKE ?';
      const params = [searchTerm, searchTerm, searchTerm];

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM clients ${whereClause}`);
      const { total } = countStmt.get(...params) as { total: number };

      const dataStmt = db.prepare(`
        SELECT * FROM clients
        ${whereClause}
        ORDER BY nom ASC, id DESC
        LIMIT ? OFFSET ?
      `);
      const data = dataStmt.all(...params, limit, offset);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const countStmt = db.prepare('SELECT COUNT(*) as total FROM clients');
    const { total } = countStmt.get() as { total: number };

    const dataStmt = db.prepare(`
      SELECT * FROM clients
      ORDER BY nom ASC, id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get clients paginated:", error);
    throw error;
  }
}

export function getUsersPaginated(page: number = 1, limit: number = 10, search?: string) {
  try {
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      const searchQuery = search.trim();
      try {
        const ftsStmt = db.prepare(`
          SELECT u.id, snippet(utilisateurs_fts, 0, '<mark>', '</mark>', '...', 20) as snippet
          FROM utilisateurs_fts uf
          JOIN utilisateurs u ON u.id = uf.rowid
          WHERE utilisateurs_fts MATCH ?
          ORDER BY u.created_at DESC
          LIMIT ? OFFSET ?
        `);
        const ftsData = ftsStmt.all(searchQuery, limit, offset);

        if (ftsData.length > 0) {
          const ids = ftsData.map((row: any) => row.id);
          const idList = ids.join(',');

          const fullDataStmt = db.prepare(`
            SELECT id, nom, email, role, actif, created_at, updated_at, last_login
            FROM utilisateurs
            WHERE id IN (${idList})
            ORDER BY created_at DESC
          `);
          const data = fullDataStmt.all();

          return {
            data,
            total: data.length,
            page,
            limit,
            totalPages: Math.ceil(data.length / limit)
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause = 'WHERE nom LIKE ? OR email LIKE ? OR role LIKE ?';
      const params = [searchTerm, searchTerm, searchTerm];

      const total = getFastCount('utilisateurs', whereClause, params);

      const dataStmt = db.prepare(`
        SELECT id, nom, email, role, actif, created_at, updated_at, last_login
        FROM utilisateurs
        ${whereClause}
        ORDER BY nom ASC, id DESC
        LIMIT ? OFFSET ?
      `);
      const data = dataStmt.all(...params, limit, offset);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const total = getFastCount('utilisateurs');

    const dataStmt = db.prepare(`
      SELECT id, nom, email, role, actif, created_at, updated_at, last_login
      FROM utilisateurs
      ORDER BY nom ASC, id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get users paginated:", error);
    throw error;
  }
}

export function getAuditLogsPaginated(page: number = 1, limit: number = 20, filters?: { startDate?: string; endDate?: string; table?: string; search?: string }) {
  try {
    const offset = (page - 1) * limit;
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters?.startDate && filters?.endDate) {
      whereClauses.push('DATE(al.created_at) BETWEEN DATE(?) AND DATE(?)');
      params.push(filters.startDate, filters.endDate);
    }

    if (filters?.table) {
      whereClauses.push('al.table_cible = ?');
      params.push(filters.table);
    }

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      whereClauses.push('(al.utilisateur_nom LIKE ? OR al.action LIKE ? OR al.table_cible LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const total = getFastCount('audit_logs al', whereClause, params);

    const dataStmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get audit logs paginated:", error);
    throw error;
  }
}

export function getSuppliersPaginated(page: number = 1, limit: number = 10, search?: string) {
  try {
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      const searchQuery = search.trim();
      try {
        const ftsStmt = db.prepare(`
          SELECT f.id, snippet(fournisseurs_fts, 0, '<mark>', '</mark>', '...', 20) as snippet
          FROM fournisseurs_fts ff
          JOIN fournisseurs f ON f.id = ff.rowid
          WHERE fournisseurs_fts MATCH ?
          ORDER BY f.nom ASC
          LIMIT ? OFFSET ?
        `);
        const ftsData = ftsStmt.all(searchQuery, limit, offset);

        if (ftsData.length > 0) {
          const ids = ftsData.map((row: any) => row.id);
          const idList = ids.join(',');

          const fullDataStmt = db.prepare(`
            SELECT * FROM fournisseurs
            WHERE id IN (${idList})
            ORDER BY nom ASC
          `);
          const data = fullDataStmt.all();

          return {
            data,
            total: data.length,
            page,
            limit,
            totalPages: Math.ceil(data.length / limit)
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause = 'WHERE nom LIKE ? OR telephone LIKE ? OR email LIKE ?';
      const params = [searchTerm, searchTerm, searchTerm];

      const total = getFastCount('fournisseurs', whereClause, params);

      const dataStmt = db.prepare(`
        SELECT * FROM fournisseurs
        ${whereClause}
        ORDER BY nom ASC, id DESC
        LIMIT ? OFFSET ?
      `);
      const data = dataStmt.all(...params, limit, offset);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const total = getFastCount('fournisseurs');

    const dataStmt = db.prepare(`
      SELECT * FROM fournisseurs
      ORDER BY nom ASC, id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get suppliers paginated:", error);
    throw error;
  }
}

export function getPurchasesPaginated(page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit;

    const total = getFastCount('achats');

    // Charger les achats avec pagination
    const dataStmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      ORDER BY a.date_achat DESC, a.id DESC
      LIMIT ? OFFSET ?
    `);
    const purchases = dataStmt.all(limit, offset) as any[];

    // Optimisation: charger tous les produits en 1 requête au lieu de N
    const purchaseIds = purchases.map(p => p.id);
    if (purchaseIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    const placeholders = purchaseIds.map(() => '?').join(',');
    const productsStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id IN (${placeholders})
      ORDER BY ap.achat_id, ap.id
    `);

    const allProducts = productsStmt.all(...purchaseIds) as any[];

    // Grouper les produits par achat_id
    const productsByPurchase: Record<number, any[]> = {};
    allProducts.forEach(prod => {
      if (!productsByPurchase[prod.achat_id]) {
        productsByPurchase[prod.achat_id] = [];
      }
      productsByPurchase[prod.achat_id].push(prod);
    });

    return {
      data: purchases.map((purchase) => ({
        ...purchase,
        produits: productsByPurchase[purchase.id] || [],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get purchases paginated:", error);
    throw error;
  }
}

export function getServersPaginated(page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit;

    const total = getFastCount('serveurs');

    const dataStmt = db.prepare(`
      SELECT * FROM serveurs
      ORDER BY nom ASC, id DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Erreur get servers paginated:", error);
    throw error;
  }
}

// ===== AUTOMATED PURGE & ARCHIVAL FUNCTIONS =====

export interface PurgeConfig {
  auditLogsRetentionDays: number;
  salesRetentionDays: number;
  purchasesRetentionDays: number;
  enabled: boolean;
}

const defaultPurgeConfig: PurgeConfig = {
  auditLogsRetentionDays: 90,
  salesRetentionDays: 365,
  purchasesRetentionDays: 365,
  enabled: true,
};

export function purgeOldData(config: Partial<PurgeConfig> = {}): { success: boolean; message: string; stats: any } {
  const purgeConfig = { ...defaultPurgeConfig, ...config };

  if (!purgeConfig.enabled) {
    return { success: true, message: "Purge désactivée", stats: {} };
  }

  try {
    const stats: any = {};

    // Purger les vieux audit_logs (> X jours)
    const auditLogsCutoff = new Date();
    auditLogsCutoff.setDate(auditLogsCutoff.getDate() - purgeConfig.auditLogsRetentionDays);

    const deletedAuditLogs = db.prepare(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `).run(auditLogsCutoff.toISOString()).changes;

    stats.deletedAuditLogs = deletedAuditLogs;

    // Purger les ventes archivées (statut = 'archivée' AND > X jours)
    const deletedArchivedSales = db.prepare(`
      DELETE FROM ventes
      WHERE created_at < ?
      AND id IN (SELECT vente_id FROM factures WHERE date_facture < ?)
    `).run(auditLogsCutoff.toISOString(), auditLogsCutoff.toISOString()).changes;

    stats.deletedArchivedSales = deletedArchivedSales;

    // Mettre à jour les compteurs dans metadata
    const updateMetadataCount = (key: string, deleted: number) => {
      if (deleted > 0) {
        db.prepare('UPDATE metadata SET value = value - ? WHERE key = ?').run(deleted, key);
      }
    };

    updateMetadataCount('audit_logs_count', deletedAuditLogs);
    updateMetadataCount('ventes_count', deletedArchivedSales);

    return {
      success: true,
      message: "Purge effectuée avec succès",
      stats,
    };
  } catch (error) {
    console.error("Erreur purge old data:", error);
    return {
      success: false,
      message: "Erreur lors de la purge",
      stats: {},
    };
  }
}

// ============================================
// KEYSET PAGINATION - Optimisé pour millions de données
// ============================================

interface KeysetCursor {
  created_at?: string;
  id?: number;
  date_vente?: string;
  date_achat?: string;
  date_facture?: string;
  nom?: string;
}

interface KeysetPaginationResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor: KeysetCursor | null;
  prevCursor: KeysetCursor | null;
  // Pour compatibilité avec l'ancienne pagination
  page?: number;
  limit: number;
  totalPages?: number;
}

// Seuil à partir duquel on utilise keyset pagination
const KEYSET_THRESHOLD = 10000;

// Helper pour déterminer si on doit utiliser keyset pagination
export function shouldUseKeyset(tableName: string): boolean {
  const total = getFastCount(tableName);
  return total > KEYSET_THRESHOLD;
}

// Helper pour obtenir un COUNT estimé rapidement (pour très grandes tables)
function getEstimatedCount(tableName: string): number {
  // D'abord essayer metadata (O(1))
  try {
    const key = `${tableName}_count`;
    const result = db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: number } | undefined;
    if (result) {
      return result.value;
    }
  } catch (error) {
    // Ignorer
  }

  // Sinon, utiliser sqlite_stat1 pour estimation (si ANALYZE a été exécuté)
  try {
    const stat = db.prepare(`
      SELECT stat FROM sqlite_stat1
      WHERE tbl = ? AND idx IS NULL
    `).get(tableName) as { stat: string } | undefined;

    if (stat) {
      const count = parseInt(stat.stat.split(' ')[0]);
      if (!isNaN(count)) return count;
    }
  } catch (error) {
    // Ignorer
  }

  // Fallback: COUNT(*) classique
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM ${tableName}`).get() as { total: number };
  return total;
}

// Products avec Keyset Pagination
export function getProductsKeyset(
  limit: number = 10,
  cursor?: KeysetCursor,
  direction: 'next' | 'prev' = 'next',
  search?: string
): KeysetPaginationResult<any> {
  try {
    let whereClause = '';
    let params: any[] = [];
    let orderDirection = direction === 'next' ? 'DESC' : 'ASC';

    // Recherche FTS5 si disponible
    if (search && search.trim()) {
      const searchQuery = search.trim();
      try {
        const ftsStmt = db.prepare(`
          SELECT p.id
          FROM produits_fts pf
          JOIN produits p ON p.id = pf.rowid
          WHERE produits_fts MATCH ?
          ORDER BY rank
        `);
        const ftsIds = ftsStmt.all(searchQuery).map((row: any) => row.id);

        if (ftsIds.length > 0) {
          whereClause = `WHERE p.id IN (${ftsIds.join(',')})`;
        } else {
          const searchTerm = `%${searchQuery}%`;
          whereClause = 'WHERE (p.nom LIKE ? OR p.code_barre = ?)';
          params = [searchTerm, searchQuery];
        }
      } catch (ftsError) {
        const searchTerm = `%${search.trim()}%`;
        whereClause = 'WHERE (p.nom LIKE ? OR p.code_barre = ?)';
        params = [searchTerm, search.trim()];
      }
    }

    // Ajouter condition de cursor pour keyset
    if (cursor?.created_at && cursor?.id) {
      const cursorCondition = direction === 'next'
        ? '(p.created_at < ? OR (p.created_at = ? AND p.id < ?))'
        : '(p.created_at > ? OR (p.created_at = ? AND p.id > ?))';

      if (whereClause) {
        whereClause += ` AND ${cursorCondition}`;
      } else {
        whereClause = `WHERE ${cursorCondition}`;
      }
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }

    // Requête principale
    const dataStmt = db.prepare(`
      SELECT p.*, c.nom as categorie_nom
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      ${whereClause}
      ORDER BY p.created_at ${orderDirection}, p.id ${orderDirection}
      LIMIT ?
    `);

    let data = dataStmt.all(...params, limit + 1) as any[];

    // Vérifier s'il y a plus de données
    const hasMore = data.length > limit;
    if (hasMore) {
      data = data.slice(0, limit);
    }

    // Inverser si on navigue en arrière
    if (direction === 'prev') {
      data.reverse();
    }

    // Calculer les cursors
    const nextCursor = data.length > 0 ? {
      created_at: data[data.length - 1].created_at,
      id: data[data.length - 1].id
    } : null;

    const prevCursor = data.length > 0 ? {
      created_at: data[0].created_at,
      id: data[0].id
    } : null;

    // Total estimé
    const total = search ? data.length : getEstimatedCount('produits');

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit
    };
  } catch (error) {
    console.error("Erreur getProductsKeyset:", error);
    throw error;
  }
}

// Sales avec Keyset Pagination
export function getSalesKeyset(
  limit: number = 10,
  cursor?: KeysetCursor,
  direction: 'next' | 'prev' = 'next',
  startDate?: string,
  endDate?: string
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === 'next' ? 'DESC' : 'ASC';

    // Filtre par date
    if (startDate && endDate) {
      whereClauses.push('DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)');
      params.push(startDate, endDate);
    }

    // Condition de cursor
    if (cursor?.date_vente && cursor?.id) {
      const cursorCondition = direction === 'next'
        ? '(v.date_vente < ? OR (v.date_vente = ? AND v.id < ?))'
        : '(v.date_vente > ? OR (v.date_vente = ? AND v.id > ?))';
      whereClauses.push(cursorCondition);
      params.push(cursor.date_vente, cursor.date_vente, cursor.id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Charger les ventes
    const dataStmt = db.prepare(`
      SELECT v.*, c.nom as client_nom, s.nom as serveur_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN serveurs s ON v.serveur_id = s.id
      ${whereClause}
      ORDER BY v.date_vente ${orderDirection}, v.id ${orderDirection}
      LIMIT ?
    `);

    let sales = dataStmt.all(...params, limit + 1) as any[];
    const hasMore = sales.length > limit;
    if (hasMore) {
      sales = sales.slice(0, limit);
    }

    if (direction === 'prev') {
      sales.reverse();
    }

    // Batch loading des produits et paiements
    if (sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      const placeholders = saleIds.map(() => '?').join(',');

      const allProducts = db.prepare(`
        SELECT vp.*, p.nom as nom_produit
        FROM ventes_produits vp
        JOIN produits p ON vp.produit_id = p.id
        WHERE vp.vente_id IN (${placeholders})
      `).all(...saleIds) as any[];

      const allPayments = db.prepare(`
        SELECT * FROM paiements_clients
        WHERE vente_id IN (${placeholders})
      `).all(...saleIds) as any[];

      const productsBySale: Record<number, any[]> = {};
      allProducts.forEach(prod => {
        if (!productsBySale[prod.vente_id]) productsBySale[prod.vente_id] = [];
        productsBySale[prod.vente_id].push(prod);
      });

      const paymentsBySale: Record<number, any[]> = {};
      allPayments.forEach(payment => {
        if (!paymentsBySale[payment.vente_id]) paymentsBySale[payment.vente_id] = [];
        paymentsBySale[payment.vente_id].push(payment);
      });

      sales = sales.map(sale => ({
        ...sale,
        produits: productsBySale[sale.id] || [],
        paiements: paymentsBySale[sale.id] || [],
      }));
    }

    const nextCursor = sales.length > 0 ? {
      date_vente: sales[sales.length - 1].date_vente,
      id: sales[sales.length - 1].id
    } : null;

    const prevCursor = sales.length > 0 ? {
      date_vente: sales[0].date_vente,
      id: sales[0].id
    } : null;

    const total = getEstimatedCount('ventes');

    return {
      data: sales,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit
    };
  } catch (error) {
    console.error("Erreur getSalesKeyset:", error);
    throw error;
  }
}

// Audit Logs avec Keyset Pagination
export function getAuditLogsKeyset(
  limit: number = 20,
  cursor?: KeysetCursor,
  direction: 'next' | 'prev' = 'next',
  filters?: { startDate?: string; endDate?: string; table?: string; search?: string }
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === 'next' ? 'DESC' : 'ASC';

    if (filters?.startDate && filters?.endDate) {
      whereClauses.push('DATE(al.created_at) BETWEEN DATE(?) AND DATE(?)');
      params.push(filters.startDate, filters.endDate);
    }

    if (filters?.table) {
      whereClauses.push('al.table_cible = ?');
      params.push(filters.table);
    }

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      whereClauses.push('(al.utilisateur_nom LIKE ? OR al.action LIKE ? OR al.table_cible LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Condition de cursor
    if (cursor?.created_at && cursor?.id) {
      const cursorCondition = direction === 'next'
        ? '(al.created_at < ? OR (al.created_at = ? AND al.id < ?))'
        : '(al.created_at > ? OR (al.created_at = ? AND al.id > ?))';
      whereClauses.push(cursorCondition);
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataStmt = db.prepare(`
      SELECT al.*,
             u.email as utilisateur_email,
             u.role as utilisateur_role
      FROM audit_logs al
      LEFT JOIN utilisateurs u ON al.utilisateur_id = u.id
      ${whereClause}
      ORDER BY al.created_at ${orderDirection}, al.id ${orderDirection}
      LIMIT ?
    `);

    let data = dataStmt.all(...params, limit + 1) as any[];
    const hasMore = data.length > limit;
    if (hasMore) {
      data = data.slice(0, limit);
    }

    if (direction === 'prev') {
      data.reverse();
    }

    const nextCursor = data.length > 0 ? {
      created_at: data[data.length - 1].created_at,
      id: data[data.length - 1].id
    } : null;

    const prevCursor = data.length > 0 ? {
      created_at: data[0].created_at,
      id: data[0].id
    } : null;

    const total = getEstimatedCount('audit_logs');

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit
    };
  } catch (error) {
    console.error("Erreur getAuditLogsKeyset:", error);
    throw error;
  }
}

// Invoices avec Keyset Pagination
export function getInvoicesKeyset(
  limit: number = 10,
  cursor?: KeysetCursor,
  direction: 'next' | 'prev' = 'next',
  search?: string
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === 'next' ? 'DESC' : 'ASC';

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClauses.push('(f.numero LIKE ? OR f.client_nom LIKE ?)');
      params.push(searchTerm, searchTerm);
    }

    if (cursor?.date_facture && cursor?.id) {
      const cursorCondition = direction === 'next'
        ? '(f.date_facture < ? OR (f.date_facture = ? AND f.id < ?))'
        : '(f.date_facture > ? OR (f.date_facture = ? AND f.id > ?))';
      whereClauses.push(cursorCondition);
      params.push(cursor.date_facture, cursor.date_facture, cursor.id);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataStmt = db.prepare(`
      SELECT f.* FROM factures f
      ${whereClause}
      ORDER BY f.date_facture ${orderDirection}, f.id ${orderDirection}
      LIMIT ?
    `);

    let data = dataStmt.all(...params, limit + 1) as any[];
    const hasMore = data.length > limit;
    if (hasMore) {
      data = data.slice(0, limit);
    }

    if (direction === 'prev') {
      data.reverse();
    }

    // Parser les articles JSON
    data = data.map((invoice: any) => ({
      ...invoice,
      articles: JSON.parse(invoice.articles),
    }));

    const nextCursor = data.length > 0 ? {
      date_facture: data[data.length - 1].date_facture,
      id: data[data.length - 1].id
    } : null;

    const prevCursor = data.length > 0 ? {
      date_facture: data[0].date_facture,
      id: data[0].id
    } : null;

    const total = search ? data.length : getEstimatedCount('factures');

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit
    };
  } catch (error) {
    console.error("Erreur getInvoicesKeyset:", error);
    throw error;
  }
}

// Purchases avec Keyset Pagination
export function getPurchasesKeyset(
  limit: number = 10,
  cursor?: KeysetCursor,
  direction: 'next' | 'prev' = 'next'
): KeysetPaginationResult<any> {
  try {
    let whereClause = '';
    let params: any[] = [];
    let orderDirection = direction === 'next' ? 'DESC' : 'ASC';

    if (cursor?.date_achat && cursor?.id) {
      const cursorCondition = direction === 'next'
        ? '(a.date_achat < ? OR (a.date_achat = ? AND a.id < ?))'
        : '(a.date_achat > ? OR (a.date_achat = ? AND a.id > ?))';
      whereClause = `WHERE ${cursorCondition}`;
      params.push(cursor.date_achat, cursor.date_achat, cursor.id);
    }

    const dataStmt = db.prepare(`
      SELECT a.*, f.nom as fournisseur_nom
      FROM achats a
      JOIN fournisseurs f ON a.fournisseur_id = f.id
      ${whereClause}
      ORDER BY a.date_achat ${orderDirection}, a.id ${orderDirection}
      LIMIT ?
    `);

    let purchases = dataStmt.all(...params, limit + 1) as any[];
    const hasMore = purchases.length > limit;
    if (hasMore) {
      purchases = purchases.slice(0, limit);
    }

    if (direction === 'prev') {
      purchases.reverse();
    }

    // Batch loading des produits et paiements
    if (purchases.length > 0) {
      const purchaseIds = purchases.map(p => p.id);
      const placeholders = purchaseIds.map(() => '?').join(',');

      const allProducts = db.prepare(`
        SELECT ap.*, p.nom as nom_produit
        FROM achats_produits ap
        JOIN produits p ON ap.produit_id = p.id
        WHERE ap.achat_id IN (${placeholders})
      `).all(...purchaseIds) as any[];

      const allPayments = db.prepare(`
        SELECT * FROM paiements_fournisseurs
        WHERE achat_id IN (${placeholders})
      `).all(...purchaseIds) as any[];

      const productsByPurchase: Record<number, any[]> = {};
      allProducts.forEach(prod => {
        if (!productsByPurchase[prod.achat_id]) productsByPurchase[prod.achat_id] = [];
        productsByPurchase[prod.achat_id].push(prod);
      });

      const paymentsByPurchase: Record<number, any[]> = {};
      allPayments.forEach(payment => {
        if (!paymentsByPurchase[payment.achat_id]) paymentsByPurchase[payment.achat_id] = [];
        paymentsByPurchase[payment.achat_id].push(payment);
      });

      purchases = purchases.map(purchase => ({
        ...purchase,
        produits: productsByPurchase[purchase.id] || [],
        paiements: paymentsByPurchase[purchase.id] || [],
      }));
    }

    const nextCursor = purchases.length > 0 ? {
      date_achat: purchases[purchases.length - 1].date_achat,
      id: purchases[purchases.length - 1].id
    } : null;

    const prevCursor = purchases.length > 0 ? {
      date_achat: purchases[0].date_achat,
      id: purchases[0].id
    } : null;

    const total = getEstimatedCount('achats');

    return {
      data: purchases,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit
    };
  } catch (error) {
    console.error("Erreur getPurchasesKeyset:", error);
    throw error;
  }
}

// Fonction hybride: utilise keyset si > KEYSET_THRESHOLD, sinon OFFSET classique
export function getProductsPaginatedOptimized(page: number = 1, limit: number = 10, search?: string, cursor?: KeysetCursor) {
  const total = search ? 0 : getEstimatedCount('produits');

  // Si keyset cursor fourni ou si très grande table sans recherche, utiliser keyset
  if (cursor || (total > KEYSET_THRESHOLD && !search)) {
    const result = getProductsKeyset(limit, cursor, 'next', search);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true
    };
  }

  // Sinon utiliser la pagination OFFSET classique
  return { ...getProductsPaginated(page, limit, search), useKeyset: false };
}

export function getSalesPaginatedOptimized(page: number = 1, limit: number = 10, startDate?: string, endDate?: string, cursor?: KeysetCursor) {
  const total = getEstimatedCount('ventes');

  if (cursor || total > KEYSET_THRESHOLD) {
    const result = getSalesKeyset(limit, cursor, 'next', startDate, endDate);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true
    };
  }

  return { ...getSalesPaginated(page, limit, startDate, endDate), useKeyset: false };
}

export function getAuditLogsPaginatedOptimized(page: number = 1, limit: number = 20, filters?: { startDate?: string; endDate?: string; table?: string; search?: string }, cursor?: KeysetCursor) {
  const total = getEstimatedCount('audit_logs');

  if (cursor || total > KEYSET_THRESHOLD) {
    const result = getAuditLogsKeyset(limit, cursor, 'next', filters);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true
    };
  }

  return { ...getAuditLogsPaginated(page, limit, filters), useKeyset: false };
}

// Obtenir les informations de version du schéma de la base de données
export function getSchemaInfo(): {
  currentVersion: number;
  targetVersion: number;
  appliedMigrations: Array<{ version: number; description: string; applied_at: string }>;
  pendingMigrations: number;
} {
  try {
    createSchemaVersionTable();

    const currentVersion = getCurrentSchemaVersion();
    const appliedMigrations = db
      .prepare("SELECT version, description, applied_at FROM schema_versions ORDER BY version ASC")
      .all() as Array<{ version: number; description: string; applied_at: string }>;

    return {
      currentVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      appliedMigrations,
      pendingMigrations: Math.max(0, CURRENT_SCHEMA_VERSION - currentVersion),
    };
  } catch {
    return {
      currentVersion: 0,
      targetVersion: CURRENT_SCHEMA_VERSION,
      appliedMigrations: [],
      pendingMigrations: CURRENT_SCHEMA_VERSION,
    };
  }
}

export function getDatabaseStats(): {
  totalSize: number;
  tables: any[];
  oldestData: any;
} {
  try {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "gestion_stock.db");

    let totalSize = 0;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      totalSize = stats.size;
    }

    const tables = db.prepare(`
      SELECT name as tableName, sql
      FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
    `).all();

    const tablesWithCounts = tables.map((table: any) => {
      const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table.tableName}`).get() as { count: number };
      return {
        name: table.tableName,
        count,
      };
    });

    const oldestAudit = db.prepare(`
      SELECT created_at FROM audit_logs
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as { created_at: string } | undefined;

    const oldestSale = db.prepare(`
      SELECT date_vente FROM ventes
      ORDER BY date_vente ASC
      LIMIT 1
    `).get() as { date_vente: string } | undefined;

    return {
      totalSize,
      tables: tablesWithCounts,
      oldestData: {
        auditLog: oldestAudit?.created_at,
        sale: oldestSale?.date_vente,
      },
    };
  } catch (error) {
    console.error("Erreur get database stats:", error);
    return {
      totalSize: 0,
      tables: [],
      oldestData: {},
    };
  }
}
