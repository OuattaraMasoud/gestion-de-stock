import { net } from 'electron';
import { getAccessToken, refreshAccessToken } from './license';

// ============================================================
// CONFIGURATION
// ============================================================

// URL de l'API - À remplacer par votre URL Firebase Functions
const API_BASE_URL = process.env.LICENSE_API_URL || 'https://us-central1-gestion-de-stock-82f41.cloudfunctions.net';

// Timeout des requêtes (10 secondes)
const REQUEST_TIMEOUT = 10000;

// ============================================================
// TYPES
// ============================================================

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  valid?: boolean;
  data?: any;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  authenticated?: boolean;
  timeout?: number;
}

// ============================================================
// CERTIFICATE PINNING (Optionnel mais recommandé)
// ============================================================

// En production, ajoutez le fingerprint SHA256 du certificat de votre serveur
// Pour l'obtenir: openssl s_client -connect your-domain.com:443 | openssl x509 -fingerprint -sha256
const PINNED_CERTIFICATES: string[] = [
  // Exemple: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  // Ajoutez vos certificats ici
];

/**
 * Vérifie le certificat du serveur (Certificate Pinning)
 * Note: Cette fonctionnalité nécessite une configuration supplémentaire
 */
function verifyCertificate(certificate: Electron.Certificate): boolean {
  if (PINNED_CERTIFICATES.length === 0) {
    // Pas de certificate pinning configuré, accepter tous les certificats valides
    return true;
  }

  // Vérifier que le fingerprint correspond
  const fingerprint = certificate.fingerprint;
  return PINNED_CERTIFICATES.some(pinned =>
    fingerprint.toLowerCase().replace(/:/g, '') === pinned.toLowerCase().replace(/:/g, '')
  );
}

// ============================================================
// CLIENT API
// ============================================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Effectue une requête HTTP avec Electron net (plus sécurisé que node fetch)
   */
  private async request(options: RequestOptions): Promise<ApiResponse> {
    const { method, path, body, authenticated = false, timeout = REQUEST_TIMEOUT } = options;

    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      console.log('[API] Request:', method, url);
      console.log('[API] Body:', JSON.stringify(body, null, 2));

      const request = net.request({
        method,
        url,
      });

      // Headers
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Accept', 'application/json');
      request.setHeader('User-Agent', 'GestionStock/1.0');

      // Ajouter le token d'authentification si nécessaire
      if (authenticated) {
        const token = getAccessToken();
        if (token) {
          request.setHeader('Authorization', `Bearer ${token}`);
        }
      }

      // Timeout
      const timeoutId = setTimeout(() => {
        request.abort();
        reject(new Error('Timeout de la requête'));
      }, timeout);

      // Réponse
      let responseData = '';

      request.on('response', (response) => {
        console.log('[API] Response status:', response.statusCode);
        console.log('[API] Response headers:', JSON.stringify(response.headers, null, 2));

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          clearTimeout(timeoutId);

          console.log('[API] Response data:', responseData);

          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            console.error('[API] JSON parse error:', error);
            console.error('[API] Raw response:', responseData);
            reject(new Error('Réponse invalide du serveur'));
          }
        });

        response.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      // Envoyer le body si présent
      if (body) {
        request.write(JSON.stringify(body));
      }

      request.end();
    });
  }

  /**
   * Requête GET
   */
  async get(path: string, authenticated: boolean = false): Promise<ApiResponse> {
    return this.request({ method: 'GET', path, authenticated });
  }

  /**
   * Requête POST
   */
  async post(path: string, body: any, authenticated: boolean = false): Promise<ApiResponse> {
    return this.request({ method: 'POST', path, body, authenticated });
  }

  /**
   * Requête POST authentifiée avec retry automatique si token expiré
   */
  async postAuthenticated(path: string, body: any): Promise<ApiResponse> {
    try {
      const response = await this.post(path, body, true);

      // Si token expiré, tenter un refresh
      if (response.error === 'UNAUTHORIZED' || response.error === 'TOKEN_EXPIRED') {
        const newToken = await refreshAccessToken();

        if (newToken) {
          // Réessayer avec le nouveau token
          return this.post(path, body, true);
        }
      }

      return response;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Requête GET authentifiée avec retry automatique
   */
  async getAuthenticated(path: string): Promise<ApiResponse> {
    try {
      const response = await this.get(path, true);

      if (response.error === 'UNAUTHORIZED' || response.error === 'TOKEN_EXPIRED') {
        const newToken = await refreshAccessToken();

        if (newToken) {
          return this.get(path, true);
        }
      }

      return response;
    } catch (error: any) {
      throw error;
    }
  }

  // ============================================================
  // MÉTHODES API MÉTIER
  // ============================================================

  /**
   * Crée une vente côté serveur (fonctionnalité protégée)
   */
  async createSale(saleData: any): Promise<ApiResponse> {
    return this.postAuthenticated('/apiCreateSale', saleData);
  }

  /**
   * Récupère les ventes depuis le serveur
   */
  async getSales(params?: { limit?: number; startDate?: string; endDate?: string }): Promise<ApiResponse> {
    let path = '/apiGetSales';
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (queryParams.toString()) {
        path += `?${queryParams.toString()}`;
      }
    }
    return this.getAuthenticated(path);
  }

  /**
   * Synchronise les données avec le serveur
   */
  async syncData(syncRequest: any): Promise<ApiResponse> {
    return this.postAuthenticated('/apiSync', syncRequest);
  }

  /**
   * Récupère toutes les données depuis le serveur
   */
  async getFullData(): Promise<ApiResponse> {
    return this.getAuthenticated('/apiGetData');
  }

  /**
   * Exporte les données (fonctionnalité protégée)
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<ApiResponse> {
    return this.getAuthenticated(`/apiExport?format=${format}`);
  }
}

// ============================================================
// INSTANCE SINGLETON
// ============================================================

export const apiClient = new ApiClient(API_BASE_URL);

// ============================================================
// VÉRIFICATION CONNEXION
// ============================================================

/**
 * Vérifie si une connexion internet est disponible
 */
export async function checkInternetConnection(): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      const request = net.request({
        method: 'HEAD',
        url: 'https://www.google.com',
      });

      const timeout = setTimeout(() => {
        request.abort();
        resolve(false);
      }, 5000);

      request.on('response', () => {
        clearTimeout(timeout);
        resolve(true);
      });

      request.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      request.end();
    });
  } catch {
    return false;
  }
}
