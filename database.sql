-- Création de la base de données
CREATE DATABASE IF NOT EXISTS gestion_stock CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_stock;

-- Table des catégories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des produits
CREATE TABLE IF NOT EXISTS produits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(200) NOT NULL,
  description TEXT,
  code_barre VARCHAR(50) UNIQUE,
  prix_achat DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  prix_vente DECIMAL(10, 2) NOT NULL,
  quantite_stock INT NOT NULL DEFAULT 0,
  stock_min INT DEFAULT 5,
  categorie_id INT,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_nom (nom),
  INDEX idx_code_barre (code_barre),
  INDEX idx_categorie (categorie_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des ventes
CREATE TABLE IF NOT EXISTS ventes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  total DECIMAL(10, 2) NOT NULL,
  montant_paye DECIMAL(10, 2) NOT NULL,
  monnaie_rendue DECIMAL(10, 2) DEFAULT 0.00,
  methode_paiement ENUM('especes', 'carte', 'mobile') DEFAULT 'especes',
  date_vente TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date_vente (date_vente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des produits vendus (détails des ventes)
CREATE TABLE IF NOT EXISTS ventes_produits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vente_id INT NOT NULL,
  produit_id INT NOT NULL,
  quantite INT NOT NULL,
  prix_unitaire DECIMAL(10, 2) NOT NULL,
  sous_total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (vente_id) REFERENCES ventes(id) ON DELETE CASCADE,
  FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE RESTRICT,
  INDEX idx_vente (vente_id),
  INDEX idx_produit (produit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  role ENUM('admin', 'caissier', 'gestionnaire') DEFAULT 'caissier',
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertion de catégories par défaut
INSERT INTO categories (nom, description) VALUES
('Alimentaire', 'Produits alimentaires et boissons'),
('Électronique', 'Appareils et accessoires électroniques'),
('Vêtements', 'Vêtements et accessoires de mode'),
('Maison', 'Articles pour la maison et décoration'),
('Beauté', 'Produits de beauté et cosmétiques'),
('Sport', 'Articles de sport et fitness');

-- Insertion de quelques produits exemples
INSERT INTO produits (nom, description, code_barre, prix_achat, prix_vente, quantite_stock, stock_min, categorie_id) VALUES
('Coca-Cola 1.5L', 'Boisson gazeuse', '5449000000996', 0.80, 1.50, 50, 10, 1),
('Pain de mie', 'Pain tranché 500g', '3017760000017', 0.60, 1.20, 30, 5, 1),
('Smartphone XYZ', 'Téléphone intelligent dernière génération', '1234567890123', 250.00, 399.00, 15, 3, 2),
('T-shirt coton', 'T-shirt 100% coton', '9876543210987', 5.00, 15.00, 40, 10, 3),
('Lampe LED', 'Lampe de bureau LED', '5551234567890', 8.00, 19.99, 20, 5, 4),
('Shampoing Naturel', 'Shampoing bio 250ml', '7778889990001', 3.50, 8.99, 35, 8, 5),
('Ballon de football', 'Ballon taille 5', '6669998887770', 12.00, 25.00, 12, 3, 6);

-- Insertion d'un utilisateur admin par défaut (mot de passe: admin123)
INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES
('Administrateur', 'admin@stock.com', 'admin123', 'admin'),
('Caissier Principal', 'caissier@stock.com', 'caisse123', 'caissier');
