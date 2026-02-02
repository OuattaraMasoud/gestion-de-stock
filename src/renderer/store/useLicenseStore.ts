import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LicenseInfo {
  licenseKey: string;
  boutiqueId: string;
  type: "trial" | "perpetual" | "subscription";
  expiresAt: string | null;
  features: string[];
  customerName: string;
  isGracePeriod: boolean;
  daysRemaining?: number;
  graceDaysRemaining?: number;
}

export interface LicenseState {
  // État
  isValidated: boolean;
  isActivated: boolean;
  isOnline: boolean;
  isChecking: boolean;
  license: LicenseInfo | null;
  error: string | null;
  errorCode: string | null;

  // Actions
  setLicenseStatus: (status: {
    isValidated: boolean;
    isActivated: boolean;
    isOnline: boolean;
    isGracePeriod?: boolean;
    license?: LicenseInfo | null;
    error?: string | null;
    errorCode?: string | null;
    daysRemaining?: number;
    graceDaysRemaining?: number;
  }) => void;
  setChecking: (isChecking: boolean) => void;
  clearLicense: () => void;
  checkLicense: () => Promise<void>;
  activateLicense: (
    licenseKey: string
  ) => Promise<{ success: boolean; error?: string }>;
  deactivateLicense: () => Promise<{ success: boolean; error?: string }>;
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      // État initial
      isValidated: false,
      isActivated: false,
      isOnline: false,
      isChecking: false,
      license: null,
      error: null,
      errorCode: null,

      // Définir le statut de licence
      setLicenseStatus: (status) => {
        set({
          isValidated: status.isValidated,
          isActivated: status.isActivated,
          isOnline: status.isOnline,
          license: status.license
            ? {
                ...status.license,
                isGracePeriod: status.isGracePeriod || false,
                daysRemaining: status.daysRemaining,
                graceDaysRemaining: status.graceDaysRemaining,
              }
            : null,
          error: status.error || null,
          errorCode: status.errorCode || null,
        });
      },

      // Définir l'état de vérification
      setChecking: (isChecking) => set({ isChecking }),

      // Effacer la licence
      clearLicense: () =>
        set({
          isValidated: false,
          isActivated: false,
          isOnline: false,
          license: null,
          error: null,
          errorCode: null,
        }),

      // Vérifier la licence via IPC
      checkLicense: async () => {
        set({ isChecking: true });

        try {
          const result = await window.electronAPI.validateLicense();

          set({
            isChecking: false,
            isValidated: result.isValid,
            isActivated: result.isActivated,
            isOnline: result.isOnline,
            license: result.license
              ? {
                  licenseKey: result.license.licenseKey,
                  boutiqueId: result.license.boutiqueId,
                  type: result.license.type,
                  expiresAt: result.license.expiresAt,
                  features: result.license.features,
                  customerName: result.license.customerName,
                  isGracePeriod: result.isGracePeriod,
                  daysRemaining: result.daysRemaining,
                  graceDaysRemaining: result.graceDaysRemaining,
                }
              : null,
            error: result.error || null,
            errorCode: result.errorCode || null,
          });
        } catch (error: any) {
          set({
            isChecking: false,
            isValidated: false,
            error: error.message || "Erreur de vérification",
          });
        }
      },

      // Activer une licence
      activateLicense: async (licenseKey: string) => {
        set({ isChecking: true, error: null });

        try {
          const result = await window.electronAPI.activateLicense(licenseKey);

          if (result.success && result.license) {
            set({
              isChecking: false,
              isValidated: true,
              isActivated: true,
              isOnline: true,
              license: {
                licenseKey: result.license.licenseKey,
                boutiqueId: result.license.boutiqueId,
                type: result.license.type,
                expiresAt: result.license.expiresAt,
                features: result.license.features,
                customerName: result.license.customerName,
                isGracePeriod: false,
              },
              error: null,
              errorCode: null,
            });
            return { success: true };
          }

          set({
            isChecking: false,
            error: result.error || "Erreur d'activation",
            errorCode: result.errorCode,
          });
          return { success: false, error: result.error };
        } catch (error: any) {
          set({
            isChecking: false,
            error: error.message || "Erreur d'activation",
          });
          return { success: false, error: error.message };
        }
      },

      // Désactiver la licence
      deactivateLicense: async () => {
        try {
          const result = await window.electronAPI.deactivateLicense();

          if (result.success) {
            set({
              isValidated: false,
              isActivated: false,
              license: null,
              error: null,
              errorCode: null,
            });
          }

          return result;
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    }),
    {
      name: "license-storage",
      partialize: (state) => ({
        // Ne persister que les infos essentielles (pas les tokens)
        isActivated: state.isActivated,
        license: state.license
          ? {
              licenseKey: state.license.licenseKey,
              boutiqueId: state.license.boutiqueId,
              type: state.license.type,
              customerName: state.license.customerName,
            }
          : null,
      }),
    }
  )
);

// ============================================================
// SÉLECTEURS UTILES
// ============================================================

export const selectIsLicenseValid = (state: LicenseState) => state.isValidated;
export const selectLicenseType = (state: LicenseState) => state.license?.type;
export const selectIsGracePeriod = (state: LicenseState) =>
  state.license?.isGracePeriod;
export const selectDaysRemaining = (state: LicenseState) =>
  state.license?.isGracePeriod
    ? state.license.graceDaysRemaining
    : state.license?.daysRemaining;

/**
 * Vérifie si une fonctionnalité est disponible
 */
export const hasFeature = (state: LicenseState, feature: string): boolean => {
  if (!state.license) return false;
  return (
    state.license.features.includes("*") ||
    state.license.features.includes(feature)
  );
};
