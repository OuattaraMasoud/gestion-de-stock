import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";

let db: Database.Database;

// Version actuelle du schéma de la base de données
// Incrémentez ce numéro à chaque nouveau changement de schéma
const CURRENT_SCHEMA_VERSION = 17;

// Vérifier l'intégrité de la base de données
function checkAndRepairDatabase(): { success: boolean; message: string } {
  try {
    const result = db.pragma("integrity_check", { simple: true }) as string;
    if (result === "ok") {
      return { success: true, message: "Base de données saine" };
    } else {
      return {
        success: false,
        message: result || "Erreur d'intégrité détectée",
      };
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
export function repairDatabase(): {
  success: boolean;
  message: string;
  backupPath?: string;
} {
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
      const tables = db
        .prepare(
          `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
      `,
        )
        .all() as { name: string }[];

      const dump: string[] = [];
      for (const table of tables) {
        if (
          [
            "produits_fts",
            "clients_fts",
            "fournisseurs_fts",
            "utilisateurs_fts",
          ].includes(table.name)
        ) {
          continue; // Ignorer les tables FTS5 corrompues
        }

        try {
          db.prepare(`SELECT * FROM ${table.name}`).all();
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
    console.error(
      "Erreur d'intégrité de la base de données:",
      integrityCheck.message,
    );
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
  const hasVersions = db
    .prepare("SELECT COUNT(*) as count FROM schema_versions")
    .get() as { count: number };

  if (hasVersions.count > 0) {
    return; // Les versions sont déjà trackées
  }

  // Vérifier si c'est une ancienne base de données avec des tables
  if (!tableExists("ventes")) {
    return; // Nouvelle installation, pas besoin de détecter
  }

  console.log(
    "🔍 Détection des migrations existantes sur ancienne base de données...",
  );

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
    recordMigration(
      4,
      "Ajout colonnes de remise à ventes et factures (pré-existant)",
    );
  }

  // Détecter migration 5: (si nécessaire - vérifier ce qui a été ajouté)
  // Migration 5 concerne probablement les remises sur factures aussi
  if (
    tableExists("factures") &&
    columnExists("factures", "remise_type") &&
    columnExists("factures", "remise_valeur")
  ) {
    console.log("  → Migration 5 déjà appliquée (remise sur factures existe)");
    recordMigration(5, "Colonnes remise factures (pré-existant)");
  }

  // Détecter migration 6: client_telephone et client_email dans factures
  if (
    tableExists("factures") &&
    columnExists("factures", "client_telephone") &&
    columnExists("factures", "client_email")
  ) {
    console.log(
      "  → Migration 6 déjà appliquée (client_telephone/client_email existent)",
    );
    recordMigration(
      6,
      "Ajout client_telephone et client_email aux factures (pré-existant)",
    );
  }

  console.log("✓ Détection terminée");
}

// Obtenir la version actuelle du schéma
function getCurrentSchemaVersion(): number {
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'",
      )
      .all();

    if (tables.length === 0) {
      return 0; // Nouvelle base ou ancienne version sans tracking
    }

    const result = db
      .prepare("SELECT MAX(version) as version FROM schema_versions")
      .get() as { version: number | null };
    return result?.version || 0;
  } catch {
    return 0;
  }
}

// Enregistrer une migration appliquée
function recordMigration(version: number, description: string) {
  db.prepare(
    "INSERT OR IGNORE INTO schema_versions (version, description) VALUES (?, ?)",
  ).run(version, description);
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

        console.log(
          `  Sauvegarde: ${oldVentes.length} ventes, ${oldVentesProduits.length} produits, ${oldPaiementsClients.length} paiements`,
        );

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
              insertVPStmt.run(
                vp.id,
                vp.vente_id,
                vp.produit_id,
                vp.quantite,
                vp.prix_unitaire,
                vp.sous_total,
              );
            } catch (e) {
              console.log(
                `  Impossible de restaurer vente_produit ${vp.id}:`,
                e,
              );
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
              console.log(
                `  Impossible de restaurer paiement_client ${pc.id}:`,
                e,
              );
            }
          }
        }

        console.log(
          `✓ Migration 1: ${oldVentes.length} vente(s), ${oldVentesProduits.length} produit(s), ${oldPaiementsClients.length} paiement(s) migré(s)`,
        );
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
        db.exec(
          "ALTER TABLE ventes ADD COLUMN total_avant_remise REAL DEFAULT NULL",
        );
      }

      // Remise dans factures
      if (tableExists("factures") && !columnExists("factures", "remise_type")) {
        console.log("Migration 4: Ajout des colonnes de remise à factures...");
        db.exec(
          "ALTER TABLE factures ADD COLUMN remise_type TEXT DEFAULT NULL",
        );
        db.exec("ALTER TABLE factures ADD COLUMN remise_valeur REAL DEFAULT 0");
        db.exec(
          "ALTER TABLE factures ADD COLUMN total_avant_remise REAL DEFAULT NULL",
        );
      }
      console.log("✓ Migration 4 terminée");
    },
  },
  {
    version: 5,
    description: "Correction colonnes remise dans factures (fix migration 4)",
    up: () => {
      // Cette migration corrige le cas où la migration 4 a été marquée comme
      // appliquée mais les colonnes n'ont pas été ajoutées à factures
      if (tableExists("factures")) {
        if (!columnExists("factures", "remise_type")) {
          console.log("Migration 5: Ajout de remise_type à factures...");
          db.exec(
            "ALTER TABLE factures ADD COLUMN remise_type TEXT DEFAULT NULL",
          );
        }
        if (!columnExists("factures", "remise_valeur")) {
          console.log("Migration 5: Ajout de remise_valeur à factures...");
          db.exec(
            "ALTER TABLE factures ADD COLUMN remise_valeur REAL DEFAULT 0",
          );
        }
        if (!columnExists("factures", "total_avant_remise")) {
          console.log("Migration 5: Ajout de total_avant_remise à factures...");
          db.exec(
            "ALTER TABLE factures ADD COLUMN total_avant_remise REAL DEFAULT NULL",
          );
        }
      }
      console.log("✓ Migration 5 terminée");
    },
  },
  {
    version: 6,
    description: "Ajout client_telephone et client_email aux factures",
    up: () => {
      // Ajouter les colonnes client_telephone et client_email à la table factures
      try {
        db.exec("ALTER TABLE factures ADD COLUMN client_telephone TEXT");
        console.log("  ✓ Colonne client_telephone ajoutée à factures");
      } catch (e) {
        console.log("  - Colonne client_telephone existe déjà");
      }
      try {
        db.exec("ALTER TABLE factures ADD COLUMN client_email TEXT");
        console.log("  ✓ Colonne client_email ajoutée à factures");
      } catch (e) {
        console.log("  - Colonne client_email existe déjà");
      }
      console.log("✓ Migration 6 terminée");
    },
  },
  // ==================== AJOUTEZ VOS NOUVELLES MIGRATIONS ICI ====================
  {
    version: 7,
    description: "Ajout description_entreprise à configuration",
    up: () => {
      try {
        db.exec(
          "ALTER TABLE configuration ADD COLUMN description_entreprise TEXT",
        );
        console.log(
          "  ✓ Colonne description_entreprise ajoutée à configuration",
        );
      } catch (e) {
        console.log("  - Colonne description_entreprise existe déjà");
      }
      console.log("✓ Migration 7 terminée");
    },
  },
  {
    version: 8,
    description: "Création de la table client_prix pour les prix personnalisés",
    up: () => {
      if (!tableExists("client_prix")) {
        console.log("Migration 8: Création de la table client_prix...");
        db.exec(`
          CREATE TABLE client_prix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            produit_id INTEGER NOT NULL,
            prix_personnalise REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
            UNIQUE(client_id, produit_id)
          )
        `);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_client_prix_client ON client_prix(client_id);
          CREATE INDEX IF NOT EXISTS idx_client_prix_produit ON client_prix(produit_id);
          CREATE INDEX IF NOT EXISTS idx_client_prix_unique ON client_prix(client_id, produit_id);
        `);
      console.log("✓ Migration 8 terminée");
      }
    },
  },
  {
    version: 9,
    description: "Création de la table depenses pour les dépenses de fonctionnement",
    up: () => {
      if (!tableExists("depenses")) {
        console.log("Migration 9: Création de la table depenses...");
        db.exec(`
          CREATE TABLE depenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categorie TEXT NOT NULL CHECK(categorie IN ('restauration', 'energie', 'carburant', 'transport', 'fournitures', 'salaire', 'loyer', 'communication', 'don', 'maintenance', 'autre')),
            description TEXT NOT NULL,
            montant REAL NOT NULL,
            date_depense DATE NOT NULL,
            methode_paiement TEXT CHECK(methode_paiement IN ('especes', 'carte', 'virement', 'cheque', 'mobile')),
            reference TEXT,
            utilisateur_id INTEGER,
            utilisateur_nom TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_depenses_categorie ON depenses(categorie);
          CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date_depense);
          CREATE INDEX IF NOT EXISTS idx_depenses_montant ON depenses(montant);
        `);
        console.log("✓ Migration 9 terminée");
      }
    },
  },
  {
    version: 10,
    description: "Ajout colonne sans_stock pour produits sans suivi de stock",
    up: () => {
      if (tableExists("produits") && !columnExists("produits", "sans_stock")) {
        console.log("Migration 10: Ajout colonne sans_stock...");
        db.exec(`ALTER TABLE produits ADD COLUMN sans_stock INTEGER DEFAULT 0`);
        console.log("✓ Migration 10 terminée");
      }
    },
  },
  {
    version: 11,
    description: "Ajout index unique sur téléphone client",
    up: () => {
      console.log("Migration 11: Création index unique sur téléphone client...");
      try {
        const duplicates = db.prepare(`
          SELECT telephone, COUNT(*) as count
          FROM clients
          WHERE telephone IS NOT NULL AND telephone != ''
          GROUP BY telephone
          HAVING count > 1
        `).all() as { telephone: string; count: number }[];

        if (duplicates.length > 0) {
          console.log(`  Attention: ${duplicates.length} doublons de téléphone détectés`);
          for (const dup of duplicates) {
            const clients = db.prepare(`
              SELECT id FROM clients WHERE telephone = ? ORDER BY created_at ASC
            `).all(dup.telephone) as { id: number }[];
            
            for (let i = 1; i < clients.length; i++) {
              db.prepare(`UPDATE clients SET telephone = NULL WHERE id = ?`).run(clients[i].id);
            }
          }
          console.log("  Doublons de téléphone nettoyés");
        }

        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_telephone_unique ON clients(telephone) WHERE telephone IS NOT NULL AND telephone != ''`);
        console.log("✓ Migration 11 terminée");
      } catch (error) {
        console.log("  Index déjà existant ou erreur mineure:", error);
      }
    },
  },
  {
    version: 12,
    description: "Ajout champs légaux/fiscaux dans configuration",
    up: () => {
      // Si la table n'existe pas encore, createTables() la créera avec les bonnes colonnes
      if (!tableExists("configuration")) {
        console.log("  → Table configuration absente, sera créée par createTables()");
        return;
      }
      const cols = ["rccm", "regime_fiscal", "division_fiscale",
                    "numero_compte_uba", "reference_cadastrale", "secteur"];
      for (const col of cols) {
        if (!columnExists("configuration", col)) {
          db.exec(`ALTER TABLE configuration ADD COLUMN ${col} TEXT DEFAULT ''`);
        }
      }
      console.log("✓ Migration 12 terminée");
    },
  },
  {
    version: 13,
    description: "Ajout format A5 dans la contrainte CHECK de configuration",
    up: () => {
      console.log("Migration 13: Mise à jour contrainte CHECK format_facture...");
      db.exec(`
        CREATE TABLE IF NOT EXISTS configuration_new (
          id INTEGER PRIMARY KEY,
          nom_entreprise TEXT NOT NULL DEFAULT 'Mon Entreprise',
          description_entreprise TEXT,
          logo_url TEXT,
          adresse TEXT,
          telephone TEXT,
          telephone2 TEXT,
          email TEXT,
          nif TEXT,
          rccm TEXT DEFAULT '',
          regime_fiscal TEXT DEFAULT '',
          division_fiscale TEXT DEFAULT '',
          numero_compte_uba TEXT DEFAULT '',
          reference_cadastrale TEXT DEFAULT '',
          secteur TEXT DEFAULT '',
          ville TEXT,
          pays TEXT,
          devise TEXT DEFAULT 'FCFA',
          message_pied TEXT DEFAULT 'Merci de votre visite !',
          support_text TEXT,
          format_facture TEXT DEFAULT '80mm' CHECK(format_facture IN ('80mm', 'A4', 'A5'))
        )
      `);
      db.exec(`
        INSERT INTO configuration_new
          SELECT id, nom_entreprise, description_entreprise, logo_url, adresse,
                 telephone, telephone2, email, nif,
                 COALESCE(rccm, ''), COALESCE(regime_fiscal, ''),
                 COALESCE(division_fiscale, ''), COALESCE(numero_compte_uba, ''),
                 COALESCE(reference_cadastrale, ''), COALESCE(secteur, ''),
                 ville, pays, devise, message_pied, support_text,
                 CASE WHEN format_facture IN ('80mm','A4','A5') THEN format_facture ELSE '80mm' END
          FROM configuration
      `);
      db.exec(`DROP TABLE configuration`);
      db.exec(`ALTER TABLE configuration_new RENAME TO configuration`);
      console.log("✓ Migration 13 terminée");
    },
  },
  {
    version: 14,
    description: "Création table caisses pour ouverture/fermeture caisse",
    up: () => {
      if (!tableExists("caisses")) {
        console.log("Migration 14: Création table caisses...");
        db.exec(`
          CREATE TABLE caisses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_ouverture DATE NOT NULL,
            heure_ouverture TEXT NOT NULL,
            fonds_roulement REAL NOT NULL DEFAULT 0,
            date_fermeture DATE,
            heure_fermeture TEXT,
            vendeur_id INTEGER,
            vendeur_nom TEXT,
            total_ventes REAL DEFAULT 0,
            total_especes REAL DEFAULT 0,
            total_carte REAL DEFAULT 0,
            total_mobile REAL DEFAULT 0,
            statut TEXT DEFAULT 'ouverte' CHECK(statut IN ('ouverte', 'fermee')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vendeur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
          )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_caisses_date ON caisses(date_ouverture)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_caisses_statut ON caisses(statut)`);
        console.log("✓ Migration 14 terminée");
      }
    },
  },
  {
    version: 15,
    description: "Ajout champs locked et delivered sur factures et ventes",
    up: () => {
      if (!columnExists("factures", "locked")) {
        console.log("Migration 15: Ajout champ locked sur factures...");
        db.exec(`ALTER TABLE factures ADD COLUMN locked INTEGER DEFAULT 0`);
      }
      if (!columnExists("ventes", "locked")) {
        console.log("Migration 15: Ajout champ locked sur ventes...");
        db.exec(`ALTER TABLE ventes ADD COLUMN locked INTEGER DEFAULT 0`);
      }
      if (!columnExists("ventes", "delivered")) {
        console.log("Migration 15: Ajout champ delivered sur ventes...");
        db.exec(`ALTER TABLE ventes ADD COLUMN delivered INTEGER DEFAULT 1`);
      }
      if (!columnExists("ventes", "date_livraison")) {
        console.log("Migration 15: Ajout champ date_livraison sur ventes...");
        db.exec(`ALTER TABLE ventes ADD COLUMN date_livraison DATETIME`);
      }
      console.log("✓ Migration 15 terminée");
    },
  },
  {
    version: 16,
    description: "Création table livraisons pour suivi des livraisons",
    up: () => {
      if (!tableExists("livraisons")) {
        console.log("Migration 16: Création table livraisons...");
        db.exec(`
          CREATE TABLE livraisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vente_id INTEGER NOT NULL,
            client_id INTEGER,
            client_nom TEXT,
            adresse_livraison TEXT,
            date_prevue DATE,
            date_livraison DATETIME,
            statut TEXT DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'en_cours', 'livree', 'annulee')),
            notes TEXT,
            livreur TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
          )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_livraisons_vente ON livraisons(vente_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_livraisons_client ON livraisons(client_id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_livraisons_statut ON livraisons(statut)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_livraisons_date ON livraisons(date_prevue)`);
        console.log("✓ Migration 16 terminée");
      }
    },
  },
  {
    version: 17,
    description: "Ajout champ livraison_differee sur ventes",
    up: () => {
      if (!columnExists("ventes", "livraison_differee")) {
        db.exec(`ALTER TABLE ventes ADD COLUMN livraison_differee INTEGER DEFAULT 0`);
        console.log("✓ Migration 17 terminée");
      }
    },
  },
  {
    version: 18,
    description: "Ajout utilisateur_nom sur ventes pour filtrage par vendeur",
    up: () => {
      if (!columnExists("ventes", "utilisateur_nom")) {
        db.exec(`ALTER TABLE ventes ADD COLUMN utilisateur_nom TEXT`);
        console.log("✓ Migration 18 terminée");
      }
    },
  },
];

