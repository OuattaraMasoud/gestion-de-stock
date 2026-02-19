import React, { useEffect, useState, useRef } from "react";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Save,
  X,
  Printer,
  Globe,
  CreditCard,
  ImagePlus,
} from "lucide-react";
import { Configuration } from "../types";
import { showErrorToast, showSuccessToast } from "../utils/toast";
import ProtectedRoute from "../components/ProtectedRoute";

const Settings: React.FC = () => {
  const [config, setConfig] = useState<Configuration>({
    nom_entreprise: "Mon Entreprise",
    description_entreprise: "",
    logo_url: "",
    adresse: "",
    telephone: "",
    telephone2: "",
    email: "",
    nif: "",
    ville: "",
    pays: "",
    devise: "FCFA",
    message_pied: "Merci de votre visite !",
    support_text: "",
    format_facture: "80mm",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
      // Charger le logo
      const logo = await window.electronAPI.getCompanyLogo();
      setLogoPreview(logo);
    } catch (error) {
      showErrorToast("Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await window.electronAPI.updateConfiguration(config);
      showSuccessToast("Configuration sauvegardée avec succès");
    } catch (error) {
      showErrorToast("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Configurez les informations de votre entreprise et les factures
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card shadow-lg">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Informations de l'entreprise
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={config.nom_entreprise}
                    onChange={(e) =>
                      setConfig({ ...config, nom_entreprise: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description de l'entreprise
                  </label>
                  <input
                    type="text"
                    value={config.description_entreprise}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        description_entreprise: e.target.value,
                      })
                    }
                    placeholder="Ex: Électroménager - Informatique - Électronique"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Adresse
                  </label>
                  <textarea
                    value={config.adresse}
                    onChange={(e) =>
                      setConfig({ ...config, adresse: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Ville
                    </label>
                    <input
                      type="text"
                      value={config.ville}
                      onChange={(e) =>
                        setConfig({ ...config, ville: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Pays
                    </label>
                    <input
                      type="text"
                      value={config.pays}
                      onChange={(e) =>
                        setConfig({ ...config, pays: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    Téléphone principal
                  </label>
                  <input
                    type="text"
                    value={config.telephone}
                    onChange={(e) =>
                      setConfig({ ...config, telephone: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    Téléphone secondaire
                  </label>
                  <input
                    type="text"
                    value={config.telephone2}
                    onChange={(e) =>
                      setConfig({ ...config, telephone2: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) =>
                      setConfig({ ...config, email: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    NIF (Numéro d'Identification Fiscale)
                  </label>
                  <input
                    type="text"
                    value={config.nif}
                    onChange={(e) =>
                      setConfig({ ...config, nif: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-blue-600" />
                    Logo de l'entreprise
                  </label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-20 h-20 object-contain rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await window.electronAPI.deleteCompanyLogo();
                              setLogoPreview(null);
                              setConfig({ ...config, logo_url: "" });
                              showSuccessToast("Logo supprimé");
                            } catch {
                              showErrorToast(
                                "Erreur lors de la suppression du logo",
                              );
                            }
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          title="Supprimer le logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                        <ImagePlus className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {uploadingLogo
                          ? "Chargement..."
                          : logoPreview
                            ? "Changer le logo"
                            : "Choisir un logo"}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        PNG, JPG. Max 2 Mo
                      </p>
                    </div>
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (file.size > 2 * 1024 * 1024) {
                          showErrorToast(
                            "Le fichier est trop volumineux (max 2 Mo)",
                          );
                          return;
                        }

                        setUploadingLogo(true);
                        try {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64 = reader.result as string;
                            try {
                              const filename =
                                await window.electronAPI.saveCompanyLogo(
                                  base64,
                                );
                              setConfig({ ...config, logo_url: filename });
                              setLogoPreview(base64);
                              showSuccessToast("Logo enregistré avec succès");
                            } catch {
                              showErrorToast(
                                "Erreur lors de l'enregistrement du logo",
                              );
                            } finally {
                              setUploadingLogo(false);
                            }
                          };
                          reader.readAsDataURL(file);
                        } catch {
                          showErrorToast(
                            "Erreur lors de la lecture du fichier",
                          );
                          setUploadingLogo(false);
                        }

                        if (logoInputRef.current) {
                          logoInputRef.current.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card shadow-lg">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
                <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Paramètres de facturation
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Devise
                  </label>
                  <input
                    type="text"
                    value={config.devise}
                    onChange={(e) =>
                      setConfig({ ...config, devise: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Format de facture
                  </label>
                  <select
                    value={config.format_facture}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        format_facture: e.target.value as "80mm" | "A4",
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                  >
                    <option value="80mm">Ticket (80mm)</option>
                    <option value="A4">A4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Message de pied de page
                  </label>
                  <textarea
                    value={config.message_pied}
                    onChange={(e) =>
                      setConfig({ ...config, message_pied: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Informations de support
                  </label>
                  <textarea
                    value={config.support_text}
                    onChange={(e) =>
                      setConfig({ ...config, support_text: e.target.value })
                    }
                    rows={3}
                    placeholder="Ex: TechHelp: +226 55 00 95 05"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all outline-none resize-none"
                  />
                </div>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-gray-100 dark:border-gray-700">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    Aperçu des modifications
                  </p>
                  <div className="space-y-2 text-sm text-blue-700">
                    <p>
                      <strong>Nom:</strong> {config.nom_entreprise}
                    </p>
                    <p>
                      <strong>Devise:</strong> {config.devise}
                    </p>
                    <p>
                      <strong>Format:</strong> {config.format_facture}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={loadConfig}
              disabled={saving}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
};

export default Settings;
