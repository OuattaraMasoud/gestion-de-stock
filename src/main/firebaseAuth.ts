import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInAnonymously, User } from 'firebase/auth';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  databaseURL: string;
  boutiqueId: string;
  boutiqueNom: string;
  boutiqueVille: string;
}

let authInstance: any = null;
let currentUser: User | null = null;

export function initializeFirebaseClient(config: FirebaseConfig) {
  if (getApps().length === 0) {
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId,
      databaseURL: config.databaseURL,
    };

    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    console.log('✓ Firebase Client initialisé');
  }

  return authInstance;
}

export async function authenticateFirebaseUser(email: string, password: string): Promise<string | null> {
  if (!authInstance) {
    console.error('Firebase Auth non initialisé');
    return null;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
    currentUser = userCredential.user;
    const token = await currentUser.getIdToken();
    console.log('✓ Utilisateur authentifié:', email);
    return token;
  } catch (error: any) {
    console.error('Erreur authentification:', error.message);

    try {
      const userCredential = await signInAnonymously(authInstance);
      currentUser = userCredential.user;
      const token = await currentUser.getIdToken();
      console.log('✓ Utilisateur anonyme authentifié');
      return token;
    } catch (anonError) {
      console.error('Erreur authentification anonyme:', anonError);
      return null;
    }
  }
}

export async function getCurrentAuthToken(): Promise<string | null> {
  if (currentUser) {
    try {
      return await currentUser.getIdToken();
    } catch (error) {
      console.error('Erreur récupération token:', error);
      return null;
    }
  }
  return null;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function isUserAuthenticated(): boolean {
  return currentUser !== null;
}
