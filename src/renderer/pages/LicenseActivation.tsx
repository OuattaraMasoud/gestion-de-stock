import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  AlertCircle,
  CheckCircle,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useLicenseStore } from "../store/useLicenseStore";
import { showSuccessToast, showErrorToast } from "../utils/toast";

export default function LicenseActivation() {
  const navigate = useNavigate();
  const {
    isValidated,
    isActivated,
    isChecking,
    error,
    errorCode,
    license,
    activateLicense,
  } = useLicenseStore();

  const [licenseKey, setLicenseKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Vérifier la connexion internet
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const online = await window.electronAPI.checkInternet();
        setIsOnline(online);
      } catch {
        setIsOnline(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Rediriger si licence valide
  useEffect(() => {
    if (isValidated && !isChecking) {
      navigate("/login");
    }
  }, [isValidated, isChecking, navigate]);

  // Formater la clé de licence (XXXX-XXXX-XXXX-XXXX)
  const formatLicenseKey = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join("-");
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
  };

  const handleActivate = async () => {
    if (!licenseKey || licenseKey.replace(/-/g, "").length !== 16) {
      showErrorToast("Veuillez entrer une clé de licence valide");
      return;
    }

    if (!isOnline) {
      showErrorToast("Connexion internet requise pour l'activation");
      return;
    }

    setIsActivating(true);

    try {
      const result = await activateLicense(licenseKey);

      if (result.success) {
        showSuccessToast("Licence activée avec succès !");
        navigate("/login");
      } else {
        const errorMessage = getErrorMessage(result.error || "");
        showErrorToast(errorMessage);
      }
    } catch (err: any) {
      showErrorToast(err.message || "Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    const messages: Record<string, string> = {
      INVALID_LICENSE_KEY: "Clé de licence invalide",
      LICENSE_EXPIRED: "Cette licence a expiré",
      LICENSE_INACTIVE: "Cette licence a été désactivée",
      MAX_ACTIVATIONS_REACHED: "Nombre maximum d'activations atteint",
      MACHINE_HAS_LICENSE: "Cette machine a déjà une licence active",
      NETWORK_ERROR: "Erreur de connexion au serveur",
      SERVER_ERROR: "Erreur serveur, veuillez réessayer",
    };
    return messages[errorCode] || errorCode || "Erreur inconnue";
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Activation de la licence
          </h1>
          <p className="text-gray-500 mt-2">
            Entrez votre clé de licence pour activer l'application
          </p>
        </div>

        {/* Statut connexion */}
        <div
          className={`flex items-center justify-center gap-2 mb-6 p-2 rounded-lg ${
            isOnline ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="text-sm">Connecté</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">Hors ligne - Connexion requise</span>
            </>
          )}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">Erreur d'activation</p>
                <p className="text-red-600 text-sm mt-1">
                  {getErrorMessage(errorCode || error)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <div className="space-y-6">
          <div>
            <label
              htmlFor="licenseKey"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Clé de licence
            </label>
            <input
              type="text"
              id="licenseKey"
              value={licenseKey}
              onChange={handleKeyChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest font-mono uppercase"
              maxLength={19}
              disabled={isActivating}
            />
          </div>

          <button
            onClick={handleActivate}
            disabled={
              isActivating ||
              !isOnline ||
              licenseKey.replace(/-/g, "").length !== 16
            }
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isActivating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Activation en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Activer la licence
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            Besoin d'une licence ?{" "}
            <a
              href="mailto:masoud@ouattara.me"
              className="text-blue-600 hover:underline"
            >
              Contactez-nous
            </a>
          </p>
        </div>

        {/* Info licence existante (si activée mais expirée) */}
        {isActivated && !isValidated && license && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Licence précédente :</strong> {license.customerName}
              <br />
              <span className="text-yellow-600">
                {errorCode === "GRACE_PERIOD_EXPIRED"
                  ? "Période de grâce expirée. Veuillez vous connecter à internet."
                  : "Licence expirée ou révoquée."}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
