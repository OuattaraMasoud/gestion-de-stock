import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          if (!window.electronAPI) {
            console.error('electronAPI is not available. Preload script may not be loaded.');
            alert('Erreur: L\'API Electron n\'est pas disponible. Veuillez redémarrer l\'application.');
            return null;
          }
          const user = await window.electronAPI.login(email, password);
          if (user) {
            set({ user, isAuthenticated: true });
            return user;
          }
          return null;
        } catch (error) {
          console.error('Erreur login:', error);
          return null;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
