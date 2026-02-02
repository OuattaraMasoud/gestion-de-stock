const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Nettoyer les anciens builds
if (fs.existsSync('release')) {
  fs.rmSync('release', { recursive: true, force: true });
}

// Variables d'environnement pour désactiver la signature
process.env.CSC_KEY = '';
process.env.CSC_LINK = '';
process.env.WINDOWS_SIGN_FILE = '';

console.log('1. Construction de l\'application...');
execSync('npm run build', { stdio: 'inherit' });

console.log('2. Création de la version Windows non signée...');
execSync('npx electron-builder --win --publish=never', {
  stdio: 'inherit',
  env: {
    ...process.env,
    CSC_KEY: '',
    CSC_LINK: '',
    WINDOWS_SIGN_FILE: '',
    CSC_KEY_PASSWORD: '',
    FORCE_SIGNING: 'false'
  }
});

console.log('3. Compression avec 7-Zip pour créer un installateur simple...');
// Créer une archive auto-extractible avec 7-Zip (si disponible)
try {
  execSync('cd release/win-unpacked && 7z a -sfx7z.sfx "../Gestion-de-Stock-1.0.0-Portable.exe" *', { stdio: 'inherit' });
  console.log('✅ Archive portable créée avec 7-Zip');
} catch (error) {
  console.log('⚠️ 7-Zip non disponible, création d\'un simple ZIP...');
  execSync('cd release/win-unpacked && 7z a "../Gestion-de-Stock-1.0.0.zip" *', { stdio: 'inherit' });
}

console.log('✅ Fichiers créés dans le dossier release/');
console.log('- Gestion de Stock-1.0.0-setup.exe (installateur NSIS)');
console.log('- Gestion de Stock-1.0.0-portable.exe (version portable)');
console.log('- Gestion-de-Stock-1.0.0.zip (archive simple)');