# Gestion de Stock

Application desktop professionnelle de gestion de stock et caisse développée avec Electron, React, TypeScript et MySQL.

## Fonctionnalités

### Système de Gestion des Rôles
L'application intègre un système complet de gestion des permissions basé sur les rôles :

**Rôle Admin (Administrateur)**
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Accès au Dashboard, Produits, Catégories, Caisse, Historique et Statistiques

**Rôle Gestionnaire**
- Gestion des produits et du stock
- Consultation des ventes et statistiques
- Accès au Dashboard, Produits, Catégories, Historique et Statistiques
- AUCUN accès : Caisse, Utilisateurs

**Rôle Caissier**
- Accès uniquement à la Caisse (Point de Vente)
- Peut effectuer des ventes
- AUCUN accès aux autres modules

### Dashboard
- Statistiques en temps réel
- Ventes du jour et du mois
- Alertes de stock faible
- Valeur totale du stock
- Vue d'ensemble complète

### Gestion des Produits
- CRUD complet (Créer, Lire, Mettre à jour, Supprimer)
- Recherche avancée par nom ou code-barre
- Gestion des catégories
- Calcul automatique de la marge bénéficiaire
- Alertes de stock minimum
- Import/Export de données

### Point de Vente (Caisse)
- Interface intuitive et rapide
- Recherche de produits en temps réel
- Gestion du panier
- Multiple méthodes de paiement (Espèces, Carte, Mobile)
- Calcul automatique de la monnaie rendue
- Validation des stocks

### Historique des Ventes
- Liste complète de toutes les ventes
- Filtrage par date
- Détails de chaque vente
- Informations sur les produits vendus

### Statistiques et Rapports
- Performance du jour
- Analyse du panier moyen
- Graphiques et indicateurs
- Recommandations

## Technologies Utilisées

- **Electron** - Framework desktop
- **React 19** - Interface utilisateur
- **TypeScript** - Langage typé
- **Tailwind CSS** - Stylisation moderne
- **MySQL** - Base de données
- **Zustand** - Gestion d'état
- **React Router** - Navigation
- **Lucide React** - Icônes
- **Vite** - Build tool rapide

## Prérequis

Avant d'installer l'application, assurez-vous d'avoir :

1. **Node.js** (version 18 ou supérieure)
   - Télécharger : https://nodejs.org/

2. **MySQL** (version 5.7 ou supérieure)
   - macOS : `brew install mysql`
   - Windows : Télécharger depuis https://dev.mysql.com/downloads/
   - Linux : `sudo apt-get install mysql-server`

## Installation

### 1. Cloner ou extraire le projet

```bash
cd gestion-de-stock
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer MySQL

#### a) Démarrer MySQL

**macOS :**
```bash
brew services start mysql
```

**Linux :**
```bash
sudo service mysql start
```

**Windows :**
MySQL démarre automatiquement après l'installation.

#### b) Se connecter à MySQL

```bash
mysql -u root -p
```

Si vous n'avez pas de mot de passe, utilisez :
```bash
mysql -u root
```

#### c) Créer la base de données

Exécutez le fichier SQL fourni :

```bash
mysql -u root -p < database.sql
```

Ou manuellement dans MySQL :
```sql
source /chemin/vers/database.sql
```

#### d) Configurer les identifiants de connexion

Ouvrez le fichier `src/main/database.ts` et modifiez les paramètres de connexion :

```typescript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'votre_mot_de_passe', // Modifiez ici
  database: 'gestion_stock',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
```

## Lancement de l'application

### Mode Développement

Pour lancer l'application en mode développement :

```bash
npm run dev
```

Cette commande va :
1. Démarrer le serveur Vite (React)
2. Lancer Electron automatiquement
3. Activer le hot-reload

### Build Production

Pour compiler l'application :

```bash
npm run build
```

### Créer un exécutable

Pour créer un fichier installable :

```bash
npm run package
```

L'exécutable sera créé dans le dossier `release/`.

## Structure du Projet

```
gestion-de-stock/
├── src/
│   ├── main/              # Processus principal Electron
│   │   ├── main.ts        # Point d'entrée Electron
│   │   ├── database.ts    # Connexion et requêtes MySQL
│   │   └── preload.ts     # Script de préchargement sécurisé
│   │
│   └── renderer/          # Application React
│       ├── components/    # Composants réutilisables
│       │   ├── Layout.tsx
│       │   └── ProductModal.tsx
│       │
│       ├── pages/         # Pages de l'application
│       │   ├── Dashboard.tsx
│       │   ├── Products.tsx
│       │   ├── PointOfSale.tsx
│       │   ├── SalesHistory.tsx
│       │   └── Statistics.tsx
│       │
│       ├── store/         # Gestion d'état Zustand
│       │   └── useStore.ts
│       │
│       ├── styles/        # Fichiers CSS
│       │   └── index.css
│       │
│       ├── types/         # Types TypeScript
│       │   └── index.ts
│       │
│       ├── App.tsx        # Composant principal
│       └── main.tsx       # Point d'entrée React
│
├── database.sql           # Script SQL de création
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Base de Données

