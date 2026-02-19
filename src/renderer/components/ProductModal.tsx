import React, { useState, useEffect } from "react";
import { X, Upload, Image as ImageIcon, XCircle } from "lucide-react";
import { Product, Category } from "../types";
import { showAddToast, showUpdateToast, showErrorToast } from "../utils/toast";
import { useAuthStore } from "../store/useAuthStore";

interface ProductModalProps {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
}

const ProductModal: React.FC<ProductModalProps> = ({
  product,
  categories,
  onClose,
}) => {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<Product>({
    nom: "",
    description: "",
    code_barre: "",
    prix_achat: 0,
    prix_vente: 0,
    quantite_stock: 0,
    stock_min: 5,
    sans_stock: false,
    categorie_id: undefined,
    image_url: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData(product);
      if (product.image_url) {
        loadProductImage(product.image_url);
      }
    }
  }, [product]);

  const loadProductImage = async (filename: string) => {
    try {
      const base64 = await window.electronAPI.getProductImage(filename);
      setImagePreview(base64);
    } catch (error) {
      console.error("Erreur chargement image:", error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "prix_achat" ||
        name === "prix_vente" ||
        name === "quantite_stock" ||
        name === "stock_min" ||
        name === "categorie_id"
          ? Number(value)
          : value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showErrorToast("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setUploadingImage(true);
        const base64Data = reader.result as string;
        const filename = await window.electronAPI.saveProductImage(base64Data);
        setFormData((prev) => ({ ...prev, image_url: filename }));
        loadProductImage(filename);
      } catch (error) {
        console.error("Erreur upload image:", error);
        showErrorToast("Erreur lors de l'upload de l'image");
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: undefined }));
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...formData,
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
      };

      if (product?.id) {
        await window.electronAPI.updateProduct(product.id, productData);
        showUpdateToast(`Produit "${formData.nom}"`);
      } else {
        await window.electronAPI.createProduct(productData);
        showAddToast(`Produit "${formData.nom}"`);
      }
      onClose();
    } catch (error) {
      console.error("Erreur sauvegarde produit:", error);
      showErrorToast("Erreur lors de la sauvegarde du produit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {product ? "Modifier le produit" : "Nouveau produit"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image du produit
              </label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Aperçu du produit"
                      className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Pas d'image</span>
                  </div>
                )}
                <div className="flex-1">
                  <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? "Chargement..." : "Charger une image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    JPG, PNG jusqu'à 5 Mo
                  </p>
                </div>
              </div>
            </div>

            {/* Nom */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nom du produit *
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Ex: Coca-Cola 1.5L"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="input-field resize-none"
                placeholder="Description du produit..."
              />
            </div>

            {/* Code-barre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Code-barre
              </label>
              <input
                type="text"
                name="code_barre"
                value={formData.code_barre}
                onChange={handleChange}
                className="input-field"
                placeholder="Ex: 5449000000996"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Catégorie
              </label>
              <select
                name="categorie_id"
                value={formData.categorie_id || ""}
                onChange={handleChange}
                className="input-field"
              >
                <option value="">Sans catégorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Prix d'achat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prix d'achat (FCFA) *
              </label>
              <input
                type="number"
                name="prix_achat"
                value={formData.prix_achat}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                className="input-field"
                placeholder="0.00"
              />
            </div>

            {/* Prix de vente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prix de vente (FCFA) *
              </label>
              <input
                type="number"
                name="prix_vente"
                value={formData.prix_vente}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                className="input-field"
                placeholder="0.00"
              />
            </div>

            {/* Option sans suivi de stock */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.sans_stock || false}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sans_stock: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Produit sans suivi de stock
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pour les services, frais, ou articles qui figurent sur la facture sans gestion de stock
                  </p>
                </div>
              </label>
            </div>

            {/* Quantité en stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantité en stock {formData.sans_stock ? "" : "*"}
              </label>
              <input
                type="number"
                name="quantite_stock"
                value={formData.quantite_stock}
                onChange={handleChange}
                min="0"
                required={!formData.sans_stock}
                disabled={formData.sans_stock}
                className="input-field disabled:bg-gray-100 disabled:dark:bg-gray-700 disabled:cursor-not-allowed"
                placeholder={formData.sans_stock ? "Non applicable" : "0"}
              />
            </div>

            {/* Stock minimum */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock minimum {formData.sans_stock ? "" : "*"}
              </label>
              <input
                type="number"
                name="stock_min"
                value={formData.stock_min}
                onChange={handleChange}
                min="0"
                required={!formData.sans_stock}
                disabled={formData.sans_stock}
                className="input-field disabled:bg-gray-100 disabled:dark:bg-gray-700 disabled:cursor-not-allowed"
                placeholder={formData.sans_stock ? "Non applicable" : "5"}
              />
            </div>
          </div>

          {/* Marge bénéficiaire */}
          {formData.prix_achat > 0 && formData.prix_vente > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Marge bénéficiaire:</strong>{" "}
                {(
                  Number(formData.prix_vente || 0) -
                  Number(formData.prix_achat || 0)
                ).toFixed(2)}{" "}
                FCFA (
                {(
                  ((Number(formData.prix_vente || 0) -
                    Number(formData.prix_achat || 0)) /
                    Number(formData.prix_achat || 1)) *
                  100
                ).toFixed(2)}
                %)
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
