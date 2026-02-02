import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { apiClient } from './apiClient';

// Import dynamique pour node-machine-id (compatibilité ESM)
let machineIdSync: () => string;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeMachineId = require('node-machine-id');
  machineIdSync = nodeMachineId.machineIdSync;
} catch {
  // Fallback si le module n'est pas disponible
  machineIdSync = () => {
    const data = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  };
}

// ============================================================
// CONFIGURATION
// ============================================================

const LICENSE_FILE_NAME = 'license.dat';
const GRACE_PERIOD_DAYS = 7;

// ============================================================
// TYPES
// ============================================================

export interface LicenseInfo {
  licenseKey: string;
  machineId: string;
  boutiqueId: string;
  type: 'trial' | 'perpetual' | 'subscription';
  expiresAt: string | null;
  features: string[];
  customerName: string;
  accessToken: string;
  refreshToken: string;
  lastValidated: string;
  activatedAt: string;
}

export interface LicenseStatus {
  isValid: boolean;
  isActivated: boolean;
  isOnline: boolean;
  isGracePeriod: boolean;
  daysRemaining?: number;
  graceDaysRemaining?: number;
  error?: string;
  errorCode?: string;
  license?: LicenseInfo;
}

export interface ActivationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  license?: LicenseInfo;
}

// ============================================================
// STOCKAGE LOCAL SÉCURISÉ (AES-256-GCM)
// ============================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_SALT = 'SynkaPOS_License_v2_Salt_2024';
const AUTH_TAG_LENGTH = 16;

function getLicenseFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, LICENSE_FILE_NAME);
}

/**
 * Dérive une clé de chiffrement à partir du machineId
 */
function deriveEncryptionKey(machineId: string): Buffer {
  return crypto.scryptSync(
    machineId + KEY_DERIVATION_SALT,
    'SynkaPOS_Scrypt_Salt',
    32
  );
}

/**
 * Chiffre les données avec AES-256-GCM
 */
function encryptData(data: string, machineId: string): string {
  const key = deriveEncryptionKey(machineId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Déchiffre les données avec AES-256-GCM
 */
function decryptData(encryptedData: string, machineId: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const key = deriveEncryptionKey(machineId);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erreur déchiffrement:', error);
    return null;
  }
}

/**
 * Sauvegarde les informations de licence localement avec chiffrement AES-256-GCM
 */
function saveLicenseLocally(license: LicenseInfo): void {
  const filePath = getLicenseFilePath();
  const data = JSON.stringify(license);
  const machineId = getMachineId();

  const encrypted = encryptData(data, machineId);
  fs.writeFileSync(filePath, encrypted, 'utf-8');
}

/**
 * Charge les informations de licence depuis le stockage local
 */
function loadLicenseLocally(): LicenseInfo | null {
  const filePath = getLicenseFilePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const encrypted = fs.readFileSync(filePath, 'utf-8');
    const machineId = getMachineId();

    // Support de l'ancien format base64 pour migration
    if (!encrypted.includes(':')) {
      try {
        const data = Buffer.from(encrypted, 'base64').toString('utf-8');
        const license = JSON.parse(data) as LicenseInfo;
        // Migration: re-sauvegarder avec le nouveau chiffrement
        saveLicenseLocally(license);
        console.log('[License] Migration vers chiffrement AES-256-GCM effectuée');
        return license;
      } catch {
        return null;
      }
    }

    const data = decryptData(encrypted, machineId);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as LicenseInfo;
  } catch (error) {
    console.error('Erreur lecture licence locale:', error);
    return null;
  }
}

/**
 * Supprime les informations de licence locales
 */