### Tables

1. **categories** - Catégories de produits
2. **produits** - Informations sur les produits
3. **ventes** - Enregistrement des ventes
4. **ventes_produits** - Détails des produits vendus

### Données Exemple

Le fichier `database.sql` inclut :
- 6 catégories par défaut
- 7 produits d'exemple
- 3 utilisateurs de test :
  - **Admin** : admin@stock.com / admin123 (Accès complet)
  - **Gestionnaire** : gestionnaire@stock.com / gestionnaire123 (Gestion & Statistiques)
  - **Caissier** : caissier@stock.com / caissier123 (Caisse uniquement)

## Utilisation

### Connexion

L'application nécessite une authentification. Utilisez les comptes de test :

```
Admin : admin@stock.com / admin123
Gestionnaire : gestionnaire@stock.com / gestionnaire123
Caissier : caissier@stock.com / caissier123
```

Selon votre rôle, vous serez automatiquement redirigé vers la page appropriée :
- **Admin** et **Gestionnaire** → Dashboard
- **Caissier** → Caisse

### Ajouter un Produit

1. Aller dans "Produits"
2. Cliquer sur "Nouveau Produit"
3. Remplir le formulaire
4. Cliquer sur "Enregistrer"

### Effectuer une Vente

1. Aller dans "Caisse"
2. Rechercher ou sélectionner des produits
3. Ajuster les quantités dans le panier
4. Cliquer sur "Procéder au paiement"
5. Choisir la méthode de paiement
6. Valider la vente

### Consulter les Statistiques

1. Aller dans "Dashboard" pour un aperçu rapide
2. Aller dans "Statistiques" pour des analyses détaillées
3. Utiliser "Historique" pour voir toutes les ventes

## Personnalisation

### Changer les Couleurs

Modifiez `tailwind.config.js` :

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#votre-couleur',
        // ...
      },
    },
  },
}
```

### Modifier la Devise

Par défaut, l'application utilise le Franc CFA (FCFA). Pour changer :

1. Recherchez "FCFA" dans tous les fichiers
2. Remplacez par votre devise (ex: "€", "$", etc.)

## Dépannage

### Erreur de connexion MySQL

**Problème** : `Error: connect ECONNREFUSED`

**Solution** :
1. Vérifiez que MySQL est démarré
2. Vérifiez les identifiants dans `src/main/database.ts`
3. Vérifiez que la base de données existe

### L'application ne démarre pas

**Solution** :
1. Supprimez `node_modules` et `package-lock.json`
2. Réinstallez : `npm install`
3. Relancez : `npm run dev`

### Erreurs TypeScript

**Solution** :
```bash
npm run build
```

### Port déjà utilisé

Si le port 5173 est occupé, modifiez `vite.config.ts` :

```typescript
server: {
  port: 5174, // Changez le port
},
```

## Sécurité

- Les mots de passe MySQL ne doivent JAMAIS être commités
- Utilisez des variables d'environnement pour la production
- Activez contextIsolation dans Electron (déjà fait)
- Validez toutes les entrées utilisateur

## Performance

- La base de données est indexée pour des recherches rapides
- Le cache est utilisé pour les données fréquemment consultées
- Les requêtes sont optimisées avec des JOINs

## Contribuer

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche (`git checkout -b feature/amelioration`)
3. Committez vos changements (`git commit -m 'Ajout d'une fonctionnalité'`)
4. Push vers la branche (`git push origin feature/amelioration`)
5. Ouvrez une Pull Request

## Support

Pour toute question ou problème :
- Créez une issue sur GitHub
- Consultez la documentation
- Contactez le développeur

## Licence

MIT License - Libre d'utilisation et de modification

## Auteur

Développé avec ❤️ pour simplifier la gestion de stock

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025
