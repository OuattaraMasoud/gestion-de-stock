# Guide de Compilation - Gestion de Stock

## Prérequis

Avant de compiler l'application, assurez-vous d'avoir :

1. **Node.js** (version 18 ou supérieure)
2. **npm** ou **yarn**
3. **Python** (pour la compilation de certain modules natifs)
4. **Windows Build Tools** (si vous compilez sur Windows)

## Installation des dépendances

```bash
npm install
```

## Compilation de l'application

### Pour créer un exécutable Windows (sur n'importe quel OS)

```bash
npm run package:win
```

Cette commande va :
1. Compiler le code TypeScript et React
2. Créer deux versions de l'application :
   - **Installeur NSIS** : `release/Gestion de Stock Setup 1.0.0.exe`
   - **Version Portable** : `release/Gestion de Stock-1.0.0-portable.exe`

### Pour compiler pour tous les OS

```bash
npm run package
```

## Fichiers générés

Les fichiers compilés se trouvent dans le dossier `release/` :

### Windows
- `Gestion de Stock Setup 1.0.0.exe` - Installeur complet avec assistant d'installation
- `Gestion de Stock-1.0.0-portable.exe` - Version portable (ne nécessite pas d'installation)

### Caractéristiques de l'installeur NSIS
- Choix du répertoire d'installation
- Création de raccourcis (bureau + menu démarrer)
- Programme de désinstallation
- Assistant d'installation

### Caractéristiques de la version portable
- Aucune installation requise
- Exécution directe
- Idéal pour clé USB ou utilisation temporaire

## Notes importantes

### Configuration MySQL
L'application nécessite une connexion MySQL. Assurez-vous que :
1. MySQL est installé et en cours d'exécution
2. Les informations de connexion sont correctes dans le fichier de configuration
3. La base de données a été créée avec le schéma approprié

### Dépendances natives
L'application utilise des modules natifs (better-sqlite3, mysql2) qui sont automatiquement compilés pour la plateforme cible.

## Dépannage

### Erreur de compilation de modules natifs
Si vous rencontrez des erreurs lors de la compilation :

```bash
# Nettoyer le cache et réinstaller
rm -rf node_modules
npm cache clean --force
npm install
```

### Problème avec electron-builder
```bash
# Nettoyer le cache d'electron-builder
npx electron-builder clean
```

### Tester avant de compiler
Toujours tester l'application en mode développement avant de compiler :

```bash
npm run dev
```

## Structure de l'exécutable

L'application compilée contient :
- L'application Electron packagée
- Les ressources (icônes, fichiers de configuration)
- Les modules Node.js nécessaires
- La base de données SQLite (si configurée)

## Support

Pour toute question ou problème, veuillez consulter la documentation ou créer une issue sur le dépôt du projet.
