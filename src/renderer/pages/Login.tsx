import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, LogIn, AlertCircle } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { getDefaultRoute } from "../utils/permissions";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appInfo, setAppInfo] = useState<{
    version: string;
    buildNumber: string;
    buildDate: string;
  } | null>(null);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Charger les infos de l'application au chargement
  React.useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const info = await window.electronAPI.getAppInfo();
        setAppInfo(info);
      } catch (error) {
        console.error("Erreur chargement app info:", error);
      }
    };
    loadAppInfo();
  }, []);

  // Vérifier si l'API Electron est disponible au chargement
  React.useEffect(() => {
    console.log("window.electronAPI:", window.electronAPI);
    if (!window.electronAPI) {
      setError(
        "API Electron non disponible. Veuillez redémarrer l'application.",
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user) {
        // Rediriger vers la route par défaut selon le rôle de l'utilisateur
        const defaultRoute = getDefaultRoute(user);
        navigate(defaultRoute);
      } else {
        setError("Email ou mot de passe incorrect");
      }
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 rounded-full mb-4 shadow-lg">
            <Package className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">SynkaPOS</h1>
          <p className="text-blue-200">Connectez-vous pour continuer</p>
        </div>

        {/* Formulaire de connexion */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="admin@stock.com"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-lg justify-center disabled:opacity-50"
            >
              {loading ? (
                "Connexion..."
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Info compte de test */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
              Compte de test :
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> admin@example.com
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Mot de passe:</strong> admin123
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-sm mt-6">
          © {new Date().getFullYear()} SynkaPOS -{" "}
          {appInfo
            ? `Version ${appInfo.version}`
            : "Chargement..."}
        </p>
      </div>
    </div>
  );
};

export default Login;
