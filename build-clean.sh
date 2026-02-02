#!/bin/bash

# Script pour créer un installateur Windows sans signature
# Ce script désactive TOUTES les signatures automatiques

echo "🔧 Nettoyage des anciens builds..."
rm -rf release/

echo "📦 Construction de l'application..."
npm run build

echo "⚙️  Création de l'installateur SANS signature..."
# Définir TOUTES les variables de signature à vide
export CSC_KEY=""
export CSC_LINK=""
export CSC_KEY_PASSWORD=""
export CSC_LINK_PASSWORD=""
export WINDOWS_SIGN_FILE=""
export FORCE_SIGNING="false"
export CSC_SIGNER_NAME=""
export CSC_CA_CHAIN=""
export CSC_TIMESTAMP_SERVER=""
export CSC_KEY_CONTAINER=""
export CSC_SHA1=""
export CSC_SHA256=""

# Construire avec toutes les options de désactivation
npx electron-builder --win \
  --publish=never \
  --config.win.verifyUpdateCodeSignature=false \
  --config.win.forceCodeSigning=false

echo "✅ Installateur créé dans release/"
echo "Fichier : Gestion de Stock-1.0.0-setup.exe"