function deleteLicenseLocally(): void {
  const filePath = getLicenseFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ============================================================
// MACHINE ID
// ============================================================

/**
 * Obtient l'identifiant unique de la machine
 */
export function getMachineId(): string {
  try {
    return machineIdSync();
  } catch (error) {
    console.error('Erreur obtention machineId:', error);
    // Fallback: générer un ID basé sur des informations système
    const fallbackData = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
    return crypto.createHash('sha256').update(fallbackData).digest('hex');
  }
}

// ============================================================
// ACTIVATION
// ============================================================

/**
 * Active une licence avec une clé
 */
export async function activateLicense(licenseKey: string): Promise<ActivationResult> {
  const machineId = getMachineId();
  const machineName = os.hostname();
  const appVersion = app.getVersion();

  try {
    const response = await apiClient.post('/licenseActivate', {
      licenseKey: licenseKey.toUpperCase().trim(),
      machineId,
      machineName,
      appVersion,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.message || 'Erreur d\'activation',
        errorCode: response.error,
      };
    }

    const { data } = response;

    const licenseInfo: LicenseInfo = {
      licenseKey: licenseKey.toUpperCase().trim(),
      machineId,
      boutiqueId: data.boutiqueId,
      type: data.type,
      expiresAt: data.expiresAt,
      features: data.features,
      customerName: data.customerName,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      lastValidated: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    };

    // Sauvegarder localement
    saveLicenseLocally(licenseInfo);

    return {
      success: true,
      license: licenseInfo,
    };
  } catch (error: any) {
    console.error('Erreur activation:', error);
    return {
      success: false,
      error: error.message || 'Erreur de connexion au serveur',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Valide la licence au démarrage
 * Gère le mode hors-ligne avec grace period
 */
export async function validateLicense(): Promise<LicenseStatus> {
  console.log('[License] Début validation licence...');
  const localLicense = loadLicenseLocally();
  console.log('[License] Licence locale:', localLicense ? 'trouvée' : 'non trouvée');

  // Pas de licence locale = pas activé
  if (!localLicense) {
    console.log('[License] Pas de licence locale, retour NOT_ACTIVATED');
    return {
      isValid: false,
      isActivated: false,
      isOnline: false,
      isGracePeriod: false,
      error: 'Aucune licence activée',
      errorCode: 'NOT_ACTIVATED',
    };
  }

  const machineId = getMachineId();

  // Vérifier que c'est la bonne machine
  if (localLicense.machineId !== machineId) {
    deleteLicenseLocally();
    return {
      isValid: false,
      isActivated: false,
      isOnline: false,
      isGracePeriod: false,
      error: 'Licence non valide pour cette machine',
      errorCode: 'MACHINE_MISMATCH',
    };
  }

  // Tenter la validation en ligne
  try {
    const response = await apiClient.post('/licenseValidate', {
      licenseKey: localLicense.licenseKey,
      machineId,
      refreshToken: localLicense.refreshToken,
      appVersion: app.getVersion(),
    });

    if (response.success && response.valid) {
      // Mise à jour des tokens et de la date de validation
      const updatedLicense: LicenseInfo = {
        ...localLicense,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken || localLicense.refreshToken,
        lastValidated: new Date().toISOString(),
        expiresAt: response.data.expiresAt,
        features: response.data.features,
      };

      saveLicenseLocally(updatedLicense);

      return {
        isValid: true,
        isActivated: true,
        isOnline: true,
        isGracePeriod: false,
        daysRemaining: response.data.daysRemaining,
        license: updatedLicense,
      };
    }

    // Licence révoquée ou expirée
    if (response.error === 'LICENSE_REVOKED' || response.error === 'LICENSE_EXPIRED') {
      deleteLicenseLocally();
      return {
        isValid: false,
        isActivated: false,
        isOnline: true,
        isGracePeriod: false,
        error: response.message,
        errorCode: response.error,
      };
    }

    // Autre erreur du serveur
    return {
      isValid: false,
      isActivated: true,
      isOnline: true,
      isGracePeriod: false,
      error: response.message || 'Erreur de validation',
      errorCode: response.error,
    };

  } catch (error: any) {
    // Mode hors-ligne - vérifier la grace period
    console.log('Validation hors-ligne, vérification grace period...');

    const lastValidated = new Date(localLicense.lastValidated);
    const now = new Date();
    const daysSinceValidation = Math.floor(
      (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceValidation <= GRACE_PERIOD_DAYS) {
      // Dans la période de grâce
      const graceDaysRemaining = GRACE_PERIOD_DAYS - daysSinceValidation;

      return {
        isValid: true,
        isActivated: true,
        isOnline: false,
        isGracePeriod: true,
        graceDaysRemaining,
        license: localLicense,
      };
    }

    // Grace period expirée
    return {
      isValid: false,
      isActivated: true,
      isOnline: false,
      isGracePeriod: false,
      error: `Période de grâce expirée. Dernière validation il y a ${daysSinceValidation} jours.`,
      errorCode: 'GRACE_PERIOD_EXPIRED',
    };
  }
}

// ============================================================
// DÉSACTIVATION
// ============================================================

/**
 * Désactive la licence sur cette machine
 */
export async function deactivateLicense(): Promise<{ success: boolean; error?: string }> {
  const localLicense = loadLicenseLocally();

  if (!localLicense) {
    return { success: false, error: 'Aucune licence active' };
  }

  try {
    const response = await apiClient.post('/licenseDeactivate', {
      licenseKey: localLicense.licenseKey,
      machineId: getMachineId(),
    });

    // Supprimer la licence locale même si la requête échoue
    deleteLicenseLocally();

    if (!response.success) {
      return { success: false, error: response.message };
    }

    return { success: true };
  } catch (error: any) {
    // Supprimer localement quand même
    deleteLicenseLocally();
    return { success: true };
  }
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Obtient les informations de licence actuelles
 */
export function getCurrentLicense(): LicenseInfo | null {
  return loadLicenseLocally();
}

/**
 * Obtient le token d'accès pour les appels API
 */
export function getAccessToken(): string | null {
  const license = loadLicenseLocally();
  return license?.accessToken || null;
}

/**
 * Rafraîchit le token d'accès si nécessaire
 */
export async function refreshAccessToken(): Promise<string | null> {
  const license = loadLicenseLocally();

  if (!license) {
    return null;
  }

  try {
    const response = await apiClient.post('/licenseRefresh', {
      refreshToken: license.refreshToken,
    });

    if (response.success && response.data) {
      const updatedLicense: LicenseInfo = {
        ...license,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken || license.refreshToken,
      };

      saveLicenseLocally(updatedLicense);
      return updatedLicense.accessToken;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si une fonctionnalité est disponible
 */
export function hasFeature(feature: string): boolean {
  const license = loadLicenseLocally();
  if (!license) return false;
  return license.features.includes('*') || license.features.includes(feature);
}
