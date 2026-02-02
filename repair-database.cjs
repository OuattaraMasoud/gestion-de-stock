const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

console.log("🔧 Script de réparation de la base de données Gestion Stock\n");

// Chemin vers la base de données
const userDataPath = path.join(process.env.HOME || process.env.USERPROFILE, "Library/Application Support/gestion-de-stock/data");
const dbPath = path.join(userDataPath, "gestion_stock.db");

console.log(`📂 Base de données: ${dbPath}\n`);

if (!fs.existsSync(dbPath)) {
  console.error("❌ Base de données introuvable!");
  process.exit(1);
}

try {
  const db = new Database(dbPath);

  console.log("🔍 Étape 1: Vérification de l'intégrité...");
  try {
    const integrityResult = db.pragma("integrity_check", { simple: true });
    if (integrityResult === "ok") {
      console.log("✅ Base de données saine, pas de réparation nécessaire.");
      db.close();
      process.exit(0);
    } else {
      console.log(`⚠️  Erreur d'intégrité détectée: ${integrityResult}`);
    }
  } catch (integrityError) {
    console.log(`⚠️  Erreur lors de la vérification d'intégrité: ${integrityError.message}`);
  }

  console.log("\n🗑️  Étape 2: Suppression des tables FTS5 corrompues...");
  try {
    db.exec(`
      DROP TABLE IF EXISTS produits_fts;
      DROP TABLE IF EXISTS clients_fts;
      DROP TABLE IF EXISTS fournisseurs_fts;
      DROP TABLE IF EXISTS utilisateurs_fts;
    `);
    console.log("✅ Tables FTS5 supprimées");
  } catch (dropError) {
    console.log(`⚠️  Erreur lors de la suppression des tables FTS5: ${dropError.message}`);
  }

  console.log("\n🗑️  Étape 3: Suppression des triggers associés...");
  try {
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
    console.log("✅ Triggers supprimés");
  } catch (triggerError) {
    console.log(`⚠️  Erreur lors de la suppression des triggers: ${triggerError.message}`);
  }

  console.log("\n🧹 Étape 4: Nettoyage (VACUUM)...");
  try {
    db.exec("VACUUM");
    console.log("✅ Nettoyage effectué");
  } catch (vacuumError) {
    console.log(`⚠️  Erreur lors du VACUUM: ${vacuumError.message}`);
  }

  console.log("\n✅ Réparation terminée avec succès !");
  console.log("\n📝 Prochaines étapes:");
  console.log("   1. Relancez l'application");
  console.log("   2. Les tables FTS5 seront recréées automatiquement");
  console.log("   3. Essayez de vous connecter\n");

  db.close();
} catch (error) {
  console.error("\n❌ Erreur lors de la réparation:", error.message);
  console.error("\n💡 Solution de secours:");
  console.error("   1. Faites une sauvegarde de votre base de données actuelle");
  console.error("   2. Supprimez le fichier:", dbPath);
  console.error("   3. Relancez l'application pour créer une nouvelle base de données vierge\n");
  process.exit(1);
}
