# Guide de Démarrage Rapide

## Installation en 5 Étapes

### Étape 1 : Installer MySQL

**macOS :**
```bash
brew install mysql
brew services start mysql
```

**Linux (Ubuntu/Debian) :**
```bash
sudo apt-get update
sudo apt-get install mysql-server
sudo service mysql start
```

**Windows :**
1. Téléchargez MySQL depuis https://dev.mysql.com/downloads/installer/
2. Installez avec les paramètres par défaut
3. Notez votre mot de passe root

### Étape 2 : Créer la Base de Données

```bash
# Se connecter à MySQL
mysql -u root -p

# Si pas de mot de passe
mysql -u root
```

Dans MySQL, exécutez :
```sql
source /chemin/vers/database.sql
```

Ou directement depuis le terminal :
```bash
mysql -u root -p < database.sql
```

### Étape 3 : Installer les Dépendances Node

```bash
npm install
```

Cela peut prendre quelques minutes...

### Étape 4 : Configurer la Connexion MySQL

Ouvrez `src/main/database.ts` et modifiez :

```typescript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Mettez votre mot de passe MySQL ici
  database: 'gestion_stock',
  // ...
};
```

### Étape 5 : Lancer l'Application

```bash
npm run dev
```

L'application va s'ouvrir automatiquement !

## Premiers Pas

### 1. Ajouter des Catégories

1. Allez dans **Produits**
2. Les catégories par défaut sont déjà créées (Alimentaire, Électronique, etc.)

### 2. Ajouter vos Premiers Produits

1. Cliquez sur **Nouveau Produit**
2. Remplissez les informations :
   - Nom du produit
   - Prix d'achat et de vente
   - Quantité en stock
   - Stock minimum
   - Catégorie
3. Cliquez sur **Enregistrer**

### 3. Effectuer votre Première Vente

1. Allez dans **Caisse**
2. Recherchez ou cliquez sur un produit
3. Le produit est ajouté au panier
4. Ajustez la quantité si nécessaire
5. Cliquez sur **Procéder au paiement**
6. Choisissez la méthode de paiement
7. Validez la vente

### 4. Consulter le Dashboard

1. Retournez à **Dashboard**
2. Vous verrez :
   - Ventes du jour
   - Ventes du mois
   - Nombre de produits
   - Alertes de stock

## Résolution de Problèmes Courants

### Erreur : Cannot connect to MySQL

**Cause** : MySQL n'est pas démarré ou mauvais identifiants

**Solution** :
```bash
# Vérifier si MySQL est actif
mysql -u root -p

# Si erreur, démarrer MySQL :
# macOS
brew services start mysql

# Linux
sudo service mysql start

# Windows
# Démarrer depuis "Services"
```

### Erreur : Database does not exist

**Cause** : La base de données n'a pas été créée

**Solution** :
```bash
mysql -u root -p < database.sql
```

### L'application ne démarre pas

**Solution** :
```bash
# Supprimer et réinstaller
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Port 5173 already in use

**Solution** :
1. Tuez le processus : `lsof -ti:5173 | xargs kill -9`
2. Ou modifiez le port dans `vite.config.ts`

## Raccourcis Clavier (à venir)

- `Ctrl/Cmd + N` : Nouveau produit
- `Ctrl/Cmd + F` : Rechercher
- `Ctrl/Cmd + S` : Sauvegarder
- `F2` : Aller à la caisse

## Astuces

1. **Recherche rapide** : Dans la caisse, tapez le code-barre ou le début du nom
2. **Stock faible** : Le Dashboard affiche les produits à réapprovisionner
3. **Filtrage** : Utilisez les filtres par date dans l'historique des ventes
4. **Marge** : La marge bénéficiaire est calculée automatiquement lors de l'ajout d'un produit

## Données de Test

L'application est livrée avec des données d'exemple :
- 6 catégories
- 7 produits

Vous pouvez les modifier ou supprimer à votre guise !

## Support

Besoin d'aide ? Consultez le fichier README.md pour plus de détails.

---

Bon courage avec votre gestion de stock ! 🚀