function runMigrations() {
  console.log("=== DEBUT DES MIGRATIONS ===");

  try {
    // Créer la table de versioning
    createSchemaVersionTable();

    // Nouvelle installation : aucune table n'existe encore
    // Marquer toutes les migrations comme déjà appliquées,
    // createTables() créera tout avec le schéma final correct
    if (!tableExists("ventes")) {
      console.log("✓ Nouvelle installation détectée, toutes les migrations marquées comme appliquées");
      for (const migration of migrations) {
        recordMigration(migration.version, migration.description);
      }
      console.log("=== FIN DES MIGRATIONS ===");
      return;
    }

    // Détecter les migrations déjà appliquées sur les anciennes bases de données
    // (avant le système de versioning)
    detectExistingMigrations();

    const currentVersion = getCurrentSchemaVersion();
    console.log(`Version actuelle du schéma: ${currentVersion}`);
    console.log(`Version cible du schéma: ${CURRENT_SCHEMA_VERSION}`);

    // Filtrer les migrations à appliquer
    const pendingMigrations = migrations.filter(
      (m) => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      console.log("✓ Base de données à jour, aucune migration nécessaire");
      console.log("=== FIN DES MIGRATIONS ===");
      return;
    }

    console.log(`${pendingMigrations.length} migration(s) à appliquer`);

    // Créer un backup avant les migrations
    const backupPath = createMigrationBackup();
    if (!backupPath) {
      console.warn(
        "⚠️  Impossible de créer un backup, continuation avec précaution...",
      );
    }

    // Appliquer chaque migration dans l'ordre
    for (const migration of pendingMigrations.sort(
      (a, b) => a.version - b.version,
    )) {
      console.log(
        `\n--- Migration ${migration.version}: ${migration.description} ---`,
      );

      try {
        // Exécuter la migration dans une transaction
        db.exec("BEGIN TRANSACTION");
        migration.up();
        recordMigration(migration.version, migration.description);
        db.exec("COMMIT");
        console.log(`✓ Migration ${migration.version} appliquée avec succès`);
      } catch (migrationError) {
        db.exec("ROLLBACK");
        console.error(
          `❌ Échec de la migration ${migration.version}:`,
          migrationError,
        );

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
    console.log(
      `Version du schéma: ${currentVersion} → ${CURRENT_SCHEMA_VERSION}`,
    );
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
      sans_stock INTEGER DEFAULT 0,
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
      client_telephone TEXT,
      client_email TEXT,
      serveur_nom TEXT,
      total_ttc REAL NOT NULL,
      methode_paiement TEXT NOT NULL,
      montant_paye REAL NOT NULL,
      monnaie_rendue REAL DEFAULT 0,
      remise_type TEXT DEFAULT NULL,
      remise_valeur REAL DEFAULT 0,
      total_avant_remise REAL DEFAULT NULL,
      articles TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE
    )
  `);

  // Table factures proforma
  db.exec(`
    CREATE TABLE IF NOT EXISTS factures_proforma (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      client_id INTEGER,
      client_nom TEXT DEFAULT 'Client comptoir',
      client_telephone TEXT,
      client_email TEXT,
      date_proforma TEXT NOT NULL,
      date_validite TEXT,
      total_ht REAL NOT NULL DEFAULT 0,
      total_ttc REAL NOT NULL,
      remise_type TEXT DEFAULT NULL,
      remise_valeur REAL DEFAULT 0,
      total_avant_remise REAL DEFAULT NULL,
      articles TEXT NOT NULL,
      notes TEXT,
      statut TEXT DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'acceptee', 'refusee', 'convertie', 'expiree')),
      vente_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES utilisateurs(id) ON DELETE SET NULL
    )
  `);

  // Table configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuration (
      id INTEGER PRIMARY KEY,
      nom_entreprise TEXT NOT NULL DEFAULT 'Mon Entreprise',
      description_entreprise TEXT,
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
      format_facture TEXT DEFAULT '80mm' CHECK(format_facture IN ('80mm', 'A4', 'A5'))
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

export function saveCompanyLogo(base64Data: string): string {
  try {
    const userDataPath = app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const matches = base64Data.match(
      /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/,
    );
    if (!matches) {
      throw new Error("Format d'image invalide");
    }

    const mimeType = matches[1];
    const extension = mimeType.split("/")[1].replace("+xml", "");
    const filename = `company_logo.${extension}`;
    const filepath = path.join(imagesDir, filename);

    // Supprimer l'ancien logo s'il existe
    try {
      const existingLogos = fs
        .readdirSync(imagesDir)
        .filter((f) => f.startsWith("company_logo."));
      for (const oldLogo of existingLogos) {
        fs.unlinkSync(path.join(imagesDir, oldLogo));
      }
    } catch (e) {
      // Ignorer les erreurs de suppression
    }

    fs.writeFileSync(filepath, matches[2], "base64");

    // Mettre à jour ou créer la configuration avec le logo
    const checkStmt = db.prepare("SELECT id FROM configuration WHERE id = 1");
    const exists = checkStmt.get();

    if (exists) {
      db.prepare("UPDATE configuration SET logo_url = ? WHERE id = 1").run(
        filename,
      );
    } else {
      db.prepare(
        "INSERT INTO configuration (id, nom_entreprise, logo_url) VALUES (1, 'Mon Entreprise', ?)",
      ).run(filename);
    }

    return filename;
  } catch (error) {
    console.error("Erreur sauvegarde logo:", error);
    throw error;
  }
}

export function getCompanyLogo(): string | null {
  try {
    const config = getConfiguration();
    if (!config.logo_url) return null;
    return getProductImage(config.logo_url);
  } catch (error) {
    console.error("Erreur lecture logo:", error);
    return null;
  }
}

export function deleteCompanyLogo(): void {
  try {
    const config = getConfiguration();
    if (config.logo_url) {
      const userDataPath = app.getPath("userData");
      const filepath = path.join(userDataPath, "images", config.logo_url);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    const stmt = db.prepare(
      "UPDATE configuration SET logo_url = NULL WHERE id = 1",
    );
    stmt.run();
  } catch (error) {
    console.error("Erreur suppression logo:", error);
    throw error;
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
       quantite_stock, stock_min, categorie_id, image_url, sans_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      product.sans_stock ? 1 : 0,
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
    const oldProduct = db
      .prepare("SELECT * FROM produits WHERE id = ?")
      .get(id) as any;

    if (!oldProduct) {
      throw new Error("Produit non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE produits SET
       nom = ?, description = ?, code_barre = ?, prix_achat = ?,
       prix_vente = ?, quantite_stock = ?, stock_min = ?,
       categorie_id = ?, image_url = ?, sans_stock = ?, updated_at = CURRENT_TIMESTAMP
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
      product.sans_stock ? 1 : 0,
      id,
    );

    const changes = [];
    if (oldProduct.nom !== product.nom)
      changes.push(`nom: "${oldProduct.nom}" → "${product.nom}"`);
    if (oldProduct.description !== product.description)
      changes.push(
        `description: "${oldProduct.description}" → "${product.description}"`,
      );
    if (oldProduct.code_barre !== product.code_barre)
      changes.push(
        `code_barre: "${oldProduct.code_barre}" → "${product.code_barre}"`,
      );
    if (oldProduct.prix_achat !== product.prix_achat)
      changes.push(
        `prix_achat: ${oldProduct.prix_achat} → ${product.prix_achat}`,
      );
    if (oldProduct.prix_vente !== product.prix_vente)
      changes.push(
        `prix_vente: ${oldProduct.prix_vente} → ${product.prix_vente}`,
      );
    if (oldProduct.quantite_stock !== product.quantite_stock)
      changes.push(
        `quantite_stock: ${oldProduct.quantite_stock} → ${product.quantite_stock}`,
      );
    if (oldProduct.stock_min !== product.stock_min)
      changes.push(`stock_min: ${oldProduct.stock_min} → ${product.stock_min}`);
    if (oldProduct.categorie_id !== product.categorie_id)
      changes.push(
        `categorie_id: ${oldProduct.categorie_id} → ${product.categorie_id}`,
      );
    if (oldProduct.image_url !== product.image_url)
      changes.push(
        `image_url: "${oldProduct.image_url}" → "${product.image_url}"`,
      );

    const details =
      changes.length > 0
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

export function deleteProduct(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const product = db
      .prepare("SELECT * FROM produits WHERE id = ?")
      .get(id) as any;
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
    const oldCategory = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id) as any;

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
    if (oldCategory.nom !== category.nom)
      changes.push(`nom: "${oldCategory.nom}" → "${category.nom}"`);
    if (oldCategory.description !== category.description)
      changes.push(
        `description: "${oldCategory.description}" → "${category.description}"`,
      );

    const details =
      changes.length > 0
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

export function deleteCategory(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(id) as any;
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
        db.exec(
          "ALTER TABLE ventes ADD COLUMN total_avant_remise REAL DEFAULT NULL",
        );
      } catch (e) {
        // La colonne existe déjà, ignorer l'erreur
      }

      // Créer la vente avec remise
      const saleStmt = db.prepare(`
        INSERT INTO ventes (client_id, client_nom, serveur_id, total, montant_paye, montant_restant, monnaie_rendue, statut_paiement, methode_paiement, remise_type, remise_valeur, total_avant_remise, livraison_differee, delivered, utilisateur_nom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

      const livraisonDifferee = sale.livraison_differee ? 1 : 0;

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
        livraisonDifferee,
        livraisonDifferee ? 0 : 1,
        sale.utilisateur_nom || null,
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

      const getSansStockStmt = db.prepare(`
        SELECT sans_stock FROM produits WHERE id = ?
      `);

      let totalSansStock = 0;

      for (const item of sale.produits) {
        prodStmt.run(
          venteId,
          item.produit_id,
          item.quantite,
          item.prix_unitaire,
          item.sous_total,
        );

        // Ne pas décrémenter le stock pour les produits sans_stock
        // Ne pas décrémenter le stock si livraison différée (sera fait à la livraison)
        const prodRow = getSansStockStmt.get(item.produit_id) as any;
        const isSansStock = prodRow && prodRow.sans_stock;
        if (isSansStock) {
          totalSansStock += item.sous_total;
        } else if (!sale.livraison_differee) {
          updateStockStmt.run(item.quantite, item.produit_id);
        }
      }

      // Créer automatiquement une livraison en_attente si livraison différée
      if (sale.livraison_differee) {
        db.prepare(`
          INSERT INTO livraisons (vente_id, client_id, client_nom, adresse_livraison, statut, livreur, notes)
          VALUES (?, ?, ?, ?, 'en_attente', ?, ?)
        `).run(
          venteId,
          sale.client_id || null,
          sale.client_nom || null,
          sale.adresse_livraison || null,
          sale.livreur || null,
          sale.notes_livraison || null,
        );
      }

      // Mettre à jour le solde du client si vente à crédit
      if (sale.client_id && montantRestant > 0) {
        const updateClientStmt = db.prepare(`
          UPDATE clients SET solde_du = solde_du + ? WHERE id = ?
        `);
        updateClientStmt.run(montantRestant, sale.client_id);
      }

      // Enregistrer dans la comptabilité uniquement le montant réellement encaissé
      // Pour les ventes à crédit, seul le montant payé (acompte) est une entrée de caisse
      // Le reste sera enregistré lors du paiement de la dette
      // Les produits sans_stock sont exclus de la comptabilité
      const montantComptabilisable = sale.total - totalSansStock;
      if (montantComptabilisable > 0) {
        const montantEncaisseBrut =
          montantRestant > 0 ? sale.montant_paye : sale.total;
        const montantEncaisseComptabilisable =
          sale.total > 0
            ? montantEncaisseBrut * (montantComptabilisable / sale.total)
            : 0;
        if (montantEncaisseComptabilisable > 0) {
          const comptaStmt = db.prepare(`
            INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          comptaStmt.run(
            "vente",
            venteId,
            `Vente #${venteId}${montantRestant > 0 ? " (à crédit)" : ""}${sale.remise_valeur ? ` (remise: ${sale.remise_type === "pourcentage" ? sale.remise_valeur + "%" : sale.remise_valeur + " FCFA"})` : ""}`,
            montantEncaisseComptabilisable,
            "entree",
            sale.methode_paiement,
          );
        }
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
    const saleIds = sales.map((s) => s.id);

    const placeholders = saleIds.map(() => "?").join(",");
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
    allProducts.forEach((prod) => {
      if (!productsBySale[prod.vente_id]) {
        productsBySale[prod.vente_id] = [];
      }
      productsBySale[prod.vente_id].push(prod);
    });

    const paymentsBySale: Record<number, any[]> = {};
    allPayments.forEach((payment) => {
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

export function deleteSale(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    return db.transaction(() => {
      const sale = db
        .prepare("SELECT * FROM ventes WHERE id = ?")
        .get(id) as any;

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

export function canModifySale(venteId: number): {
  canModify: boolean;
  reason?: string;
} {
  try {
    const sale = db
      .prepare("SELECT date_vente FROM ventes WHERE id = ?")
      .get(venteId) as any;

    if (!sale) {
      return { canModify: false, reason: "Vente non trouvée" };
    }

    const saleDate = new Date(sale.date_vente);
    const now = new Date();
    const diffHours = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > 24) {
      return {
        canModify: false,
        reason: `Modification impossible: plus de 24h écoulées (${Math.floor(diffHours)}h)`,
      };
    }

    return { canModify: true };
  } catch (error) {
    console.error("Erreur canModifySale:", error);
    return { canModify: false, reason: "Erreur lors de la vérification" };
  }
}

export function updateSale(
  venteId: number,
  updatedData: any,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const checkResult = canModifySale(venteId);
    if (!checkResult.canModify) {
      throw new Error(checkResult.reason);
    }

    return db.transaction(() => {
      const oldSale = db
        .prepare(
          `
        SELECT v.*, c.nom as client_nom 
        FROM ventes v 
        LEFT JOIN clients c ON v.client_id = c.id 
        WHERE v.id = ?
      `,
        )
        .get(venteId) as any;

      if (!oldSale) {
        throw new Error("Vente non trouvée");
      }

      const oldProducts = db
        .prepare(
          `
        SELECT vp.*, p.nom as nom_produit 
        FROM ventes_produits vp 
        JOIN produits p ON vp.produit_id = p.id 
        WHERE vp.vente_id = ?
      `,
        )
        .all(venteId) as any[];

      for (const product of oldProducts) {
        db.prepare(
          "UPDATE produits SET quantite_stock = quantite_stock + ? WHERE id = ?",
        ).run(product.quantite, product.produit_id);
      }

      if (oldSale.client_id && oldSale.montant_restant > 0) {
        db.prepare(
          "UPDATE clients SET solde_du = solde_du - ? WHERE id = ?",
        ).run(oldSale.montant_restant, oldSale.client_id);
      }

      db.prepare(
        "DELETE FROM comptabilite WHERE type = 'vente' AND reference_id = ?",
      ).run(venteId);
      db.prepare("DELETE FROM ventes_produits WHERE vente_id = ?").run(venteId);

      const newMontantRestant =
        updatedData.montant_restant ??
        updatedData.total - updatedData.montant_paye;
      const newStatutPaiement =
        newMontantRestant <= 0
          ? "paye"
          : newMontantRestant < updatedData.total
            ? "partiel"
            : "impaye";

      db.prepare(
        `
        UPDATE ventes 
        SET client_id = ?, client_nom = ?, serveur_id = ?, total = ?, montant_paye = ?, 
            montant_restant = ?, monnaie_rendue = ?, statut_paiement = ?, methode_paiement = ?,
            remise_type = ?, remise_valeur = ?, total_avant_remise = ?
        WHERE id = ?
      `,
      ).run(
        updatedData.client_id || null,
        updatedData.client_nom || oldSale.client_nom || "Client comptoir",
        updatedData.serveur_id || null,
        updatedData.total,
        updatedData.montant_paye,
        newMontantRestant,
        updatedData.monnaie_rendue || 0,
        newStatutPaiement,
        updatedData.methode_paiement,
        updatedData.remise_type || null,
        updatedData.remise_valeur || 0,
        updatedData.total_avant_remise || null,
        venteId,
      );

      for (const item of updatedData.produits) {
        db.prepare(
          `
          INSERT INTO ventes_produits (vente_id, produit_id, quantite, prix_unitaire, sous_total)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(
          venteId,
          item.produit_id,
          item.quantite,
          item.prix_unitaire,
          item.sous_total,
        );

        db.prepare(
          "UPDATE produits SET quantite_stock = quantite_stock - ? WHERE id = ?",
        ).run(item.quantite, item.produit_id);
      }

      if (updatedData.client_id && newMontantRestant > 0) {
        db.prepare(
          "UPDATE clients SET solde_du = solde_du + ? WHERE id = ?",
        ).run(newMontantRestant, updatedData.client_id);
      }

      const montantEncaisse =
        newMontantRestant > 0 ? updatedData.montant_paye : updatedData.total;
      if (montantEncaisse > 0) {
        db.prepare(
          `
          INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        ).run(
          "vente",
          venteId,
          `Vente #${venteId} (modifiée)${newMontantRestant > 0 ? " (à crédit)" : ""}`,
          montantEncaisse,
          "entree",
          updatedData.methode_paiement,
        );
      }

      const articles = updatedData.produits.map((item: any) => ({
        designation: item.nom_produit || item.nom,
        quantite: item.quantite,
        prixUnitaire: item.prix_unitaire,
        total: item.sous_total || item.prix_unitaire * item.quantite,
      }));

      try {
        db.exec(
          "ALTER TABLE factures ADD COLUMN montant_restant REAL DEFAULT 0",
        );
      } catch (e) {
        // Column already exists
      }
      try {
        db.exec(
          "ALTER TABLE factures ADD COLUMN statut_paiement TEXT DEFAULT 'paye'",
        );
      } catch (e) {
        // Column already exists
      }

      db.prepare(
        `
        UPDATE factures 
        SET client_nom = ?, serveur_nom = ?, total_ttc = ?, methode_paiement = ?,
            montant_paye = ?, monnaie_rendue = ?, montant_restant = ?, statut_paiement = ?,
            remise_type = ?, remise_valeur = ?, total_avant_remise = ?, articles = ?
        WHERE vente_id = ?
      `,
      ).run(
        updatedData.client_nom || "Client comptoir",
        updatedData.serveur_nom || null,
        updatedData.total,
        updatedData.methode_paiement === "especes"
          ? "Espèces"
          : updatedData.methode_paiement === "carte"
            ? "Carte bancaire"
            : "Mobile Money",
        updatedData.montant_paye,
        updatedData.monnaie_rendue || 0,
        newMontantRestant,
        newStatutPaiement,
        updatedData.remise_type || null,
        updatedData.remise_valeur || 0,
        updatedData.total_avant_remise || null,
        JSON.stringify(articles),
        venteId,
      );

      logAudit(
        "modifier vente",
        "ventes",
        venteId,
        `Vente #${venteId} modifiée. Ancien total: ${oldSale.total}, Nouveau total: ${updatedData.total}`,
        utilisateur_id,
        utilisateur_nom,
      );

      return { id: venteId, ...updatedData };
    })();
  } catch (error) {
    console.error("Erreur update sale:", error);
    throw error;
  }
}

// ===== STATISTIQUES =====

export function getDashboardStats() {
  try {
    // Total des ventes aujourd'hui (hors produits sans_stock)
    const ventesJour = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) = DATE('now')
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get() as { total: number };

    // Total des ventes hier (hors produits sans_stock)
    const ventesHier = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) = DATE('now', '-1 day')
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get() as { total: number };

    // Total des ventes ce mois (hors produits sans_stock)
    const ventesMois = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now')
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get() as { total: number };

    // Total des ventes le mois précédent (hors produits sans_stock)
    const ventesMoisPrecedent = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now', '-1 month')
        AND COALESCE(p.sans_stock, 0) = 0
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

    // Produits en stock faible (hors produits sans_stock)
    const stockFaible = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM produits
      WHERE quantite_stock <= stock_min
        AND COALESCE(sans_stock, 0) = 0
    `,
      )
      .get() as { count: number };

    // Valeur totale du stock (hors produits sans_stock)
    const valeurStock = db
      .prepare(
        `
      SELECT COALESCE(SUM(prix_achat * quantite_stock), 0) as valeur
      FROM produits
      WHERE COALESCE(sans_stock, 0) = 0
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

    // Profit total ce mois (somme des marges, hors produits sans_stock)
    const profitMois = db
      .prepare(
        `
      SELECT COALESCE(SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite), 0) as profit
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now')
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get() as { profit: number };

    // Coûts ce mois (prix d'achat des produits vendus, hors produits sans_stock)
    const coutsMois = db
      .prepare(
        `
      SELECT COALESCE(SUM(p.prix_achat * vp.quantite), 0) as couts
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE strftime('%Y-%m', v.date_vente) = strftime('%Y-%m', 'now')
        AND COALESCE(p.sans_stock, 0) = 0
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

export function getDashboardStatsByDate(startDate: string, endDate: string) {
  try {
    // Calculer la période précédente (même durée)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1); // Jour avant la période
    const prevStart = new Date(prevEnd.getTime() - duration);
    const prevStartStr = prevStart.toISOString().split("T")[0];
    const prevEndStr = prevEnd.toISOString().split("T")[0];

    // Total des ventes pour la période sélectionnée (hors produits sans_stock)
    const ventesPeriode = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(startDate, endDate) as { total: number };

    // Total des ventes pour la période précédente (hors produits sans_stock)
    const ventesPeriodePrecedente = db
      .prepare(
        `
      SELECT COALESCE(SUM(vp.sous_total), 0) as total
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(prevStartStr, prevEndStr) as { total: number };

    // Nombre de ventes pour la période
    const nbVentesPeriode = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM ventes
      WHERE DATE(date_vente) BETWEEN DATE(?) AND DATE(?)
    `,
      )
      .get(startDate, endDate) as { count: number };

    // Profit pour la période (hors produits sans_stock)
    const profitPeriode = db
      .prepare(
        `
      SELECT COALESCE(SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite), 0) as profit
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(startDate, endDate) as { profit: number };

    // Profit période précédente (hors produits sans_stock)
    const profitPeriodePrecedente = db
      .prepare(
        `
      SELECT COALESCE(SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite), 0) as profit
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(prevStartStr, prevEndStr) as { profit: number };

    // Coûts pour la période (hors produits sans_stock)
    const coutsPeriode = db
      .prepare(
        `
      SELECT COALESCE(SUM(p.prix_achat * vp.quantite), 0) as couts
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(startDate, endDate) as { couts: number };

    // Coûts période précédente (hors produits sans_stock)
    const coutsPeriodePrecedente = db
      .prepare(
        `
      SELECT COALESCE(SUM(p.prix_achat * vp.quantite), 0) as couts
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
        AND COALESCE(p.sans_stock, 0) = 0
    `,
      )
      .get(prevStartStr, prevEndStr) as { couts: number };

    // Nombre total de produits (inchangé)
    const totalProduits = db
      .prepare(`SELECT COUNT(*) as count FROM produits`)
      .get() as { count: number };

    // Produits en stock faible (hors produits sans_stock)
    const stockFaible = db
      .prepare(
        `SELECT COUNT(*) as count FROM produits WHERE quantite_stock <= stock_min AND COALESCE(sans_stock, 0) = 0`,
      )
      .get() as { count: number };

    // Valeur totale du stock (hors produits sans_stock)
    const valeurStock = db
      .prepare(
        `SELECT COALESCE(SUM(prix_achat * quantite_stock), 0) as valeur FROM produits WHERE COALESCE(sans_stock, 0) = 0`,
      )
      .get() as { valeur: number };

    // Nombre de fournisseurs (inchangé)
    const nbFournisseurs = db
      .prepare(`SELECT COUNT(*) as count FROM fournisseurs`)
      .get() as { count: number };

    // Nombre de clients (inchangé)
    const nbClients = db
      .prepare(`SELECT COUNT(*) as count FROM clients`)
      .get() as { count: number };

    // Total des remises pour la période
    const totalRemisesPeriode = db
      .prepare(
        `SELECT COALESCE(SUM(
          CASE
            WHEN remise_type = 'pourcentage' THEN total_avant_remise * remise_valeur / 100
            WHEN remise_type = 'montant' THEN remise_valeur
            ELSE 0
          END
        ), 0) as total
        FROM ventes
        WHERE DATE(date_vente) BETWEEN DATE(?) AND DATE(?)`,
      )
      .get(startDate, endDate) as { total: number };

    // Total crédits accordés (montant_restant des ventes impayées/partielles de la période)
    const totalCreditsAccordes = db
      .prepare(
        `SELECT COALESCE(SUM(montant_restant), 0) as total
         FROM ventes
         WHERE DATE(date_vente) BETWEEN DATE(?) AND DATE(?)
           AND statut_paiement IN ('impaye', 'partiel')`,
      )
      .get(startDate, endDate) as { total: number };

    // Total crédits soldés (paiements reçus dans la période)
    const totalCreditsSoldes = db
      .prepare(
        `SELECT COALESCE(SUM(montant), 0) as total
         FROM paiements_clients
         WHERE DATE(date_paiement) BETWEEN DATE(?) AND DATE(?)`,
      )
      .get(startDate, endDate) as { total: number };

    // Total dépenses pour la période
    const totalDepensesPeriode = db
      .prepare(
        `SELECT COALESCE(SUM(montant), 0) as total
         FROM depenses
         WHERE DATE(date_depense) BETWEEN DATE(?) AND DATE(?)`,
      )
      .get(startDate, endDate) as { total: number };

    // Caisse ouverte
    const caisseOuverte = getOpenCaisse();

    const ventes = ventesPeriode.total;
    const remises = totalRemisesPeriode.total;
    const depenses = totalDepensesPeriode.total;
    const couts = coutsPeriode.couts;
    const resultatTTC = ventes - (remises + depenses);
    const beneficeNet = ventes - (couts + remises + depenses);

    return {
      ventesPeriode: ventes,
      ventesPeriodePrecedente: ventesPeriodePrecedente.total,
      nbVentesPeriode: nbVentesPeriode.count,
      profitPeriode: profitPeriode.profit,
      profitPeriodePrecedente: profitPeriodePrecedente.profit,
      coutsPeriode: couts,
      coutsPeriodePrecedente: coutsPeriodePrecedente.couts,
      totalProduits: totalProduits.count,
      stockFaible: stockFaible.count,
      valeurStock: valeurStock.valeur,
      nbFournisseurs: nbFournisseurs.count,
      nbClients: nbClients.count,
      dateDebut: startDate,
      dateFin: endDate,
      totalRemisesPeriode: remises,
      totalCreditsAccordes: totalCreditsAccordes.total,
      totalCreditsSoldes: totalCreditsSoldes.total,
      totalDepensesPeriode: depenses,
      resultatTTC,
      beneficeNet,
      caisseOuverte: caisseOuverte || null,
    };
  } catch (error) {
    console.error("Erreur get dashboard stats by date:", error);
    throw error;
  }
}

export function getDashboardCardDetails(type: string, startDate: string, endDate: string) {
  try {
    if (type === "ventes") {
      return db
        .prepare(
          `SELECT p.nom, SUM(vp.quantite) as quantite_vendue, SUM(vp.sous_total) as ca_genere
           FROM ventes_produits vp
           JOIN ventes v ON vp.vente_id = v.id
           JOIN produits p ON vp.produit_id = p.id
           WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
           GROUP BY p.id
           ORDER BY ca_genere DESC`,
        )
        .all(startDate, endDate);
    }
    if (type === "benefice") {
      return db
        .prepare(
          `SELECT p.nom, SUM(vp.quantite) as quantite_vendue,
                  SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite) as benefice_genere
           FROM ventes_produits vp
           JOIN ventes v ON vp.vente_id = v.id
           JOIN produits p ON vp.produit_id = p.id
           WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
           GROUP BY p.id
           ORDER BY benefice_genere DESC`,
        )
        .all(startDate, endDate);
    }
    if (type === "nb_ventes") {
      return db
        .prepare(
          `SELECT v.id, v.date_vente, v.total, v.client_nom, v.methode_paiement,
                  v.statut_paiement, COUNT(vp.id) as nb_articles
           FROM ventes v
           LEFT JOIN ventes_produits vp ON vp.vente_id = v.id
           WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
           GROUP BY v.id
           ORDER BY v.date_vente DESC`,
        )
        .all(startDate, endDate);
    }
    if (type === "couts") {
      return db
        .prepare(
          `SELECT p.nom, SUM(vp.quantite) as quantite_vendue,
                  SUM(p.prix_achat * vp.quantite) as cout_total
           FROM ventes_produits vp
           JOIN ventes v ON vp.vente_id = v.id
           JOIN produits p ON vp.produit_id = p.id
           WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
           GROUP BY p.id
           ORDER BY cout_total DESC`,
        )
        .all(startDate, endDate);
    }
    return [];
  } catch (error) {
    console.error("Erreur getDashboardCardDetails:", error);
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
        AND COALESCE(p.sans_stock, 0) = 0
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
    const oldUser = db
      .prepare("SELECT * FROM utilisateurs WHERE id = ?")
      .get(id) as any;

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
    if (oldUser.nom !== user.nom && user.nom)
      changes.push(`nom: "${oldUser.nom}" → "${user.nom}"`);
    if (oldUser.email !== user.email && user.email)
      changes.push(`email: "${oldUser.email}" → "${user.email}"`);
    if (oldUser.role !== user.role && user.role)
      changes.push(`role: "${oldUser.role}" → "${user.role}"`);
    if (oldUser.actif !== user.actif && user.actif !== undefined)
      changes.push(`actif: ${oldUser.actif} → ${user.actif}`);

    const details =
      changes.length > 0
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

export function deleteUser(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const user = db
      .prepare("SELECT * FROM utilisateurs WHERE id = ?")
      .get(id) as any;
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
    const stmt = db.prepare(
      "SELECT * FROM fournisseurs ORDER BY nom LIMIT 1000",
    );
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
      `Fournisseur: ${supplier.nom} - Téléphone: ${supplier.telephone || "N/A"}`,
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
    const oldSupplier = db
      .prepare("SELECT * FROM fournisseurs WHERE id = ?")
      .get(id) as any;

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
    if (oldSupplier.nom !== supplier.nom)
      changes.push(`nom: "${oldSupplier.nom}" → "${supplier.nom}"`);
    if (oldSupplier.telephone !== supplier.telephone)
      changes.push(
        `telephone: "${oldSupplier.telephone}" → "${supplier.telephone}"`,
      );
    if (oldSupplier.email !== supplier.email)
      changes.push(`email: "${oldSupplier.email}" → "${supplier.email}"`);
    if (oldSupplier.adresse !== supplier.adresse)
      changes.push(`adresse: "${oldSupplier.adresse}" → "${supplier.adresse}"`);
    if (oldSupplier.ville !== supplier.ville)
      changes.push(`ville: "${oldSupplier.ville}" → "${supplier.ville}"`);

    const details =
      changes.length > 0
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

export function deleteSupplier(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const supplier = db
      .prepare("SELECT * FROM fournisseurs WHERE id = ?")
      .get(id) as any;
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
      `);
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
    const purchaseIds = purchases.map((p) => p.id);

    const placeholders = purchaseIds.map(() => "?").join(",");
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
    allProducts.forEach((prod) => {
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

    const purchaseIds = purchases.map((p) => p.id);
    const placeholders = purchaseIds.map(() => "?").join(",");
    const productsStmt = db.prepare(`
      SELECT ap.*, p.nom as nom_produit
      FROM achats_produits ap
      JOIN produits p ON ap.produit_id = p.id
      WHERE ap.achat_id IN (${placeholders})
      ORDER BY ap.achat_id, ap.id
    `);

    const allProducts = productsStmt.all(...purchaseIds) as any[];

    const productsByPurchase: Record<number, any[]> = {};
    allProducts.forEach((prod) => {
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
        `Paiement de ${payment.montant} pour achat #${payment.achat_id} - Méthode: ${payment.methode_paiement}${payment.reference ? ` - Réf: ${payment.reference}` : ""}`,
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
      `Client: ${client.nom} - Téléphone: ${client.telephone || "N/A"}`,
      client.utilisateur_id,
      client.utilisateur_nom,
    );

    return db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
  } catch (error) {
    console.error("Erreur create client:", error);
    throw error;
  }
}

export function updateClient(id: number, client: any) {
  try {
    const oldClient = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(id) as any;

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

    // Propager le changement de nom dans ventes et factures
    if (oldClient.nom !== client.nom) {
      db.prepare(`UPDATE ventes SET client_nom = ? WHERE client_id = ?`).run(client.nom, id);
      db.prepare(`UPDATE factures SET client_nom = ? WHERE client_nom = ?`).run(client.nom, oldClient.nom);
      db.prepare(`UPDATE factures_proforma SET client_nom = ? WHERE client_id = ?`).run(client.nom, id);
    }

    const changes = [];
    if (oldClient.nom !== client.nom)
      changes.push(`nom: "${oldClient.nom}" → "${client.nom}"`);
    if (oldClient.telephone !== client.telephone)
      changes.push(
        `telephone: "${oldClient.telephone}" → "${client.telephone}"`,
      );
    if (oldClient.email !== client.email)
      changes.push(`email: "${oldClient.email}" → "${client.email}"`);
    if (oldClient.adresse !== client.adresse)
      changes.push(`adresse: "${oldClient.adresse}" → "${client.adresse}"`);
    if (oldClient.ville !== client.ville)
      changes.push(`ville: "${oldClient.ville}" → "${client.ville}"`);

    const details =
      changes.length > 0
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

export function deleteClient(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(id) as any;

    if (client && client.solde_du > 0) {
      throw new Error(
        `Impossible de supprimer ce client : il a une dette de ${client.solde_du} FCFA. Réglez d'abord la dette.`,
      );
    }

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

// ===== PRIX PERSONNALISÉS CLIENTS =====

export function getClientPrices(clientId: number) {
  try {
    const stmt = db.prepare(`
      SELECT cp.*, p.nom as produit_nom, p.prix_vente as prix_standard
      FROM client_prix cp
      JOIN produits p ON cp.produit_id = p.id
      WHERE cp.client_id = ?
      ORDER BY p.nom
    `);
    return stmt.all(clientId);
  } catch (error) {
    console.error("Erreur get client prices:", error);
    throw error;
  }
}

export function getClientPrice(clientId: number, productId: number) {
  try {
    const stmt = db.prepare(`
      SELECT cp.*, p.nom as produit_nom, p.prix_vente as prix_standard
      FROM client_prix cp
      JOIN produits p ON cp.produit_id = p.id
      WHERE cp.client_id = ? AND cp.produit_id = ?
    `);
    return stmt.get(clientId, productId);
  } catch (error) {
    console.error("Erreur get client price:", error);
    throw error;
  }
}

export function createClientPrice(clientPrice: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO client_prix (client_id, produit_id, prix_personnalise)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(
      clientPrice.client_id,
      clientPrice.produit_id,
      clientPrice.prix_personnalise,
    );

    logAudit(
      "créer prix client",
      "client_prix",
      Number(result.lastInsertRowid),
      `Prix personnalisé pour produit #${clientPrice.produit_id}: ${clientPrice.prix_personnalise}`,
      clientPrice.utilisateur_id,
      clientPrice.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur create client price:", error);
    throw error;
  }
}

export function updateClientPrice(id: number, clientPrice: any) {
  try {
    const oldPrice = db
      .prepare("SELECT * FROM client_prix WHERE id = ?")
      .get(id) as any;

    if (!oldPrice) {
      throw new Error("Prix client non trouvé");
    }

    const stmt = db.prepare(`
      UPDATE client_prix
      SET prix_personnalise = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(clientPrice.prix_personnalise, id);

    logAudit(
      "modifier prix client",
      "client_prix",
      id,
      `Prix modifié: ${oldPrice.prix_personnalise} → ${clientPrice.prix_personnalise}`,
      clientPrice.utilisateur_id,
      clientPrice.utilisateur_nom,
    );

    return result;
  } catch (error) {
    console.error("Erreur update client price:", error);
    throw error;
  }
}

export function deleteClientPrice(id: number) {
  try {
    const price = db
      .prepare("SELECT * FROM client_prix WHERE id = ?")
      .get(id) as any;
    const stmt = db.prepare("DELETE FROM client_prix WHERE id = ?");
    const result = stmt.run(id);

    if (price) {
      logAudit(
        "supprimer prix client",
        "client_prix",
        id,
        `Prix supprimé pour produit #${price.produit_id}`,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete client price:", error);
    throw error;
  }
}

export function bulkCreateClientPrices(clientId: number, prices: any[]) {
  try {
    return db.transaction(() => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO client_prix (client_id, produit_id, prix_personnalise)
        VALUES (?, ?, ?)
      `);

      for (const price of prices) {
        stmt.run(clientId, price.produit_id, price.prix_personnalise);
      }

      logAudit(
        "importer prix client",
        "client_prix",
        clientId,
        `${prices.length} prix personnalisés importés`,
      );

      return { success: true, count: prices.length };
    })();
  } catch (error) {
    console.error("Erreur bulk create client prices:", error);
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
    const stmt = db.prepare(
      "SELECT * FROM serveurs WHERE actif = 1 ORDER BY nom",
    );
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
      `Serveur: ${server.nom} - Téléphone: ${server.telephone || "N/A"} - Actif: ${server.actif}`,
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
    const oldServer = db
      .prepare("SELECT * FROM serveurs WHERE id = ?")
      .get(id) as any;

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
    if (oldServer.nom !== server.nom)
      changes.push(`nom: "${oldServer.nom}" → "${server.nom}"`);
    if (oldServer.telephone !== server.telephone)
      changes.push(
        `telephone: "${oldServer.telephone}" → "${server.telephone}"`,
      );
    if (oldServer.actif !== server.actif)
      changes.push(`actif: ${oldServer.actif} → ${server.actif}`);

    const details =
      changes.length > 0
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

export function deleteServer(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const server = db
      .prepare("SELECT * FROM serveurs WHERE id = ?")
      .get(id) as any;
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

// ===== DETTES CLIENTS =====

export function getCustomerDebts() {
  try {
    const stmt = db.prepare(`
      SELECT
        c.id as client_id,
        c.nom as client_nom,
        c.telephone,
        c.solde_du,
        COUNT(v.id) as nb_ventes_impayees,
        SUM(v.montant_restant) as total_restant
      FROM clients c
      LEFT JOIN ventes v ON c.id = v.client_id AND v.montant_restant > 0
      WHERE c.solde_du > 0
      GROUP BY c.id
      ORDER BY c.solde_du DESC
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get customer debts:", error);
    throw error;
  }
}

export function getCustomerUnpaidSales(clientId: number) {
  try {
    const stmt = db.prepare(`
      SELECT v.*, c.nom as client_nom
      FROM ventes v
      JOIN clients c ON v.client_id = c.id
      WHERE v.client_id = ? AND v.montant_restant > 0
      ORDER BY v.date_vente DESC
    `);
    const sales = stmt.all(clientId) as any[];

    if (sales.length === 0) {
      return [];
    }

    const saleIds = sales.map((s) => s.id);
    const placeholders = saleIds.map(() => "?").join(",");
    const productsStmt = db.prepare(`
      SELECT vp.*, p.nom as nom_produit
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      WHERE vp.vente_id IN (${placeholders})
      ORDER BY vp.vente_id, vp.id
    `);

    const allProducts = productsStmt.all(...saleIds) as any[];

    const productsBySale: Record<number, any[]> = {};
    allProducts.forEach((prod) => {
      if (!productsBySale[prod.vente_id]) {
        productsBySale[prod.vente_id] = [];
      }
      productsBySale[prod.vente_id].push(prod);
    });

    return sales.map((sale) => ({
      ...sale,
      produits: productsBySale[sale.id] || [],
    }));
  } catch (error) {
    console.error("Erreur get customer unpaid sales:", error);
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
        `Paiement dette client pour vente #${payment.vente_id}`,
        payment.montant,
        "entree",
        payment.methode_paiement,
      );

      // Mettre à jour la facture liée à la vente
      const venteUpdated = db
        .prepare(
          `
        SELECT montant_paye, montant_restant, statut_paiement FROM ventes WHERE id = ?
      `,
        )
        .get(payment.vente_id) as any;

      if (venteUpdated) {
        const updateFactureStmt = db.prepare(`
          UPDATE factures
          SET montant_paye = ?,
              methode_paiement = CASE
                WHEN ? != methode_paiement THEN methode_paiement || ' + ' || ?
                ELSE methode_paiement
              END
          WHERE vente_id = ?
        `);
        updateFactureStmt.run(
          venteUpdated.montant_paye,
          payment.methode_paiement,
          payment.methode_paiement,
          payment.vente_id,
        );
      }

      // Récupérer la facture mise à jour pour le reçu
      const invoice = db
        .prepare(
          `
        SELECT f.*, v.montant_restant, v.statut_paiement
        FROM factures f
        LEFT JOIN ventes v ON f.vente_id = v.id
        WHERE f.vente_id = ?
      `,
        )
        .get(payment.vente_id) as any;

      if (invoice && invoice.articles) {
        invoice.articles = JSON.parse(invoice.articles);
      }

      // Enregistrer dans les audits
      logAudit(
        "payer dette client",
        "paiements_clients",
        Number(result.lastInsertRowid),
        `Paiement de ${payment.montant} pour vente #${payment.vente_id} - Méthode: ${payment.methode_paiement}${payment.reference ? ` - Réf: ${payment.reference}` : ""}`,
        payment.utilisateur_id,
        payment.utilisateur_nom,
      );

      return {
        ...result,
        payment_id: result.lastInsertRowid,
        montant: payment.montant,
        invoice,
      };
    })();
  } catch (error) {
    console.error("Erreur create customer payment:", error);
    throw error;
  }
}

export function payClientDebtByAmount(
  clientId: number,
  montant: number,
  methode: string,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    return db.transaction(() => {
      const unpaidSales = db
        .prepare(
          `SELECT id, montant_restant FROM ventes
           WHERE client_id = ? AND statut_paiement IN ('impaye', 'partiel') AND montant_restant > 0
           ORDER BY date_vente ASC`,
        )
        .all(clientId) as any[];

      let remaining = montant;
      const updatedSales: number[] = [];

      for (const sale of unpaidSales) {
        if (remaining <= 0) break;
        const toPay = Math.min(remaining, sale.montant_restant);
        remaining -= toPay;

        db.prepare(
          `UPDATE ventes SET montant_paye = montant_paye + ?, montant_restant = montant_restant - ?,
           statut_paiement = CASE WHEN montant_restant - ? <= 0 THEN 'paye' ELSE 'partiel' END
           WHERE id = ?`,
        ).run(toPay, toPay, toPay, sale.id);

        db.prepare(
          `UPDATE factures SET montant_paye = montant_paye + ? WHERE vente_id = ?`,
        ).run(toPay, sale.id);

        db.prepare(
          `INSERT INTO paiements_clients (vente_id, client_id, montant, methode_paiement)
           VALUES (?, ?, ?, ?)`,
        ).run(sale.id, clientId, toPay, methode);

        db.prepare(
          `INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
           VALUES ('paiement_client', ?, ?, ?, 'entree', ?)`,
        ).run(sale.id, `Paiement global dette client #${clientId} - Vente #${sale.id}`, toPay, methode);

        updatedSales.push(sale.id);
      }

      db.prepare(
        `UPDATE clients SET solde_du = MAX(0, solde_du - ?) WHERE id = ?`,
      ).run(montant, clientId);

      logAudit(
        "paiement global dette client",
        "paiements_clients",
        clientId,
        `Paiement global de ${montant} pour client #${clientId} - ${updatedSales.length} vente(s) touchée(s)`,
        utilisateur_id,
        utilisateur_nom,
      );

      return { success: true, updatedSales };
    })();
  } catch (error) {
    console.error("Erreur payClientDebtByAmount:", error);
    throw error;
  }
}

export function paySupplierDebtByAmount(
  supplierId: number,
  montant: number,
  methode: string,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    return db.transaction(() => {
      const unpaidPurchases = db
        .prepare(
          `SELECT id, montant_restant FROM achats
           WHERE fournisseur_id = ? AND statut_paiement IN ('impaye', 'partiel') AND montant_restant > 0
           ORDER BY date_achat ASC`,
        )
        .all(supplierId) as any[];

      let remaining = montant;
      const updatedPurchases: number[] = [];

      for (const purchase of unpaidPurchases) {
        if (remaining <= 0) break;
        const toPay = Math.min(remaining, purchase.montant_restant);
        remaining -= toPay;

        db.prepare(
          `UPDATE achats SET montant_paye = montant_paye + ?, montant_restant = montant_restant - ?,
           statut_paiement = CASE WHEN montant_restant - ? <= 0 THEN 'paye' ELSE 'partiel' END
           WHERE id = ?`,
        ).run(toPay, toPay, toPay, purchase.id);

        db.prepare(
          `INSERT INTO paiements_fournisseurs (achat_id, fournisseur_id, montant, methode_paiement)
           VALUES (?, ?, ?, ?)`,
        ).run(purchase.id, supplierId, toPay, methode);

        db.prepare(
          `INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
           VALUES ('paiement_fournisseur', ?, ?, ?, 'sortie', ?)`,
        ).run(purchase.id, `Paiement global dette fournisseur #${supplierId} - Achat #${purchase.id}`, toPay, methode);

        updatedPurchases.push(purchase.id);
      }

      db.prepare(
        `UPDATE fournisseurs SET solde_du = MAX(0, solde_du - ?) WHERE id = ?`,
      ).run(montant, supplierId);

      logAudit(
        "paiement global dette fournisseur",
        "paiements_fournisseurs",
        supplierId,
        `Paiement global de ${montant} pour fournisseur #${supplierId} - ${updatedPurchases.length} achat(s) touché(s)`,
        utilisateur_id,
        utilisateur_nom,
      );

      return { success: true, updatedPurchases };
    })();
  } catch (error) {
    console.error("Erreur paySupplierDebtByAmount:", error);
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

export function getAccountingEntriesPaginated(
  page: number = 1,
  limit: number = 20,
  startDate?: string,
  endDate?: string,
) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = "";
    let params: any[] = [];

    if (startDate && endDate) {
      whereClause = "WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    // Count total
    const countStmt = db.prepare(
      `SELECT COUNT(*) as total FROM comptabilite ${whereClause}`,
    );
    const { total } = (
      params.length > 0 ? countStmt.get(...params) : countStmt.get()
    ) as { total: number };

    // Get paginated data
    const dataStmt = db.prepare(`
      SELECT * FROM comptabilite
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const data =
      params.length > 0
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
    const totals = (
      params.length > 0 ? totalsStmt.get(...params) : totalsStmt.get()
    ) as { totalEntrees: number; totalSorties: number };

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalEntrees: totals.totalEntrees,
      totalSorties: totals.totalSorties,
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

export function getTreasuryByPeriod(startDate: string, endDate: string) {
  try {
    const entrees = db
      .prepare(
        `
      SELECT COALESCE(SUM(montant), 0) as total
      FROM comptabilite
      WHERE type_mouvement = 'entree'
      AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
    `,
      )
      .get(startDate, endDate) as { total: number };

    const sorties = db
      .prepare(
        `
      SELECT COALESCE(SUM(montant), 0) as total
      FROM comptabilite
      WHERE type_mouvement = 'sortie'
      AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
    `,
      )
      .get(startDate, endDate) as { total: number };

    return {
      total: entrees.total - sorties.total,
      entrees: entrees.total,
      sorties: sorties.total,
    };
  } catch (error) {
    console.error("Erreur get treasury by period:", error);
    throw error;
  }
}

// ==================== GESTION DES DÉPENSES ====================

export function getExpenses(startDate?: string, endDate?: string) {
  try {
    let query = "SELECT * FROM depenses";
    const params: any[] = [];

    if (startDate && endDate) {
      query += " WHERE DATE(date_depense) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    query += " ORDER BY date_depense DESC, created_at DESC";

    return db.prepare(query).all(...params);
  } catch (error) {
    console.error("Erreur get expenses:", error);
    throw error;
  }
}

export function getExpensesPaginated(
  page: number,
  limit: number,
  startDate?: string,
  endDate?: string,
  categorie?: string,
) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (startDate && endDate) {
      whereClause += " AND DATE(date_depense) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    if (categorie) {
      whereClause += " AND categorie = ?";
      params.push(categorie);
    }

    const countQuery = `SELECT COUNT(*) as total, COALESCE(SUM(montant), 0) as totalMontant FROM depenses ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params) as {
      total: number;
      totalMontant: number;
    };

    const dataQuery = `SELECT * FROM depenses ${whereClause} ORDER BY date_depense DESC, created_at DESC LIMIT ? OFFSET ?`;
    const data = db.prepare(dataQuery).all(...params, limit, offset);

    return {
      data,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
      totalMontant: countResult.totalMontant,
    };
  } catch (error) {
    console.error("Erreur get expenses paginated:", error);
    throw error;
  }
}

export function createExpense(expense: any) {
  try {
    const stmt = db.prepare(`
      INSERT INTO depenses (categorie, description, montant, date_depense, methode_paiement, reference, utilisateur_id, utilisateur_nom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      expense.categorie,
      expense.description,
      expense.montant,
      expense.date_depense,
      expense.methode_paiement || null,
      expense.reference || null,
      expense.utilisateur_id || null,
      expense.utilisateur_nom || null,
    );

    const expenseId = result.lastInsertRowid;

    db.prepare(`
      INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "depense",
      expenseId,
      `Dépense: ${expense.description} (${expense.categorie})`,
      expense.montant,
      "sortie",
      expense.methode_paiement || null,
    );

    if (expense.utilisateur_id && expense.utilisateur_nom) {
      createAuditLog({
        utilisateur_id: expense.utilisateur_id,
        utilisateur_nom: expense.utilisateur_nom,
        action: "CREATE",
        table_cible: "depenses",
        enregistrement_id: expenseId,
        details: JSON.stringify(expense),
      });
    }

    return { id: expenseId, ...expense };
  } catch (error) {
    console.error("Erreur create expense:", error);
    throw error;
  }
}

export function updateExpense(id: number, expense: any) {
  try {
    const oldExpense = db.prepare("SELECT * FROM depenses WHERE id = ?").get(id) as any;
    if (!oldExpense) {
      throw new Error("Dépense non trouvée");
    }

    const stmt = db.prepare(`
      UPDATE depenses
      SET categorie = ?, description = ?, montant = ?, date_depense = ?, methode_paiement = ?, reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      expense.categorie,
      expense.description,
      expense.montant,
      expense.date_depense,
      expense.methode_paiement || null,
      expense.reference || null,
      id,
    );

    db.prepare(`
      UPDATE comptabilite
      SET description = ?, montant = ?, methode_paiement = ?
      WHERE type = 'depense' AND reference_id = ?
    `).run(
      `Dépense: ${expense.description} (${expense.categorie})`,
      expense.montant,
      expense.methode_paiement || null,
      id,
    );

    if (expense.utilisateur_id && expense.utilisateur_nom) {
      createAuditLog({
        utilisateur_id: expense.utilisateur_id,
        utilisateur_nom: expense.utilisateur_nom,
        action: "UPDATE",
        table_cible: "depenses",
        enregistrement_id: id,
        details: JSON.stringify({ old: oldExpense, new: expense }),
      });
    }

    return { id, ...expense };
  } catch (error) {
    console.error("Erreur update expense:", error);
    throw error;
  }
}

export function deleteExpense(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const expense = db.prepare("SELECT * FROM depenses WHERE id = ?").get(id) as any;
    if (!expense) {
      throw new Error("Dépense non trouvée");
    }

    db.prepare("DELETE FROM comptabilite WHERE type = 'depense' AND reference_id = ?").run(id);
    db.prepare("DELETE FROM depenses WHERE id = ?").run(id);

    if (utilisateur_id && utilisateur_nom) {
      createAuditLog({
        utilisateur_id,
        utilisateur_nom,
        action: "DELETE",
        table_cible: "depenses",
        enregistrement_id: id,
        details: JSON.stringify(expense),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Erreur delete expense:", error);
    throw error;
  }
}

export function getExpenseStats(startDate?: string, endDate?: string) {
  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (startDate && endDate) {
      whereClause += " AND DATE(date_depense) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    const totalResult = db.prepare(
      `SELECT COALESCE(SUM(montant), 0) as total FROM depenses ${whereClause}`,
    ).get(...params) as { total: number };

    const byCategorie = db.prepare(
      `SELECT categorie, SUM(montant) as total, COUNT(*) as count FROM depenses ${whereClause} GROUP BY categorie ORDER BY total DESC`,
    ).all(...params);

    return {
      total: totalResult.total,
      byCategorie,
    };
  } catch (error) {
    console.error("Erreur get expense stats:", error);
    throw error;
  }
}

// ==================== TOP PRODUITS ET CLIENTS ====================

export function getTopProducts(limit: number = 10, startDate?: string, endDate?: string) {
  try {
    let whereClause = "WHERE COALESCE(p.sans_stock, 0) = 0";
    const params: any[] = [limit];

    if (startDate && endDate) {
      whereClause = "WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?) AND COALESCE(p.sans_stock, 0) = 0";
      params.unshift(startDate, endDate);
    }

    const query = `
      SELECT
        vp.produit_id as product_id,
        p.nom,
        SUM(vp.quantite) as quantite_vendue,
        SUM(vp.sous_total) as chiffre_affaires,
        SUM((vp.prix_unitaire - p.prix_achat) * vp.quantite) as marge
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      JOIN ventes v ON vp.vente_id = v.id
      ${whereClause}
      GROUP BY vp.produit_id
      ORDER BY chiffre_affaires DESC
      LIMIT ?
    `;

    return db.prepare(query).all(...params);
  } catch (error) {
    console.error("Erreur get top products:", error);
    throw error;
  }
}

export function getTopClients(limit: number = 10, startDate?: string, endDate?: string) {
  try {
    let whereClause = "WHERE v.client_id IS NOT NULL";
    const params: any[] = [limit];

    if (startDate && endDate) {
      whereClause += " AND DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)";
      params.unshift(startDate, endDate);
    }

    const query = `
      SELECT
        c.id as client_id,
        c.nom,
        c.telephone,
        SUM(v.total) as chiffre_affaires,
        COUNT(v.id) as nb_achats,
        COALESCE(c.solde_du, 0) as solde_du
      FROM ventes v
      JOIN clients c ON v.client_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY chiffre_affaires DESC
      LIMIT ?
    `;

    return db.prepare(query).all(...params);
  } catch (error) {
    console.error("Erreur get top clients:", error);
    throw error;
  }
}

// Statistiques de profit réelles (basées sur les ventes et coûts des produits)
export function getProfitStats(startDate?: string, endDate?: string) {
  try {
    const params: any[] = [];
    let venteWhereClause = "";
    let achatWhereClause = "";

    if (startDate && endDate) {
      venteWhereClause = "WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)";
      achatWhereClause = "WHERE DATE(date_achat) BETWEEN DATE(?) AND DATE(?)";
      params.push(startDate, endDate);
    }

    // Chiffre d'affaires = Total des ventes hors produits sans_stock
    const caQuery = db.prepare(`
      SELECT COALESCE(SUM(vp.sous_total), 0) as chiffre_affaires
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      ${venteWhereClause ? venteWhereClause + " AND COALESCE(p.sans_stock, 0) = 0" : "WHERE COALESCE(p.sans_stock, 0) = 0"}
    `);
    const caResult = (
      params.length > 0 ? caQuery.get(...params) : caQuery.get()
    ) as { chiffre_affaires: number };

    // Coût des marchandises vendues = Prix d'achat des produits vendus (hors sans_stock)
    const coutQuery = db.prepare(`
      SELECT COALESCE(SUM(p.prix_achat * vp.quantite), 0) as cout_marchandises
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      JOIN produits p ON vp.produit_id = p.id
      ${venteWhereClause ? venteWhereClause + " AND COALESCE(p.sans_stock, 0) = 0" : "WHERE COALESCE(p.sans_stock, 0) = 0"}
    `);
    const coutResult = (
      params.length > 0 ? coutQuery.get(...params) : coutQuery.get()
    ) as { cout_marchandises: number };

    // Nombre de ventes
    const nbVentesQuery = db.prepare(`
      SELECT COUNT(*) as nb_ventes
      FROM ventes v
      ${venteWhereClause}
    `);
    const nbVentesResult = (
      params.length > 0 ? nbVentesQuery.get(...params) : nbVentesQuery.get()
    ) as { nb_ventes: number };

    // Nombre de produits vendus
    const nbProduitsQuery = db.prepare(`
      SELECT COALESCE(SUM(vp.quantite), 0) as nb_produits
      FROM ventes_produits vp
      JOIN ventes v ON vp.vente_id = v.id
      ${venteWhereClause}
    `);
    const nbProduitsResult = (
      params.length > 0 ? nbProduitsQuery.get(...params) : nbProduitsQuery.get()
    ) as { nb_produits: number };

    // Total des achats fournisseurs (argent sorti pour approvisionnement)
    const achatsQuery = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_achats
      FROM achats
      ${achatWhereClause}
    `);
    const achatsResult = (
      params.length > 0 ? achatsQuery.get(...params) : achatsQuery.get()
    ) as { total_achats: number };

    const chiffreAffaires = caResult.chiffre_affaires;
    const coutMarchandises = coutResult.cout_marchandises;
    const beneficeBrut = chiffreAffaires - coutMarchandises;
    const margePercent =
      chiffreAffaires > 0 ? (beneficeBrut / chiffreAffaires) * 100 : 0;

    return {
      chiffreAffaires, // Total des ventes (après remise)
      coutMarchandises, // Prix d'achat des produits vendus
      beneficeBrut, // CA - Coût marchandises
      margePercent, // Bénéfice / CA × 100
      nbVentes: nbVentesResult.nb_ventes,
      nbProduitsVendus: nbProduitsResult.nb_produits,
      totalAchats: achatsResult.total_achats, // Achats fournisseurs
    };
  } catch (error) {
    console.error("Erreur get profit stats:", error);
    throw error;
  }
}

// ===== FACTURES =====

export function createInvoice(invoice: any) {
  try {
    // Add missing columns if they don't exist
    try {
      db.exec("ALTER TABLE factures ADD COLUMN client_telephone TEXT");
    } catch (e) {
      // Column already exists
    }
    try {
      db.exec("ALTER TABLE factures ADD COLUMN client_email TEXT");
    } catch (e) {
      // Column already exists
    }

    const stmt = db.prepare(`
      INSERT INTO factures (numero, vente_id, date_facture, heure_facture, vendeur, client_nom, client_telephone, client_email, serveur_nom, total_ttc, methode_paiement, montant_paye, monnaie_rendue, remise_type, remise_valeur, total_avant_remise, articles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      invoice.numero,
      invoice.vente_id,
      invoice.date_facture,
      invoice.heure_facture,
      invoice.vendeur,
      invoice.client_nom || "Client comptoir",
      invoice.client_telephone || null,
      invoice.client_email || null,
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
      SELECT f.*, v.client_id, v.montant_restant, v.statut_paiement
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
      SELECT f.*, v.client_id, v.montant_restant, v.statut_paiement, v.livraison_differee
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
      SELECT f.*, v.montant_restant, v.statut_paiement, v.client_id, v.livraison_differee
      FROM factures f
      LEFT JOIN ventes v ON f.vente_id = v.id
      WHERE f.vente_id = ?
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
        rccm: "",
        regime_fiscal: "",
        division_fiscale: "",
        numero_compte_uba: "",
        reference_cadastrale: "",
        secteur: "",
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
        SET nom_entreprise = ?, description_entreprise = ?, logo_url = ?, adresse = ?, telephone = ?, telephone2 = ?, email = ?, nif = ?, rccm = ?, regime_fiscal = ?, division_fiscale = ?, numero_compte_uba = ?, reference_cadastrale = ?, secteur = ?, ville = ?, pays = ?, devise = ?, message_pied = ?, support_text = ?, format_facture = ?
        WHERE id = 1
      `);
      stmt.run(
        config.nom_entreprise,
        config.description_entreprise || "",
        config.logo_url || null,
        config.adresse || "",
        config.telephone || "",
        config.telephone2 || "",
        config.email || "",
        config.nif || "",
        config.rccm || "",
        config.regime_fiscal || "",
        config.division_fiscale || "",
        config.numero_compte_uba || "",
        config.reference_cadastrale || "",
        config.secteur || "",
        config.ville || "",
        config.pays || "",
        config.devise || "FCFA",
        config.message_pied || "Merci de votre visite !",
        config.support_text || "",
        config.format_facture || "80mm",
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO configuration (id, nom_entreprise, description_entreprise, logo_url, adresse, telephone, telephone2, email, nif, rccm, regime_fiscal, division_fiscale, numero_compte_uba, reference_cadastrale, secteur, ville, pays, devise, message_pied, support_text, format_facture)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        config.nom_entreprise,
        config.description_entreprise || "",
        config.logo_url || null,
        config.adresse || "",
        config.telephone || "",
        config.telephone2 || "",
        config.email || "",
        config.nif || "",
        config.rccm || "",
        config.regime_fiscal || "",
        config.division_fiscale || "",
        config.numero_compte_uba || "",
        config.reference_cadastrale || "",
        config.secteur || "",
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

export function logAudit(
  action: string,
  table: string,
  recordId?: number,
  details?: string,
  userId?: number,
  userName?: string,
) {
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

    const files = fs
      .readdirSync(backupsDir)
      .filter((file) => file.startsWith("backup-") && file.endsWith(".db"))
      .map((file) => {
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

export function deletePurchase(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const purchase = db
      .prepare("SELECT * FROM achats WHERE id = ?")
      .get(id) as any;

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
    const oldInvoice = db
      .prepare("SELECT * FROM factures WHERE id = ?")
      .get(id) as any;

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

export function deleteInvoice(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const invoice = db
      .prepare("SELECT * FROM factures WHERE id = ?")
      .get(id) as any;

    if (!invoice) {
      throw new Error("Facture introuvable");
    }

    // Si la facture est liée à une vente, supprimer la vente
    // (deleteSale supprime aussi la facture + restaure le stock)
    if (invoice.vente_id) {
      return deleteSale(invoice.vente_id, utilisateur_id, utilisateur_nom);
    }

    // Facture sans vente liée : suppression simple
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

// ===== FACTURES PROFORMA =====

export function createProformaInvoice(
  proforma: any,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    return db.transaction(() => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const countStmt = db.prepare(`
        SELECT COUNT(*) as count FROM factures_proforma 
        WHERE strftime('%Y-%m', created_at) = ?
      `);
      const count = (countStmt.get(`${year}-${month}`) as any)?.count || 0;
      const numero = `PRO-${year}${month}-${String(count + 1).padStart(4, "0")}`;

      const stmt = db.prepare(`
        INSERT INTO factures_proforma (
          numero, client_id, client_nom, client_telephone, client_email,
          date_proforma, date_validite, total_ht, total_ttc,
          remise_type, remise_valeur, total_avant_remise, articles, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        numero,
        proforma.client_id || null,
        proforma.client_nom || "Client comptoir",
        proforma.client_telephone || null,
        proforma.client_email || null,
        date.toISOString().split("T")[0],
        proforma.date_validite || null,
        proforma.total_ht || 0,
        proforma.total_ttc,
        proforma.remise_type || null,
        proforma.remise_valeur || 0,
        proforma.total_avant_remise || null,
        JSON.stringify(proforma.articles),
        proforma.notes || null,
        utilisateur_id || null,
      );

      const proformaId = result.lastInsertRowid;

      logAudit(
        "créer facture proforma",
        "factures_proforma",
        Number(proformaId),
        `Facture proforma ${numero} créée pour ${proforma.client_nom || "Client comptoir"} - Total: ${proforma.total_ttc}`,
        utilisateur_id,
        utilisateur_nom,
      );

      return { id: proformaId, numero, ...proforma };
    })();
  } catch (error) {
    console.error("Erreur création facture proforma:", error);
    throw error;
  }
}

export function getProformaInvoices() {
  try {
    const stmt = db.prepare(`
      SELECT fp.*, c.nom as client_nom_full
      FROM factures_proforma fp
      LEFT JOIN clients c ON fp.client_id = c.id
      ORDER BY fp.created_at DESC
      LIMIT 500
    `);
    const invoices = stmt.all() as any[];
    return invoices.map((inv) => ({
      ...inv,
      articles: JSON.parse(inv.articles || "[]"),
    }));
  } catch (error) {
    console.error("Erreur get proforma invoices:", error);
    throw error;
  }
}

export function getProformaInvoice(id: number) {
  try {
    const stmt = db.prepare(`
      SELECT fp.*, c.nom as client_nom_full, c.telephone as client_tel, c.email as client_mail
      FROM factures_proforma fp
      LEFT JOIN clients c ON fp.client_id = c.id
      WHERE fp.id = ?
    `);
    const invoice = stmt.get(id) as any;
    if (invoice) {
      return {
        ...invoice,
        articles: JSON.parse(invoice.articles || "[]"),
      };
    }
    return null;
  } catch (error) {
    console.error("Erreur get proforma invoice:", error);
    throw error;
  }
}

export function updateProformaInvoice(
  id: number,
  proforma: any,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    return db.transaction(() => {
      const stmt = db.prepare(`
        UPDATE factures_proforma 
        SET client_id = ?, client_nom = ?, client_telephone = ?, client_email = ?,
            date_validite = ?, total_ht = ?, total_ttc = ?,
            remise_type = ?, remise_valeur = ?, total_avant_remise = ?, articles = ?, 
            notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        proforma.client_id || null,
        proforma.client_nom || "Client comptoir",
        proforma.client_telephone || null,
        proforma.client_email || null,
        proforma.date_validite || null,
        proforma.total_ht || 0,
        proforma.total_ttc,
        proforma.remise_type || null,
        proforma.remise_valeur || 0,
        proforma.total_avant_remise || null,
        JSON.stringify(proforma.articles),
        proforma.notes || null,
        id,
      );

      logAudit(
        "modifier facture proforma",
        "factures_proforma",
        id,
        `Facture proforma modifiée - Total: ${proforma.total_ttc}`,
        utilisateur_id,
        utilisateur_nom,
      );

      return { id, ...proforma };
    })();
  } catch (error) {
    console.error("Erreur update proforma invoice:", error);
    throw error;
  }
}

export function updateProformaStatus(
  id: number,
  statut: string,
  vente_id?: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const stmt = db.prepare(`
      UPDATE factures_proforma 
      SET statut = ?, vente_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(statut, vente_id || null, id);

    logAudit(
      "changer statut proforma",
      "factures_proforma",
      id,
      `Statut changé à: ${statut}${vente_id ? ` - Vente #${vente_id}` : ""}`,
      utilisateur_id,
      utilisateur_nom,
    );

    return { id, statut, vente_id };
  } catch (error) {
    console.error("Erreur update proforma status:", error);
    throw error;
  }
}

export function deleteProformaInvoice(
  id: number,
  utilisateur_id?: number,
  utilisateur_nom?: string,
) {
  try {
    const invoice = db
      .prepare("SELECT numero, total_ttc FROM factures_proforma WHERE id = ?")
      .get(id) as any;

    const stmt = db.prepare("DELETE FROM factures_proforma WHERE id = ?");
    const result = stmt.run(id);

    if (invoice) {
      logAudit(
        "supprimer facture proforma",
        "factures_proforma",
        id,
        `Facture proforma ${invoice.numero} supprimée - Total: ${invoice.total_ttc}`,
        utilisateur_id,
        utilisateur_nom,
      );
    }

    return result;
  } catch (error) {
    console.error("Erreur delete proforma invoice:", error);
    throw error;
  }
}

export function getProformaInvoicesPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
  statut?: string,
) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = "1=1";
    const params: any[] = [];

    if (search) {
      whereClause +=
        " AND (fp.numero LIKE ? OR fp.client_nom LIKE ? OR c.nom LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (statut && statut !== "tous") {
      whereClause += " AND fp.statut = ?";
      params.push(statut);
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total FROM factures_proforma fp
      LEFT JOIN clients c ON fp.client_id = c.id
      WHERE ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    const dataStmt = db.prepare(`
      SELECT fp.*, c.nom as client_nom_full
      FROM factures_proforma fp
      LEFT JOIN clients c ON fp.client_id = c.id
      WHERE ${whereClause}
      ORDER BY fp.created_at DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset) as any[];

    return {
      data: data.map((inv) => ({
        ...inv,
        articles: JSON.parse(inv.articles || "[]"),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get proforma paginated:", error);
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
      // Ajouter * pour matcher les préfixes (ex: "sav" → "savon")
      const ftsQuery = searchTerm
        .split(/\s+/)
        .map((t) => `${t}*`)
        .join(" ");
      const ftsStmt = db.prepare(`
        SELECT p.*, c.nom as categorie_nom
        FROM produits_fts pf
        JOIN produits p ON p.id = pf.rowid
        LEFT JOIN categories c ON p.categorie_id = c.id
        WHERE produits_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const results = ftsStmt.all(ftsQuery, limit);
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
function getFastCount(
  tableName: string,
  whereClause: string = "",
  params: any[] = [],
): number {
  if (!whereClause) {
    // COUNT simple : utiliser la table metadata (O(1))
    try {
      const key = `${tableName}_count`;
      const result = db
        .prepare("SELECT value FROM metadata WHERE key = ?")
        .get(key) as { value: number } | undefined;
      if (result) {
        return result.value;
      }
    } catch (error) {
      console.log("Metadata non disponible, fallback vers COUNT(*)");
    }
  }

  // COUNT avec filtres ou fallback : utiliser COUNT(*) classique
  const countStmt = db.prepare(
    `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
  );
  const { total } = countStmt.get(...params) as { total: number };
  return total;
}

export function getProductsPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
  categorieId?: number,
  status?: string,
  sortByStock?: boolean,
) {
  try {
    const offset = (page - 1) * limit;
    let conditions: string[] = [];
    let params: any[] = [];

    // Filtre par catégorie
    if (categorieId) {
      conditions.push("p.categorie_id = ?");
      params.push(categorieId);
    }

    // Filtre par statut (calculé depuis quantite_stock et stock_min)
    if (status === "epuise") {
      conditions.push("p.quantite_stock = 0 AND COALESCE(p.sans_stock, 0) = 0");
    } else if (status === "stock_faible") {
      conditions.push("p.quantite_stock > 0 AND p.quantite_stock <= p.stock_min AND COALESCE(p.sans_stock, 0) = 0");
    } else if (status === "en_stock") {
      conditions.push("p.quantite_stock > p.stock_min AND COALESCE(p.sans_stock, 0) = 0");
    } else if (status === "sans_stock") {
      conditions.push("COALESCE(p.sans_stock, 0) = 1");
    }

    // Optimisation FTS5 pour recherche rapide (uniquement si pas de filtre catégorie/statut)
    if (search && search.trim() && !categorieId && !status) {
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
          const idList = ids.join(",");

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
            totalPages: Math.ceil(data.length / limit),
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      conditions.push("(p.nom LIKE ? OR p.code_barre = ?)");
      params.push(searchTerm, searchQuery);
    } else if (search && search.trim()) {
      // Recherche LIKE combinée avec d'autres filtres
      const searchTerm = `%${search.trim()}%`;
      conditions.push("(p.nom LIKE ? OR p.code_barre = ?)");
      params.push(searchTerm, search.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
      ${sortByStock ? "ORDER BY p.quantite_stock ASC, p.nom ASC" : "ORDER BY p.created_at DESC, p.id DESC"}
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get products paginated:", error);
    throw error;
  }
}

export function getInvoicesPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
  try {
    const offset = (page - 1) * limit;

    if (search && search.trim()) {
      const searchQuery = search.trim();
      const searchTerm = `%${searchQuery}%`;
      const whereClause = "WHERE f.numero LIKE ? OR f.client_nom LIKE ?";
      const params = [searchTerm, searchTerm];

      const total = getFastCount("factures f", whereClause, params);

      const dataStmt = db.prepare(`
        SELECT f.*, v.montant_restant, v.statut_paiement, v.client_id, v.livraison_differee FROM factures f
        LEFT JOIN ventes v ON f.vente_id = v.id
        ${whereClause}
        ORDER BY f.created_at DESC, f.id DESC
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
        totalPages: Math.ceil(total / limit),
      };
    }

    const total = getFastCount("factures");

    const dataStmt = db.prepare(`
      SELECT f.*, v.montant_restant, v.statut_paiement, v.client_id, v.livraison_differee FROM factures f
      LEFT JOIN ventes v ON f.vente_id = v.id
      ORDER BY f.created_at DESC, f.id DESC
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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get invoices paginated:", error);
    throw error;
  }
}

export function getDistinctVendeurs(): string[] {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT utilisateur_nom FROM ventes
      WHERE utilisateur_nom IS NOT NULL AND utilisateur_nom != ''
      ORDER BY utilisateur_nom ASC
    `).all() as { utilisateur_nom: string }[];
    return rows.map(r => r.utilisateur_nom);
  } catch (error) {
    console.error("Erreur getDistinctVendeurs:", error);
    return [];
  }
}

export function getSalesPaginated(
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  vendeurFilter?: string,
  clientFilter?: string,
  creditFilter?: string,
) {
  try {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate && endDate) {
      conditions.push("DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)");
      params.push(startDate, endDate);
    }
    if (vendeurFilter) {
      conditions.push("v.utilisateur_nom LIKE ?");
      params.push(`%${vendeurFilter}%`);
    }
    if (clientFilter) {
      conditions.push("(v.client_nom LIKE ? OR c.nom LIKE ?)");
      params.push(`%${clientFilter}%`, `%${clientFilter}%`);
    }
    if (creditFilter === "credit") {
      conditions.push("v.statut_paiement IN ('partiel', 'impaye')");
    } else if (creditFilter === "comptant") {
      conditions.push("v.statut_paiement = 'paye'");
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    // Charger les ventes avec pagination
    const dataStmt = db.prepare(`
      SELECT v.*, c.nom as client_nom, c.telephone as client_telephone, c.email as client_email, s.nom as serveur_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN serveurs s ON v.serveur_id = s.id
      ${whereClause}
      ORDER BY v.date_vente DESC
      LIMIT ? OFFSET ?
    `);
    const sales = dataStmt.all(...params, limit, offset) as any[];

    // Optimisation: charger tous les produits et paiements en 2 requêtes au lieu de N*2
    const saleIds = sales.map((s) => s.id);
    if (saleIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const placeholders = saleIds.map(() => "?").join(",");
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
    allProducts.forEach((prod) => {
      if (!productsBySale[prod.vente_id]) {
        productsBySale[prod.vente_id] = [];
      }
      productsBySale[prod.vente_id].push(prod);
    });

    const paymentsBySale: Record<number, any[]> = {};
    allPayments.forEach((payment) => {
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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get sales paginated:", error);
    throw error;
  }
}

export function getClientsPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
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
          const idList = ids.join(",");

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
            totalPages: Math.ceil(data.length / limit),
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause =
        "WHERE nom LIKE ? OR telephone LIKE ? OR email LIKE ?";
      const params = [searchTerm, searchTerm, searchTerm];

      const countStmt = db.prepare(
        `SELECT COUNT(*) as total FROM clients ${whereClause}`,
      );
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
        totalPages: Math.ceil(total / limit),
      };
    }

    const countStmt = db.prepare("SELECT COUNT(*) as total FROM clients");
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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get clients paginated:", error);
    throw error;
  }
}

export function getUsersPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
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
          const idList = ids.join(",");

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
            totalPages: Math.ceil(data.length / limit),
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause = "WHERE nom LIKE ? OR email LIKE ? OR role LIKE ?";
      const params = [searchTerm, searchTerm, searchTerm];

      const total = getFastCount("utilisateurs", whereClause, params);

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
        totalPages: Math.ceil(total / limit),
      };
    }

    const total = getFastCount("utilisateurs");

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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get users paginated:", error);
    throw error;
  }
}

export function getAuditLogsPaginated(
  page: number = 1,
  limit: number = 20,
  filters?: {
    startDate?: string;
    endDate?: string;
    table?: string;
    search?: string;
  },
) {
  try {
    const offset = (page - 1) * limit;
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters?.startDate && filters?.endDate) {
      whereClauses.push("DATE(al.created_at) BETWEEN DATE(?) AND DATE(?)");
      params.push(filters.startDate, filters.endDate);
    }

    if (filters?.table) {
      whereClauses.push("al.table_cible = ?");
      params.push(filters.table);
    }

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      whereClauses.push(
        "(al.utilisateur_nom LIKE ? OR al.action LIKE ? OR al.table_cible LIKE ?)",
      );
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const total = getFastCount("audit_logs al", whereClause, params);

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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get audit logs paginated:", error);
    throw error;
  }
}

export function getSuppliersPaginated(
  page: number = 1,
  limit: number = 10,
  search?: string,
) {
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
          const idList = ids.join(",");

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
            totalPages: Math.ceil(data.length / limit),
          };
        }
      } catch (ftsError) {
        console.log("FTS5 non disponible, utilisation de LIKE");
      }

      const searchTerm = `%${searchQuery}%`;
      const whereClause =
        "WHERE nom LIKE ? OR telephone LIKE ? OR email LIKE ?";
      const params = [searchTerm, searchTerm, searchTerm];

      const total = getFastCount("fournisseurs", whereClause, params);

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
        totalPages: Math.ceil(total / limit),
      };
    }

    const total = getFastCount("fournisseurs");

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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get suppliers paginated:", error);
    throw error;
  }
}

export function getPurchasesPaginated(page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit;

    const total = getFastCount("achats");

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
    const purchaseIds = purchases.map((p) => p.id);
    if (purchaseIds.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const placeholders = purchaseIds.map(() => "?").join(",");
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
    allProducts.forEach((prod) => {
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
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Erreur get purchases paginated:", error);
    throw error;
  }
}

export function getServersPaginated(page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit;

    const total = getFastCount("serveurs");

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
      totalPages: Math.ceil(total / limit),
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

export function purgeOldData(config: Partial<PurgeConfig> = {}): {
  success: boolean;
  message: string;
  stats: any;
} {
  const purgeConfig = { ...defaultPurgeConfig, ...config };

  if (!purgeConfig.enabled) {
    return { success: true, message: "Purge désactivée", stats: {} };
  }

  try {
    const stats: any = {};

    // Purger les vieux audit_logs (> X jours)
    const auditLogsCutoff = new Date();
    auditLogsCutoff.setDate(
      auditLogsCutoff.getDate() - purgeConfig.auditLogsRetentionDays,
    );

    const deletedAuditLogs = db
      .prepare(
        `
      DELETE FROM audit_logs
      WHERE created_at < ?
    `,
      )
      .run(auditLogsCutoff.toISOString()).changes;

    stats.deletedAuditLogs = deletedAuditLogs;

    // Purger les ventes archivées (statut = 'archivée' AND > X jours)
    const deletedArchivedSales = db
      .prepare(
        `
      DELETE FROM ventes
      WHERE date_vente < ?
      AND id IN (SELECT vente_id FROM factures WHERE date_facture < ?)
    `,
      )
      .run(
        auditLogsCutoff.toISOString(),
        auditLogsCutoff.toISOString(),
      ).changes;

    stats.deletedArchivedSales = deletedArchivedSales;

    // Mettre à jour les compteurs dans metadata
    const updateMetadataCount = (key: string, deleted: number) => {
      if (deleted > 0) {
        db.prepare("UPDATE metadata SET value = value - ? WHERE key = ?").run(
          deleted,
          key,
        );
      }
    };

    updateMetadataCount("audit_logs_count", deletedAuditLogs);
    updateMetadataCount("ventes_count", deletedArchivedSales);

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
// SUPPRESSION DE TOUTES LES DONNÉES (RESET)
// ============================================

export function clearAllData(
  options: {
    produits?: boolean;
    ventes?: boolean;
    factures?: boolean;
    proforma?: boolean;
  } = {},
  utilisateur_id?: number,
  utilisateur_nom?: string,
): { success: boolean; message: string; stats: any } {
  const defaultOptions = {
    produits: true,
    ventes: true,
    factures: true,
    proforma: true,
  };

  const opts = { ...defaultOptions, ...options };

  try {
    const stats: any = {};

    db.transaction(() => {
      // Supprimer les factures proforma
      if (opts.proforma) {
        const deletedProforma = db
          .prepare("DELETE FROM factures_proforma")
          .run().changes;
        stats.deletedProforma = deletedProforma;
        console.log(`✓ ${deletedProforma} factures proforma supprimées`);
      }

      // Supprimer les factures (doit être avant ventes à cause de la FK)
      if (opts.factures) {
        const deletedFactures = db
          .prepare("DELETE FROM factures")
          .run().changes;
        stats.deletedFactures = deletedFactures;
        console.log(`✓ ${deletedFactures} factures supprimées`);
      }

      // Supprimer les ventes (CASCADE supprimera ventes_produits et paiements_clients)
      if (opts.ventes) {
        // D'abord supprimer ventes_produits et paiements_clients manuellement pour être sûr
        db.prepare("DELETE FROM ventes_produits").run();
        db.prepare("DELETE FROM paiements_clients").run();
        const deletedVentes = db.prepare("DELETE FROM ventes").run().changes;
        stats.deletedVentes = deletedVentes;
        console.log(`✓ ${deletedVentes} ventes supprimées`);
      }

      // Supprimer les produits
      if (opts.produits) {
        const deletedProduits = db
          .prepare("DELETE FROM produits")
          .run().changes;
        stats.deletedProduits = deletedProduits;
        console.log(`✓ ${deletedProduits} produits supprimés`);

        // Vider aussi la table FTS des produits
        try {
          db.prepare("DELETE FROM produits_fts").run();
        } catch (e) {
          // Table FTS peut ne pas exister
        }
      }

      // Mettre à jour les compteurs dans metadata
      if (opts.produits) {
        db.prepare(
          "UPDATE metadata SET value = 0 WHERE key = 'produits_count'",
        ).run();
      }
      if (opts.ventes) {
        db.prepare(
          "UPDATE metadata SET value = 0 WHERE key = 'ventes_count'",
        ).run();
      }
      if (opts.factures) {
        db.prepare(
          "UPDATE metadata SET value = 0 WHERE key = 'factures_count'",
        ).run();
      }

      // Log dans l'audit
      const details = [];
      if (opts.produits) details.push(`produits: ${stats.deletedProduits}`);
      if (opts.ventes) details.push(`ventes: ${stats.deletedVentes}`);
      if (opts.factures) details.push(`factures: ${stats.deletedFactures}`);
      if (opts.proforma) details.push(`proforma: ${stats.deletedProforma}`);

      logAudit(
        "suppression massive",
        "système",
        undefined,
        `Données supprimées: ${details.join(", ")}`,
        utilisateur_id,
        utilisateur_nom,
      );
    })();

    return {
      success: true,
      message: "Toutes les données sélectionnées ont été supprimées",
      stats,
    };
  } catch (error) {
    console.error("Erreur clearAllData:", error);
    return {
      success: false,
      message: `Erreur lors de la suppression: ${(error as Error).message}`,
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
    const result = db
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get(key) as { value: number } | undefined;
    if (result) {
      return result.value;
    }
  } catch (error) {
    // Ignorer
  }

  // Sinon, utiliser sqlite_stat1 pour estimation (si ANALYZE a été exécuté)
  try {
    const stat = db
      .prepare(
        `
      SELECT stat FROM sqlite_stat1
      WHERE tbl = ? AND idx IS NULL
    `,
      )
      .get(tableName) as { stat: string } | undefined;

    if (stat) {
      const count = parseInt(stat.stat.split(" ")[0]);
      if (!isNaN(count)) return count;
    }
  } catch (error) {
    // Ignorer
  }

  // Fallback: COUNT(*) classique
  const { total } = db
    .prepare(`SELECT COUNT(*) as total FROM ${tableName}`)
    .get() as { total: number };
  return total;
}

// Products avec Keyset Pagination
export function getProductsKeyset(
  limit: number = 10,
  cursor?: KeysetCursor,
  direction: "next" | "prev" = "next",
  search?: string,
): KeysetPaginationResult<any> {
  try {
    let whereClause = "";
    let params: any[] = [];
    let orderDirection = direction === "next" ? "DESC" : "ASC";

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
          whereClause = `WHERE p.id IN (${ftsIds.join(",")})`;
        } else {
          const searchTerm = `%${searchQuery}%`;
          whereClause = "WHERE (p.nom LIKE ? OR p.code_barre = ?)";
          params = [searchTerm, searchQuery];
        }
      } catch (ftsError) {
        const searchTerm = `%${search.trim()}%`;
        whereClause = "WHERE (p.nom LIKE ? OR p.code_barre = ?)";
        params = [searchTerm, search.trim()];
      }
    }

    // Ajouter condition de cursor pour keyset
    if (cursor?.created_at && cursor?.id) {
      const cursorCondition =
        direction === "next"
          ? "(p.created_at < ? OR (p.created_at = ? AND p.id < ?))"
          : "(p.created_at > ? OR (p.created_at = ? AND p.id > ?))";

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
    if (direction === "prev") {
      data.reverse();
    }

    // Calculer les cursors
    const nextCursor =
      data.length > 0
        ? {
            created_at: data[data.length - 1].created_at,
            id: data[data.length - 1].id,
          }
        : null;

    const prevCursor =
      data.length > 0
        ? {
            created_at: data[0].created_at,
            id: data[0].id,
          }
        : null;

    // Total estimé
    const total = search ? data.length : getEstimatedCount("produits");

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit,
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
  direction: "next" | "prev" = "next",
  startDate?: string,
  endDate?: string,
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === "next" ? "DESC" : "ASC";

    // Filtre par date
    if (startDate && endDate) {
      whereClauses.push("DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)");
      params.push(startDate, endDate);
    }

    // Condition de cursor
    if (cursor?.date_vente && cursor?.id) {
      const cursorCondition =
        direction === "next"
          ? "(v.date_vente < ? OR (v.date_vente = ? AND v.id < ?))"
          : "(v.date_vente > ? OR (v.date_vente = ? AND v.id > ?))";
      whereClauses.push(cursorCondition);
      params.push(cursor.date_vente, cursor.date_vente, cursor.id);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

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

    if (direction === "prev") {
      sales.reverse();
    }

    // Batch loading des produits et paiements
    if (sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const placeholders = saleIds.map(() => "?").join(",");

      const allProducts = db
        .prepare(
          `
        SELECT vp.*, p.nom as nom_produit
        FROM ventes_produits vp
        JOIN produits p ON vp.produit_id = p.id
        WHERE vp.vente_id IN (${placeholders})
      `,
        )
        .all(...saleIds) as any[];

      const allPayments = db
        .prepare(
          `
        SELECT * FROM paiements_clients
        WHERE vente_id IN (${placeholders})
      `,
        )
        .all(...saleIds) as any[];

      const productsBySale: Record<number, any[]> = {};
      allProducts.forEach((prod) => {
        if (!productsBySale[prod.vente_id]) productsBySale[prod.vente_id] = [];
        productsBySale[prod.vente_id].push(prod);
      });

      const paymentsBySale: Record<number, any[]> = {};
      allPayments.forEach((payment) => {
        if (!paymentsBySale[payment.vente_id])
          paymentsBySale[payment.vente_id] = [];
        paymentsBySale[payment.vente_id].push(payment);
      });

      sales = sales.map((sale) => ({
        ...sale,
        produits: productsBySale[sale.id] || [],
        paiements: paymentsBySale[sale.id] || [],
      }));
    }

    const nextCursor =
      sales.length > 0
        ? {
            date_vente: sales[sales.length - 1].date_vente,
            id: sales[sales.length - 1].id,
          }
        : null;

    const prevCursor =
      sales.length > 0
        ? {
            date_vente: sales[0].date_vente,
            id: sales[0].id,
          }
        : null;

    const total = getEstimatedCount("ventes");

    return {
      data: sales,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit,
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
  direction: "next" | "prev" = "next",
  filters?: {
    startDate?: string;
    endDate?: string;
    table?: string;
    search?: string;
  },
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === "next" ? "DESC" : "ASC";

    if (filters?.startDate && filters?.endDate) {
      whereClauses.push("DATE(al.created_at) BETWEEN DATE(?) AND DATE(?)");
      params.push(filters.startDate, filters.endDate);
    }

    if (filters?.table) {
      whereClauses.push("al.table_cible = ?");
      params.push(filters.table);
    }

    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      whereClauses.push(
        "(al.utilisateur_nom LIKE ? OR al.action LIKE ? OR al.table_cible LIKE ?)",
      );
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Condition de cursor
    if (cursor?.created_at && cursor?.id) {
      const cursorCondition =
        direction === "next"
          ? "(al.created_at < ? OR (al.created_at = ? AND al.id < ?))"
          : "(al.created_at > ? OR (al.created_at = ? AND al.id > ?))";
      whereClauses.push(cursorCondition);
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

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

    if (direction === "prev") {
      data.reverse();
    }

    const nextCursor =
      data.length > 0
        ? {
            created_at: data[data.length - 1].created_at,
            id: data[data.length - 1].id,
          }
        : null;

    const prevCursor =
      data.length > 0
        ? {
            created_at: data[0].created_at,
            id: data[0].id,
          }
        : null;

    const total = getEstimatedCount("audit_logs");

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit,
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
  direction: "next" | "prev" = "next",
  search?: string,
): KeysetPaginationResult<any> {
  try {
    let whereClauses: string[] = [];
    let params: any[] = [];
    let orderDirection = direction === "next" ? "DESC" : "ASC";

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClauses.push("(f.numero LIKE ? OR f.client_nom LIKE ?)");
      params.push(searchTerm, searchTerm);
    }

    if (cursor?.date_facture && cursor?.id) {
      const cursorCondition =
        direction === "next"
          ? "(f.date_facture < ? OR (f.date_facture = ? AND f.id < ?))"
          : "(f.date_facture > ? OR (f.date_facture = ? AND f.id > ?))";
      whereClauses.push(cursorCondition);
      params.push(cursor.date_facture, cursor.date_facture, cursor.id);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

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

    if (direction === "prev") {
      data.reverse();
    }

    // Parser les articles JSON
    data = data.map((invoice: any) => ({
      ...invoice,
      articles: JSON.parse(invoice.articles),
    }));

    const nextCursor =
      data.length > 0
        ? {
            date_facture: data[data.length - 1].date_facture,
            id: data[data.length - 1].id,
          }
        : null;

    const prevCursor =
      data.length > 0
        ? {
            date_facture: data[0].date_facture,
            id: data[0].id,
          }
        : null;

    const total = search ? data.length : getEstimatedCount("factures");

    return {
      data,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit,
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
  direction: "next" | "prev" = "next",
): KeysetPaginationResult<any> {
  try {
    let whereClause = "";
    let params: any[] = [];
    let orderDirection = direction === "next" ? "DESC" : "ASC";

    if (cursor?.date_achat && cursor?.id) {
      const cursorCondition =
        direction === "next"
          ? "(a.date_achat < ? OR (a.date_achat = ? AND a.id < ?))"
          : "(a.date_achat > ? OR (a.date_achat = ? AND a.id > ?))";
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

    if (direction === "prev") {
      purchases.reverse();
    }

    // Batch loading des produits et paiements
    if (purchases.length > 0) {
      const purchaseIds = purchases.map((p) => p.id);
      const placeholders = purchaseIds.map(() => "?").join(",");

      const allProducts = db
        .prepare(
          `
        SELECT ap.*, p.nom as nom_produit
        FROM achats_produits ap
        JOIN produits p ON ap.produit_id = p.id
        WHERE ap.achat_id IN (${placeholders})
      `,
        )
        .all(...purchaseIds) as any[];

      const allPayments = db
        .prepare(
          `
        SELECT * FROM paiements_fournisseurs
        WHERE achat_id IN (${placeholders})
      `,
        )
        .all(...purchaseIds) as any[];

      const productsByPurchase: Record<number, any[]> = {};
      allProducts.forEach((prod) => {
        if (!productsByPurchase[prod.achat_id])
          productsByPurchase[prod.achat_id] = [];
        productsByPurchase[prod.achat_id].push(prod);
      });

      const paymentsByPurchase: Record<number, any[]> = {};
      allPayments.forEach((payment) => {
        if (!paymentsByPurchase[payment.achat_id])
          paymentsByPurchase[payment.achat_id] = [];
        paymentsByPurchase[payment.achat_id].push(payment);
      });

      purchases = purchases.map((purchase) => ({
        ...purchase,
        produits: productsByPurchase[purchase.id] || [],
        paiements: paymentsByPurchase[purchase.id] || [],
      }));
    }

    const nextCursor =
      purchases.length > 0
        ? {
            date_achat: purchases[purchases.length - 1].date_achat,
            id: purchases[purchases.length - 1].id,
          }
        : null;

    const prevCursor =
      purchases.length > 0
        ? {
            date_achat: purchases[0].date_achat,
            id: purchases[0].id,
          }
        : null;

    const total = getEstimatedCount("achats");

    return {
      data: purchases,
      total,
      hasMore,
      nextCursor,
      prevCursor,
      limit,
    };
  } catch (error) {
    console.error("Erreur getPurchasesKeyset:", error);
    throw error;
  }
}

// Fonction hybride: utilise keyset si > KEYSET_THRESHOLD, sinon OFFSET classique
export function getProductsPaginatedOptimized(
  page: number = 1,
  limit: number = 10,
  search?: string,
  cursor?: KeysetCursor,
) {
  const total = search ? 0 : getEstimatedCount("produits");

  // Si keyset cursor fourni ou si très grande table sans recherche, utiliser keyset
  if (cursor || (total > KEYSET_THRESHOLD && !search)) {
    const result = getProductsKeyset(limit, cursor, "next", search);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true,
    };
  }

  // Sinon utiliser la pagination OFFSET classique
  return { ...getProductsPaginated(page, limit, search), useKeyset: false };
}

export function getSalesPaginatedOptimized(
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  cursor?: KeysetCursor,
) {
  const total = getEstimatedCount("ventes");

  if (cursor || total > KEYSET_THRESHOLD) {
    const result = getSalesKeyset(limit, cursor, "next", startDate, endDate);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true,
    };
  }

  return {
    ...getSalesPaginated(page, limit, startDate, endDate),
    useKeyset: false,
  };
}

export function getAuditLogsPaginatedOptimized(
  page: number = 1,
  limit: number = 20,
  filters?: {
    startDate?: string;
    endDate?: string;
    table?: string;
    search?: string;
  },
  cursor?: KeysetCursor,
) {
  const total = getEstimatedCount("audit_logs");

  if (cursor || total > KEYSET_THRESHOLD) {
    const result = getAuditLogsKeyset(limit, cursor, "next", filters);
    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      useKeyset: true,
    };
  }

  return { ...getAuditLogsPaginated(page, limit, filters), useKeyset: false };
}

// Obtenir les informations de version du schéma de la base de données
export function getSchemaInfo(): {
  currentVersion: number;
  targetVersion: number;
  appliedMigrations: Array<{
    version: number;
    description: string;
    applied_at: string;
  }>;
  pendingMigrations: number;
} {
  try {
    createSchemaVersionTable();

    const currentVersion = getCurrentSchemaVersion();
    const appliedMigrations = db
      .prepare(
        "SELECT version, description, applied_at FROM schema_versions ORDER BY version ASC",
      )
      .all() as Array<{
      version: number;
      description: string;
      applied_at: string;
    }>;

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

    const tables = db
      .prepare(
        `
      SELECT name as tableName, sql
      FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'
    `,
      )
      .all();

    const tablesWithCounts = tables.map((table: any) => {
      const { count } = db
        .prepare(`SELECT COUNT(*) as count FROM ${table.tableName}`)
        .get() as { count: number };
      return {
        name: table.tableName,
        count,
      };
    });

    const oldestAudit = db
      .prepare(
        `
      SELECT created_at FROM audit_logs
      ORDER BY created_at ASC
      LIMIT 1
    `,
      )
      .get() as { created_at: string } | undefined;

    const oldestSale = db
      .prepare(
        `
      SELECT date_vente FROM ventes
      ORDER BY date_vente ASC
      LIMIT 1
    `,
      )
      .get() as { date_vente: string } | undefined;

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

// ===== INVENTAIRE =====

export function getInventoryData(
  page: number = 1,
  limit: number = 10,
  startDate?: string,
  endDate?: string,
  search?: string,
  categorieId?: number,
) {
  try {
    const offset = (page - 1) * limit;
    const countParams: any[] = [];

    // Build date conditions for subqueries
    let achatsDateCondition = "";
    let ventesDateCondition = "";
    if (startDate && endDate) {
      achatsDateCondition = " AND a.date_achat BETWEEN ? AND ?";
      ventesDateCondition = " AND v.date_vente BETWEEN ? AND ?";
    }

    // Build WHERE clause for main query
    let whereConditions: string[] = [];
    if (search && search.trim()) {
      whereConditions.push("(p.nom LIKE ? OR p.code_barre LIKE ?)");
      const searchParam = `%${search.trim()}%`;
      countParams.push(searchParam, searchParam);
    }
    if (categorieId) {
      whereConditions.push("p.categorie_id = ?");
      countParams.push(categorieId);
    }
    const whereClause =
      whereConditions.length > 0
        ? "WHERE " + whereConditions.join(" AND ")
        : "";

    // Count query
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total FROM produits p
      ${whereClause}
    `);
    const { total } = countStmt.get(...countParams) as { total: number };

    // Build main query params
    // Entrees subquery
    const entreesSubquery = `
      SELECT COALESCE(SUM(ap.quantite), 0)
      FROM achats_produits ap
      INNER JOIN achats a ON ap.achat_id = a.id
      WHERE ap.produit_id = p.id${achatsDateCondition}
    `;

    // Sorties subquery
    const sortiesSubquery = `
      SELECT COALESCE(SUM(vp.quantite), 0)
      FROM ventes_produits vp
      INNER JOIN ventes v ON vp.vente_id = v.id
      WHERE vp.produit_id = p.id${ventesDateCondition}
    `;

    const mainQuery = `
      SELECT
        p.id, p.nom, p.code_barre, p.quantite_stock, p.stock_min,
        p.prix_achat, p.prix_vente,
        c.nom as categorie_nom,
        (${entreesSubquery}) as total_entrees,
        (${sortiesSubquery}) as total_sorties
      FROM produits p
      LEFT JOIN categories c ON p.categorie_id = c.id
      ${whereClause}
      ORDER BY p.nom
      LIMIT ? OFFSET ?
    `;

    // Build params for main query
    const mainParams: any[] = [];
    // Params for entrees subquery dates
    if (startDate && endDate) {
      mainParams.push(startDate, endDate);
    }
    // Params for sorties subquery dates
    if (startDate && endDate) {
      mainParams.push(startDate, endDate);
    }
    // Params for WHERE clause
    if (search && search.trim()) {
      const searchParam = `%${search.trim()}%`;
      mainParams.push(searchParam, searchParam);
    }
    if (categorieId) {
      mainParams.push(categorieId);
    }
    // Pagination
    mainParams.push(limit, offset);

    const dataStmt = db.prepare(mainQuery);
    const data = dataStmt.all(...mainParams);

    // Stats globales (sur tous les produits filtrés, pas seulement la page)
    // Les produits sans_stock sont exclus des agrégats de valeur et alertes
    const statsQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN COALESCE(p.sans_stock,0)=0 THEN p.quantite_stock * p.prix_achat ELSE 0 END), 0) as valeur_stock_achat,
        COALESCE(SUM(CASE WHEN COALESCE(p.sans_stock,0)=0 THEN p.quantite_stock * p.prix_vente ELSE 0 END), 0) as valeur_stock_vente,
        COALESCE(SUM(CASE WHEN COALESCE(p.sans_stock,0)=0 AND p.quantite_stock=0 THEN 1 ELSE 0 END), 0) as produits_rupture,
        COALESCE(SUM(CASE WHEN COALESCE(p.sans_stock,0)=0 AND p.quantite_stock>0 AND p.quantite_stock<=p.stock_min THEN 1 ELSE 0 END), 0) as produits_stock_bas
      FROM produits p
      ${whereClause}
    `;
    const statsStmt = db.prepare(statsQuery);
    const stats = statsStmt.get(...countParams) as {
      valeur_stock_achat: number;
      valeur_stock_vente: number;
      produits_rupture: number;
      produits_stock_bas: number;
    };

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    };
  } catch (error) {
    console.error("Erreur get inventory data:", error);
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      stats: {
        valeur_stock_achat: 0,
        valeur_stock_vente: 0,
        produits_rupture: 0,
        produits_stock_bas: 0,
      },
    };
  }
}

// ============================================
// IMPORT CSV PRODUITS
// ============================================

export function importProductsFromCSV(csvContent: string): {
  success: boolean;
  message: string;
  stats: {
    categoriesCreated: number;
    productsCreated: number;
    productsUpdated: number;
    productsSkipped: number;
  };
} {
  try {
    const lines = csvContent.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return {
        success: false,
        message: "Le fichier CSV est vide ou invalide",
        stats: {
          categoriesCreated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
        },
      };
    }

    // Parser les produits (ignorer l'en-tête)
    const products: Array<{
      categorie: string;
      description: string | null;
      nom: string;
      code_barre: string | null;
      stock_min: number;
      prix_achat: number;
      prix_vente: number;
      quantite_stock: number;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      if (values.length >= 8 && values[0].trim() !== "categorie") {
        products.push({
          categorie: values[0].trim(),
          description: values[1].trim() || null,
          nom: values[2].trim(),
          code_barre: values[3].trim() || null,
          stock_min: parseInt(values[4]) || 5,
          prix_achat: parseFloat(values[5]) || 0,
          prix_vente: parseFloat(values[6]) || 0,
          quantite_stock: parseInt(values[7]) || 0,
        });
      }
    }

    if (products.length === 0) {
      return {
        success: false,
        message: "Aucun produit valide trouvé dans le CSV",
        stats: {
          categoriesCreated: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
        },
      };
    }

    // Extraire les catégories uniques
    const categories = Array.from(
      new Set(products.map((p) => p.categorie)),
    ).filter((c) => c);

    let categoriesCreated = 0;
    let productsCreated = 0;
    let productsUpdated = 0;
    let productsSkipped = 0;

    // Transaction pour l'import
    db.transaction(() => {
      // 1. Créer les catégories
      const insertCategory = db.prepare(
        "INSERT OR IGNORE INTO categories (nom, description) VALUES (?, ?)",
      );

      const categoryMap: Record<string, number> = {};

      for (const cat of categories) {
        const result = insertCategory.run(cat, null);
        if (result.changes > 0) {
          categoriesCreated++;
        }

        // Récupérer l'ID de la catégorie
        const row = db
          .prepare("SELECT id FROM categories WHERE nom = ?")
          .get(cat) as { id: number } | undefined;
        if (row) {
          categoryMap[cat] = row.id;
        }
      }

      // 2. Créer ou mettre à jour les produits
      const insertProduct = db.prepare(`
        INSERT OR IGNORE INTO produits (nom, description, code_barre, prix_achat, prix_vente, quantite_stock, stock_min, categorie_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateProductByBarcode = db.prepare(`
        UPDATE produits SET nom = ?, description = ?, prix_achat = ?, prix_vente = ?, quantite_stock = ?, stock_min = ?, categorie_id = ?
        WHERE code_barre = ?
      `);

      const findByBarcode = db.prepare(
        "SELECT id FROM produits WHERE code_barre = ?",
      );

      for (const product of products) {
        if (!product.nom) {
          productsSkipped++;
          continue;
        }

        const categorieId = categoryMap[product.categorie] || null;

        try {
          // Si le produit a un code_barre, vérifier s'il existe déjà
          if (product.code_barre) {
            const existing = findByBarcode.get(product.code_barre) as
              | { id: number }
              | undefined;
            if (existing) {
              updateProductByBarcode.run(
                product.nom,
                product.description,
                product.prix_achat,
                product.prix_vente,
                product.quantite_stock,
                product.stock_min,
                categorieId,
                product.code_barre,
              );
              productsUpdated++;
              continue;
            }
          }

          insertProduct.run(
            product.nom,
            product.description,
            product.code_barre,
            product.prix_achat,
            product.prix_vente,
            product.quantite_stock,
            product.stock_min,
            categorieId,
          );
          productsCreated++;
        } catch (e) {
          console.error(`Erreur produit "${product.nom}":`, e);
          productsSkipped++;
        }
      }

      // 3. Mettre à jour les compteurs dans metadata
      const productCount = (
        db.prepare("SELECT COUNT(*) as count FROM produits").get() as {
          count: number;
        }
      ).count;
      db.prepare("UPDATE metadata SET value = ? WHERE key = ?").run(
        productCount,
        "produits_count",
      );
    })();

    console.log(
      `✅ Import terminé: ${categoriesCreated} catégories, ${productsCreated} produits créés, ${productsUpdated} mis à jour, ${productsSkipped} ignorés`,
    );

    return {
      success: true,
      message: `Import réussi: ${categoriesCreated} catégories, ${productsCreated} produits créés, ${productsUpdated} mis à jour`,
      stats: {
        categoriesCreated,
        productsCreated,
        productsUpdated,
        productsSkipped,
      },
    };
  } catch (error) {
    console.error("Erreur import CSV:", error);
    return {
      success: false,
      message: `Erreur lors de l'import: ${(error as Error).message}`,
      stats: {
        categoriesCreated: 0,
        productsCreated: 0,
        productsUpdated: 0,
        productsSkipped: 0,
      },
    };
  }
}

// ===== FONCTIONS CAISSE (OUVERTURE/FERMETURE) =====

export function getOpenCaisse(): any {
  try {
    const stmt = db.prepare(`
      SELECT * FROM caisses 
      WHERE statut = 'ouverte' 
      ORDER BY date_ouverture DESC 
      LIMIT 1
    `);
    return stmt.get();
  } catch (error) {
    console.error("Erreur getOpenCaisse:", error);
    return null;
  }
}

export function openCaisse(caisse: any): any {
  try {
    return db.transaction(() => {
      const openCaisse = getOpenCaisse();
      if (openCaisse) {
        throw new Error("Une caisse est déjà ouverte. Veuillez la fermer d'abord.");
      }

      const stmt = db.prepare(`
        INSERT INTO caisses (date_ouverture, heure_ouverture, fonds_roulement, vendeur_id, vendeur_nom, statut)
        VALUES (DATE('now'), TIME('now'), ?, ?, ?, 'ouverte')
      `);
      const result = stmt.run(
        caisse.fonds_roulement || 0,
        caisse.vendeur_id || null,
        caisse.vendeur_nom || null
      );

      // Enregistrer le fonds de roulement dans la comptabilité
      if ((caisse.fonds_roulement || 0) > 0) {
        db.prepare(`
          INSERT INTO comptabilite (type, reference_id, description, montant, type_mouvement, methode_paiement)
          VALUES ('autre', ?, ?, ?, 'entree', 'especes')
        `).run(
          Number(result.lastInsertRowid),
          `Fonds de roulement - Ouverture caisse`,
          caisse.fonds_roulement
        );
      }

      logAudit(
        "ouvrir caisse",
        "caisses",
        Number(result.lastInsertRowid),
        `Caisse ouverte - Fonds de roulement: ${caisse.fonds_roulement || 0}`,
        caisse.vendeur_id,
        caisse.vendeur_nom
      );

      return { id: result.lastInsertRowid, ...caisse, statut: 'ouverte' };
    })();
  } catch (error) {
    console.error("Erreur openCaisse:", error);
    throw error;
  }
}

export function closeCaisse(caisseId: number, data: any): any {
  try {
    return db.transaction(() => {
      const caisse = db.prepare("SELECT * FROM caisses WHERE id = ?").get(caisseId) as any;
      if (!caisse) {
        throw new Error("Caisse non trouvée");
      }

      const stmt = db.prepare(`
        UPDATE caisses 
        SET date_fermeture = DATE('now'),
            heure_fermeture = TIME('now'),
            total_ventes = ?,
            total_especes = ?,
            total_carte = ?,
            total_mobile = ?,
            statut = 'fermee',
            notes = ?
        WHERE id = ?
      `);
      stmt.run(
        data.total_ventes || 0,
        data.total_especes || 0,
        data.total_carte || 0,
        data.total_mobile || 0,
        data.notes || null,
        caisseId
      );

      // Lock all invoices from this day
      db.prepare(`
        UPDATE factures 
        SET locked = 1 
        WHERE DATE(created_at) = DATE(?) AND locked = 0
      `).run(caisse.date_ouverture);

      db.prepare(`
        UPDATE ventes 
        SET locked = 1 
        WHERE DATE(date_vente) = DATE(?) AND locked = 0
      `).run(caisse.date_ouverture);

      logAudit(
        "fermer caisse",
        "caisses",
        caisseId,
        `Caisse fermée - Total ventes: ${data.total_ventes || 0}`,
        data.vendeur_id,
        data.vendeur_nom
      );

      return { id: caisseId, statut: 'fermee' };
    })();
  } catch (error) {
    console.error("Erreur closeCaisse:", error);
    throw error;
  }
}

export function lockOldInvoices(): void {
  try {
    db.prepare(`
      UPDATE factures SET locked = 1
      WHERE locked = 0 AND datetime(created_at) < datetime('now', '-24 hours')
    `).run();
    db.prepare(`
      UPDATE ventes SET locked = 1
      WHERE locked = 0 AND datetime(date_vente) < datetime('now', '-24 hours')
    `).run();
  } catch (error) {
    console.error("Erreur lockOldInvoices:", error);
  }
}

export function getCaisses(page: number = 1, limit: number = 20): any {
  try {
    const offset = (page - 1) * limit;
    const countStmt = db.prepare("SELECT COUNT(*) as total FROM caisses");
    const { total } = countStmt.get() as { total: number };

    const dataStmt = db.prepare(`
      SELECT * FROM caisses 
      ORDER BY date_ouverture DESC, id DESC 
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(limit, offset);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    console.error("Erreur getCaisses:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

export function getCaisseStats(caisseId: number): any {
  try {
    const caisse = db.prepare("SELECT * FROM caisses WHERE id = ?").get(caisseId) as any;
    if (!caisse) return null;

    const openingDatetime = `${caisse.date_ouverture} ${caisse.heure_ouverture}`;
    const closingDatetime = caisse.date_fermeture && caisse.heure_fermeture
      ? `${caisse.date_fermeture} ${caisse.heure_fermeture}`
      : null;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as nb_ventes,
        COALESCE(SUM(total), 0) as total_ventes,
        COALESCE(SUM(montant_paye), 0) as total_encaisse,
        COALESCE(SUM(CASE WHEN methode_paiement = 'especes' THEN montant_paye ELSE 0 END), 0) as total_especes,
        COALESCE(SUM(CASE WHEN methode_paiement = 'carte' THEN montant_paye ELSE 0 END), 0) as total_carte,
        COALESCE(SUM(CASE WHEN methode_paiement = 'mobile' THEN montant_paye ELSE 0 END), 0) as total_mobile
      FROM ventes
      WHERE date_vente >= ?
        AND (? IS NULL OR date_vente <= ?)
    `).get(openingDatetime, closingDatetime, closingDatetime) as any;

    return { ...caisse, ...stats };
  } catch (error) {
    console.error("Erreur getCaisseStats:", error);
    return null;
  }
}

// ===== FONCTIONS LIVRAISONS =====

export function getLivraisons(page: number = 1, limit: number = 20, statut?: string): any {
  try {
    const offset = (page - 1) * limit;
    let whereClause = "";
    let params: any[] = [];

    if (statut) {
      whereClause = "WHERE l.statut = ?";
      params.push(statut);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM livraisons l ${whereClause}`);
    const { total } = countStmt.get(...params) as { total: number };

    const dataStmt = db.prepare(`
      SELECT l.*, c.nom as client_nom_full, v.total as vente_total
      FROM livraisons l
      LEFT JOIN clients c ON l.client_id = c.id
      LEFT JOIN ventes v ON l.vente_id = v.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    console.error("Erreur getLivraisons:", error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

export function createLivraison(livraison: any): any {
  try {
    return db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO livraisons (vente_id, client_id, client_nom, adresse_livraison, date_prevue, statut, notes, livreur)
        VALUES (?, ?, ?, ?, ?, 'en_attente', ?, ?)
      `);
      const result = stmt.run(
        livraison.vente_id,
        livraison.client_id || null,
        livraison.client_nom || null,
        livraison.adresse_livraison || null,
        livraison.date_prevue || null,
        livraison.notes || null,
        livraison.livreur || null
      );

      // Mark sale as not delivered
      db.prepare("UPDATE ventes SET delivered = 0 WHERE id = ?").run(livraison.vente_id);

      logAudit(
        "créer livraison",
        "livraisons",
        Number(result.lastInsertRowid),
        `Livraison créée pour vente #${livraison.vente_id}`,
        livraison.utilisateur_id,
        livraison.utilisateur_nom
      );

      return { id: result.lastInsertRowid, ...livraison };
    })();
  } catch (error) {
    console.error("Erreur createLivraison:", error);
    throw error;
  }
}

export function updateLivraison(id: number, livraison: any): any {
  try {
    const stmt = db.prepare(`
      UPDATE livraisons 
      SET adresse_livraison = ?, date_prevue = ?, statut = ?, notes = ?, livreur = ?, 
          date_livraison = CASE WHEN statut = 'en_cours' AND ? = 'livree' THEN DATETIME('now') ELSE date_livraison END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      livraison.adresse_livraison,
      livraison.date_prevue,
      livraison.statut,
      livraison.notes,
      livraison.livreur,
      livraison.statut,
      id
    );

    // If delivered, update the sale
    if (livraison.statut === 'livree') {
      const livr = db.prepare("SELECT vente_id FROM livraisons WHERE id = ?").get(id) as any;
      if (livr) {
        const vente = db.prepare("SELECT * FROM ventes WHERE id = ?").get(livr.vente_id) as any;
        db.prepare("UPDATE ventes SET delivered = 1, date_livraison = DATETIME('now') WHERE id = ?").run(livr.vente_id);

        // Si livraison différée → décrémenter le stock maintenant
        if (vente?.livraison_differee === 1) {
          const items = db.prepare(
            "SELECT produit_id, quantite FROM ventes_produits WHERE vente_id = ?"
          ).all(livr.vente_id) as any[];

          const updateStockStmt = db.prepare(
            "UPDATE produits SET quantite_stock = quantite_stock - ? WHERE id = ? AND sans_stock = 0"
          );
          for (const item of items) {
            updateStockStmt.run(item.quantite, item.produit_id);
          }
        }
      }
    }

    logAudit(
      "modifier livraison",
      "livraisons",
      id,
      `Livraison modifiée - Statut: ${livraison.statut}`,
      livraison.utilisateur_id,
      livraison.utilisateur_nom
    );

    return { id, ...livraison };
  } catch (error) {
    console.error("Erreur updateLivraison:", error);
    throw error;
  }
}

export function markAsDelivered(venteId: number): any {
  try {
    return db.transaction(() => {
      db.prepare("UPDATE ventes SET delivered = 1, date_livraison = DATETIME('now') WHERE id = ?").run(venteId);
      
      db.prepare(`
        UPDATE livraisons 
        SET statut = 'livree', date_livraison = DATETIME('now'), updated_at = CURRENT_TIMESTAMP 
        WHERE vente_id = ?
      `).run(venteId);

      logAudit(
        "marquer livrée",
        "ventes",
        venteId,
        `Vente #${venteId} marquée comme livrée`,
        undefined,
        undefined
      );

      return { venteId, delivered: true };
    })();
  } catch (error) {
    console.error("Erreur markAsDelivered:", error);
    throw error;
  }
}

// ===== STATISTIQUES CLIENT =====

export function getClientStats(clientId: number, startDate?: string, endDate?: string): any {
  try {
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as any;
    if (!client) return null;

    const dateFilter = startDate && endDate ? "AND DATE(date_vente) BETWEEN DATE(?) AND DATE(?)" : "";
    const dateParams: any[] = startDate && endDate ? [startDate, endDate] : [];

    const salesStats = db.prepare(`
      SELECT
        COUNT(*) as nb_ventes,
        COALESCE(SUM(total), 0) as total_achats,
        COALESCE(SUM(montant_paye), 0) as total_paye,
        COALESCE(SUM(montant_restant), 0) as total_dettes,
        COALESCE(SUM(CASE WHEN delivered = 1 THEN 1 ELSE 0 END), 0) as nb_livrees
      FROM ventes
      WHERE client_id = ? ${dateFilter}
    `).get(clientId, ...dateParams) as any;

    const paymentsStats = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total_rembourse
      FROM paiements_clients
      WHERE client_id = ?
    `).get(clientId) as any;

    const recentDateFilter = startDate && endDate ? "AND DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)" : "";
    const recentSales = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM ventes_produits vp WHERE vp.vente_id = v.id) as nb_articles
      FROM ventes v
      WHERE v.client_id = ? ${recentDateFilter}
      ORDER BY v.date_vente DESC
      LIMIT 10
    `).all(clientId, ...dateParams);

    return {
      ...client,
      ...salesStats,
      total_rembourse: paymentsStats.total_rembourse,
      reste_a_payer: Math.max(0, salesStats.total_dettes - paymentsStats.total_rembourse),
      recentSales
    };
  } catch (error) {
    console.error("Erreur getClientStats:", error);
    return null;
  }
}

export function getVenteDetails(venteId: number): any {
  try {
    const vente = db.prepare("SELECT * FROM ventes WHERE id = ?").get(venteId);
    const items = db.prepare(`
      SELECT vp.quantite, vp.prix_unitaire, vp.sous_total, p.nom as nom_produit
      FROM ventes_produits vp
      JOIN produits p ON vp.produit_id = p.id
      WHERE vp.vente_id = ?
    `).all(venteId);
    return { ...(vente as any), items };
  } catch (error) {
    console.error("Erreur getVenteDetails:", error);
    return null;
  }
}

export function getTotalCustomerDebtsByPeriod(startDate: string, endDate: string): number {
  try {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(montant_restant), 0) as total
      FROM ventes
      WHERE montant_restant > 0
      AND DATE(date_vente) BETWEEN DATE(?) AND DATE(?)
    `);
    const result = stmt.get(startDate, endDate) as { total: number };
    return result.total;
  } catch (error) {
    console.error("Erreur getTotalCustomerDebtsByPeriod:", error);
    return 0;
  }
}

export function getTotalSupplierDebtsByPeriod(startDate: string, endDate: string): number {
  try {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(montant_restant), 0) as total
      FROM achats
      WHERE montant_restant > 0
      AND DATE(date_achat) BETWEEN DATE(?) AND DATE(?)
    `);
    const result = stmt.get(startDate, endDate) as { total: number };
    return result.total;
  } catch (error) {
    console.error("Erreur getTotalSupplierDebtsByPeriod:", error);
    return 0;
  }
}

export function getCaissesByPeriod(startDate: string, endDate: string): any[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM caisses
      WHERE DATE(date_ouverture) BETWEEN DATE(?) AND DATE(?)
      ORDER BY date_ouverture DESC, heure_ouverture DESC
    `);
    return stmt.all(startDate, endDate);
  } catch (error) {
    console.error("Erreur getCaissesByPeriod:", error);
    return [];
  }
}

export function getTreasuryEvolution(startDate: string, endDate: string): any[] {
  try {
    const stmt = db.prepare(`
      WITH RECURSIVE dates(date) AS (
        SELECT DATE(?) as date
        UNION ALL
        SELECT DATE(date, '+1 day')
        FROM dates
        WHERE date < DATE(?)
      )
      SELECT 
        d.date,
        COALESCE((
          SELECT SUM(total)
          FROM ventes
          WHERE DATE(date_vente) = d.date
        ), 0) as ca_jour,
        (
          SELECT COALESCE(SUM(
            CASE 
              WHEN type_mouvement = 'entree' THEN montant
              ELSE -montant
            END
          ), 0)
          FROM comptabilite
          WHERE DATE(created_at) <= d.date
        ) as tresorerie_cumulee
      FROM dates d
      ORDER BY d.date ASC
    `);
    return stmt.all(startDate, endDate);
  } catch (error) {
    console.error("Erreur getTreasuryEvolution:", error);
    return [];
  }
}

// ===== RAPPORTS PDF =====

export function getSalesValueReport(startDate: string, endDate: string) {
  const stmt = db.prepare(`
    SELECT
      p.nom as designation,
      'Pièce' as unite,
      SUM(vp.quantite) as quantite,
      COALESCE(SUM(COALESCE(p.prix_achat, 0) * vp.quantite), 0) as valeur_achat,
      COALESCE(SUM(vp.sous_total), 0) as valeur_vente,
      COALESCE(SUM((vp.prix_unitaire - COALESCE(p.prix_achat, 0)) * vp.quantite), 0) as marge
    FROM ventes_produits vp
    JOIN ventes v ON vp.vente_id = v.id
    JOIN produits p ON vp.produit_id = p.id
    WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
    GROUP BY p.id, p.nom
    ORDER BY p.nom ASC
  `);
  return stmt.all(startDate, endDate);
}

export function getCreditSalesDetailedReport(startDate: string, endDate: string) {
  const salesStmt = db.prepare(`
    SELECT
      v.id, CAST(v.id AS TEXT) as numero, v.date_vente, v.client_nom,
      COALESCE(c.telephone, '') as client_telephone,
      COALESCE(c.email, '') as client_email,
      v.total,
      COALESCE(v.total_avant_remise, v.total) as total_avant_remise,
      COALESCE(v.remise_valeur, 0) as remise_valeur,
      v.remise_type,
      v.montant_paye,
      v.montant_restant,
      v.methode_paiement,
      v.delivered,
      v.statut_paiement
    FROM ventes v
    LEFT JOIN clients c ON v.client_id = c.id
    WHERE DATE(v.date_vente) BETWEEN DATE(?) AND DATE(?)
      AND v.statut_paiement IN ('impaye', 'partiel')
    ORDER BY v.date_vente ASC, v.id ASC
  `);
  const sales = salesStmt.all(startDate, endDate) as any[];

  const productsStmt = db.prepare(`
    SELECT p.nom as nom_produit, vp.quantite, vp.prix_unitaire, vp.sous_total
    FROM ventes_produits vp
    JOIN produits p ON vp.produit_id = p.id
    WHERE vp.vente_id = ?
  `);

  return sales.map((sale) => ({
    ...sale,
    produits: productsStmt.all(sale.id),
  }));
}
