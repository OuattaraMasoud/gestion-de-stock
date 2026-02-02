import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useContext,
} from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  Check,
  Package,
  X,
  Zap,
  Keyboard,
  Printer,
  Receipt,
  User,
} from "lucide-react";
import { Product, Sale, Server, Configuration } from "../types";
import { useStore } from "../store/useStore";
import { useAuthStore } from "../store/useAuthStore";
import { SidebarContext } from "../components/Layout";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { showSaleToast, showErrorToast } from "../utils/toast";

// Interface pour le ticket
interface ReceiptData {
  numero: string;
  date: string;
  heure: string;
  caissier: string;
  serveur?: string;
  client_nom?: string;
  articles: Array<{
    designation: string;
    quantite: number;
    prixUnitaire: number;
    total: number;
  }>;
  totalTTC: number;
  methodePaiement: string;
  montantPaye: number;
  monnaieRendue: number;
  remiseType?: "pourcentage" | "montant";
  remiseValeur?: number;
  totalAvantRemise?: number;
}

// Composant de prévisualisation du ticket 80mm
const ReceiptPreview: React.FC<{
  receipt: ReceiptData;
  onClose: () => void;
  onPrint: () => void;
  config: Configuration | null;
}> = ({ receipt, onClose, onPrint, config }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Ticket - ${receipt.numero}</title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }

                @page {
                  size: 80mm auto;
                  margin: 2mm;
                }

                body {
                  font-family: 'Courier New', 'Lucida Console', monospace;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #000;
                  background: white;
                  width: 76mm;
                  margin: 0 auto;
                }

                .ticket {
                  width: 76mm;
                  padding: 2mm;
                  background: white;
                }

                .ticket-header {
                  text-align: center;
                  padding-bottom: 3mm;
                  border-bottom: 1px dashed #000;
                  margin-bottom: 3mm;
                }

                .ticket-header h1 {
                  font-size: 14px;
                  font-weight: bold;
                  margin-bottom: 2mm;
                  text-transform: uppercase;
                }

                .ticket-header p {
                  font-size: 10px;
                  margin: 1mm 0;
                }

                .ticket-title {
                  text-align: center;
                  font-size: 16px;
                  font-weight: bold;
                  margin: 3mm 0;
                  padding: 2mm 0;
                  border-top: 1px dashed #000;
                  border-bottom: 1px dashed #000;
                }

                .ticket-info {
                  margin-bottom: 3mm;
                  padding-bottom: 3mm;
                  border-bottom: 1px dashed #000;
                }

                .ticket-info-row {
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  margin: 1mm 0;
                }

                .ticket-articles {
                  margin-bottom: 3mm;
                  padding-bottom: 3mm;
                  border-bottom: 1px dashed #000;
                }

                .ticket-article {
                  margin: 2mm 0;
                  font-size: 11px;
                }

                .ticket-article-name {
                  font-weight: bold;
                }

                .ticket-article-details {
                  display: flex;
                  justify-content: space-between;
                  padding-left: 2mm;
                  font-size: 10px;
                }

                .ticket-totals {
                  margin-bottom: 3mm;
                  padding-bottom: 3mm;
                  border-bottom: 1px dashed #000;
                }

                .ticket-total-row {
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  margin: 1mm 0;
                }

                .ticket-total-row.grand-total {
                  font-size: 14px;
                  font-weight: bold;
                  margin-top: 2mm;
                  padding-top: 2mm;
                  border-top: 1px solid #000;
                }

                .ticket-total-row.discount {
                  color: #059669;
                }

                .ticket-payment {
                  margin-bottom: 3mm;
                  padding-bottom: 3mm;
                  border-bottom: 1px dashed #000;
                }

                .ticket-payment-row {
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  margin: 1mm 0;
                }

                .ticket-payment-row.change {
                  font-weight: bold;
                  font-size: 12px;
                }

                .ticket-footer {
                  text-align: center;
                  padding-top: 3mm;
                }

                .ticket-footer p {
                  font-size: 10px;
                  margin: 1mm 0;
                }

                .ticket-footer .thank-you {
                  font-size: 12px;
                  font-weight: bold;
                  margin-bottom: 2mm;
                }

                .ticket-footer .ticket-ref {
                  font-size: 9px;
                  margin-top: 3mm;
                  padding-top: 2mm;
                  border-top: 1px dashed #000;
                }

                @media print {
                  body {
                    width: 76mm;
                  }
                  .ticket {
                    width: 76mm;
                  }
                }
              </style>
            </head>
            <body>
              <div class="ticket">
                <div class="ticket-header">
                  <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                  ${config?.telephone ? `<p>Tel: ${config.telephone}</p>` : ""}
                  ${config?.telephone2 ? `<p>${config.telephone2}</p>` : ""}
                  ${config?.adresse ? `<p>${config.adresse}</p>` : ""}
                </div>
                ${receiptRef.current.innerHTML}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  }, 500);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        onPrint();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[95vh] flex flex-col animate-scaleIn">
        {/* En-tete du modal */}
        <div className="relative bg-blue-600 text-white px-8 py-5 rounded-t-2xl shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Ticket de caisse</h2>
              <p className="text-white/80 text-sm">
                Apercu avant impression - Format 80mm
              </p>
            </div>
          </div>
        </div>

        {/* Contenu du ticket - Format 80mm */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex justify-center">
          <div
            ref={receiptRef}
            className="ticket bg-white shadow-xl"
            style={{
              width: "80mm",
              padding: "3mm",
              fontFamily: "'Courier New', 'Lucida Console', monospace",
              fontSize: "12px",
              lineHeight: "1.4",
              color: "#000",
            }}
          >
            {/* En-tete du ticket */}
            <div
              style={{
                textAlign: "center",
                paddingBottom: "3mm",
                borderBottom: "1px dashed #000",
                marginBottom: "3mm",
              }}
            >
              <h1
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "2mm",
                  textTransform: "uppercase",
                }}
              >
                {config?.nom_entreprise || "Mon Entreprise"}
              </h1>
              {config?.telephone && (
                <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                  Tel: {config.telephone}
                </p>
              )}
              {config?.telephone2 && (
                <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                  {config.telephone2}
                </p>
              )}
              {config?.adresse && (
                <p style={{ fontSize: "10px", margin: "1mm 0" }}>
                  {config.adresse}
                </p>
              )}
            </div>

            {/* Titre TICKET */}
            <div
              style={{
                textAlign: "center",
                fontSize: "16px",
                fontWeight: "bold",
                margin: "3mm 0",
                padding: "2mm 0",
              }}
            >
              TICKET N° {receipt.numero}
            </div>

            {/* Informations */}
            <div
              style={{
                marginBottom: "3mm",
                paddingBottom: "3mm",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  margin: "1mm 0",
                }}
              >
                <span>Date:</span>
                <span>{receipt.date}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  margin: "1mm 0",
                }}
              >
                <span>Heure:</span>
                <span>{receipt.heure}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  margin: "1mm 0",
                }}
              >
                <span>Caissier:</span>
                <span>{receipt.caissier}</span>
              </div>
              {receipt.serveur && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    margin: "1mm 0",
                  }}
                >
                  <span>Serveur:</span>
                  <span>{receipt.serveur}</span>
                </div>
              )}
              {receipt.client_nom && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    margin: "1mm 0",
                  }}
                >
                  <span>Client:</span>
                  <span>{receipt.client_nom}</span>
                </div>
              )}
            </div>

            {/* Articles */}
            <div
              style={{
                marginBottom: "3mm",
                paddingBottom: "3mm",
              }}
            >
              {receipt.articles.map((article, index) => (
                <div key={index} style={{ margin: "2mm 0" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {article.designation}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingLeft: "2mm",
                      fontSize: "10px",
                    }}
                  >
                    <span>
                      {article.quantite} x{" "}
                      {formatCurrency(article.prixUnitaire)}
                    </span>
                    <span style={{ fontWeight: "bold" }}>
                      {formatCurrency(article.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totaux */}
            <div
              style={{
                marginBottom: "3mm",
                paddingBottom: "3mm",
                borderBottom: "1px dashed #000",
              }}
            >
              {/* Sous-total si remise */}
              {receipt.remiseValeur && receipt.remiseValeur > 0 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      marginTop: "2mm",
                      paddingTop: "2mm",
                      borderTop: "1px solid #000",
                    }}
                  >
                    <span>Sous-total:</span>
                    <span>{formatCurrency(receipt.totalAvantRemise || 0)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      margin: "1mm 0",
                      color: "#059669",
                    }}
                  >
                    <span>
                      Remise (
                      {receipt.remiseType === "pourcentage"
                        ? `${receipt.remiseValeur}%`
                        : "fixe"}
                      ):
                    </span>
                    <span>
                      -
                      {formatCurrency(
                        receipt.remiseType === "pourcentage"
                          ? ((receipt.totalAvantRemise || 0) *
                              receipt.remiseValeur) /
                              100
                          : receipt.remiseValeur,
                      )}
                    </span>
                  </div>
                </>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginTop:
                    receipt.remiseValeur && receipt.remiseValeur > 0
                      ? "1mm"
                      : "2mm",
                  paddingTop:
                    receipt.remiseValeur && receipt.remiseValeur > 0
                      ? "1mm"
                      : "2mm",
                  borderTop:
                    receipt.remiseValeur && receipt.remiseValeur > 0
                      ? "none"
                      : "1px solid #000",
                }}
              >
                <span>TOTAL:</span>
                <span>{formatCurrency(receipt.totalTTC)}</span>
              </div>
            </div>

            {/* Paiement */}
            <div
              style={{
                marginBottom: "3mm",
                paddingBottom: "3mm",
                borderBottom: "1px dashed #000",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  margin: "1mm 0",
                }}
              >
                <span>Mode:</span>
                <span>{receipt.methodePaiement}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  margin: "1mm 0",
                }}
              >
                <span>Recu:</span>
                <span>{formatCurrency(receipt.montantPaye)}</span>
              </div>
              {receipt.monnaieRendue > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    fontWeight: "bold",
                    margin: "1mm 0",
                  }}
                >
                  <span>Monnaie:</span>
                  <span>{formatCurrency(receipt.monnaieRendue)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", paddingTop: "3mm" }}>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "2mm",
                }}
              >
                {config?.message_pied}
              </p>

              <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                --------------------------------
              </p>
              {config?.support_text && (
                <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                  {config.support_text}
                </p>
              )}
              {config?.nif && (
                <p style={{ fontSize: "9px", margin: "1mm 0" }}>
                  NIF: {config.nif}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="p-5 bg-gray-50 border-t border-gray-200 flex gap-4 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Imprimer le ticket
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant ProductCard mémorisé pour optimiser les rendus
const ProductCard = React.memo<{
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  imageCache: Map<number, string>;
}>(({ product, onAddToCart, onViewDetails, imageCache }) => {
  const isOutOfStock = product.quantite_stock === 0;
  const isAtAlertThreshold = product.quantite_stock <= product.stock_min;
  const isDisabled = isOutOfStock || isAtAlertThreshold;

  return (
    <div
      className={`group relative card text-left transition-all duration-300 transform ${
        isDisabled
          ? "opacity-50"
          : "hover:scale-105 hover:shadow-xl hover:border-blue-400 hover:-translate-y-1"
      }`}
    >
      {/* Badge seuil d'alerte atteint */}
      {!isOutOfStock && isAtAlertThreshold && (
        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-lg z-10 animate-pulse">
          !
        </div>
      )}

      {/* Badge rupture de stock */}
      {isOutOfStock && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-lg z-10">
          ✕
        </div>
      )}

      <div className="flex flex-col h-full">
        {/* Icône produit ou image - cliquable pour voir les détails */}
        <div
          onClick={() => onViewDetails(product)}
          className="mb-1 rounded p-1 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors overflow-hidden cursor-pointer"
        >
          {product.image_url && imageCache.get(product.id!) ? (
            <img
              src={imageCache.get(product.id!)}
              alt={product.nom}
              className="w-full h-15 object-contain rounded"
            />
          ) : (
            <Package className="w-5 h-5 text-blue-600 mx-auto" />
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-0.5 text-xs line-clamp-1 group-hover:text-blue-600 transition-colors">
          {product.nom}
        </h3>

        <div className="flex items-center gap-0.5 mb-1">
          <span className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded-full truncate">
            {product.categorie_nom || "Sans catégorie"}
          </span>
        </div>

        <div className="mt-auto pt-1 border-t border-gray-100">
          <p className="text-sm font-bold text-blue-600 mb-0.5">
            {formatCurrency(product.prix_vente || 0)}
          </p>
          <div className="flex items-center justify-between">
            <p
              className={`text-[10px] font-medium ${
                isOutOfStock
                  ? "text-red-600"
                  : isAtAlertThreshold
                    ? "text-orange-600"
                    : "text-green-600"
              }`}
            >
              stock: {product.quantite_stock}
            </p>
            {!isDisabled && (
              <button
                onClick={() => onAddToCart(product)}
                className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          {isAtAlertThreshold && !isOutOfStock && (
            <p className="text-[9px] text-orange-600 font-medium mt-0.5">
              Seuil: {product.stock_min}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = "ProductCard";

const PointOfSale: React.FC = () => {
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    getCartTotal,
  } = useStore();
  const { user } = useAuthStore();
  const sidebarContext = useContext(SidebarContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [montantPaye, setMontantPaye] = useState("");
  const [imageCache, setImageCache] = useState<Map<number, string>>(new Map());
  const [methodePaiement, setMethodePaiement] = useState<
    "especes" | "carte" | "mobile"
  >("especes");
  const [processing, setProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [clientName, setClientName] = useState("");
  const [config, setConfig] = useState<Configuration | null>(null);
  // États pour la remise
  const [remiseType, setRemiseType] = useState<"pourcentage" | "montant">(
    "pourcentage",
  );
  const [remiseValeur, setRemiseValeur] = useState<string>("");

  const handleViewProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
    setShowProductDetail(false);
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  const loadServers = async () => {
    try {
      const data = await window.electronAPI.getActiveServers();
      setServers(data);
    } catch (error) {
      console.error("Erreur chargement serveurs:", error);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
    } catch (error) {
      console.error("Erreur chargement configuration:", error);
    }
  };

  useEffect(() => {
    loadProducts();
    loadServers();
    loadConfig();
  }, [currentPage, itemsPerPage]);

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape pour fermer le modal
      if (e.key === "Escape" && showPayment) {
        setShowPayment(false);
        setMontantPaye("");
        return;
      }

      // F2 pour focus sur recherche
      if (e.key === "F2" && !showPayment) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F9 pour ouvrir le paiement
      if (e.key === "F9" && cart.length > 0 && !showPayment) {
        e.preventDefault();
        setShowPayment(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPayment, cart.length]);

  // Focus auto sur l'input de paiement
  useEffect(() => {
    if (showPayment && methodePaiement === "especes") {
      setTimeout(() => paymentInputRef.current?.focus(), 100);
    }
  }, [showPayment, methodePaiement]);

  const loadProducts = async () => {
    try {
      const result = await window.electronAPI.getProductsPaginated(
        currentPage,
        itemsPerPage,
        searchQuery || undefined,
      );
      setProducts(result.data);
      setTotalItems(result.total);

      // Charger les images pour les produits de la page actuelle seulement
      const cache = new Map<number, string>();
      for (const product of result.data) {
        if (product.image_url) {
          const imageBase64 = await window.electronAPI.getProductImage(
            product.image_url,
          );
          if (imageBase64) {
            cache.set(product.id!, imageBase64);
          }
        }
      }
      setImageCache(cache);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
  };

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      setCurrentPage(1);

      if (!query.trim()) {
        // Pas de recherche: charger la première page de tous les produits
        await loadProducts();
        return;
      }

      // Recherche FTS5 côté serveur (ultra-rapide)
      try {
        const results = await window.electronAPI.searchProductsFTS(
          query,
          itemsPerPage * 5,
        );
        setProducts(results);
        setTotalItems(results.length);
        setSearchQuery(query);

        // Charger les images pour les résultats de recherche
        const cache = new Map<number, string>();
        for (const product of results) {
          if (product.image_url) {
            const imageBase64 = await window.electronAPI.getProductImage(
              product.image_url,
            );
            if (imageBase64) {
              cache.set(product.id!, imageBase64);
            }
          }
        }
        setImageCache(cache);
      } catch (error) {
        console.error("Erreur recherche produits:", error);
      }
    },
    [itemsPerPage],
  );

  // Pagination calculée avec useMemo (maintenant basée sur products au lieu de searchResults)
  const { totalPages, paginatedProducts } = useMemo(() => {
    const pages = Math.ceil(totalItems / itemsPerPage);
    // Les produits sont déjà paginés par le serveur ou limités par la recherche FTS
    // Pour les résultats FTS, on fait une pagination locale
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = products.slice(startIndex, startIndex + itemsPerPage);
    return { totalPages: pages, paginatedProducts: paginated };
  }, [products, currentPage, itemsPerPage, totalItems]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  }, []);

  // Sous-total avant remise
  const sousTotal = useMemo(() => getCartTotal(), [cart]);

  // Calcul du montant de la remise
  const montantRemise = useMemo(() => {
    const valeur = parseFloat(remiseValeur) || 0;
    if (valeur <= 0) return 0;
    if (remiseType === "pourcentage") {
      return Math.min((sousTotal * valeur) / 100, sousTotal);
    }
    return Math.min(valeur, sousTotal);
  }, [sousTotal, remiseType, remiseValeur]);

  // Total après remise
  const total = useMemo(
    () => Math.max(0, sousTotal - montantRemise),
    [sousTotal, montantRemise],
  );

  const monnaieRendue = useMemo(
    () => (montantPaye ? Math.max(0, parseFloat(montantPaye) - total) : 0),
    [montantPaye, total],
  );

  // Suggestions de montants rapides
  const quickAmounts = useMemo(() => {
    const amounts = [total];
    const roundedUp = Math.ceil(total / 1000) * 1000;
    if (roundedUp > total) amounts.push(roundedUp);
    amounts.push(roundedUp + 1000, roundedUp + 5000);
    return [...new Set(amounts)].slice(0, 4);
  }, [total]);

  const handleQuickAmount = useCallback((amount: number) => {
    setMontantPaye(amount.toString());
  }, []);

  // Générer le numéro de ticket
  const generateReceiptNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `${year}${month}${day}-${random}`;
  };

  // Créer les données du ticket
  const createReceiptData = useCallback((): ReceiptData => {
    const now = new Date();

    return {
      numero: generateReceiptNumber(),
      date: now.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      heure: now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      caissier: user?.nom || "Caissier",
      serveur: selectedServer?.nom,
      client_nom: clientName || undefined,
      articles: cart.map((item) => ({
        designation: item.nom,
        quantite: item.quantity,
        prixUnitaire: item.prix_vente,
        total: item.prix_vente * item.quantity,
      })),
      totalTTC: total,
      methodePaiement:
        methodePaiement === "especes"
          ? "Espèces"
          : methodePaiement === "carte"
            ? "Carte bancaire"
            : "Mobile Money",
      montantPaye:
        methodePaiement === "especes" ? parseFloat(montantPaye) : total,
      monnaieRendue: methodePaiement === "especes" ? monnaieRendue : 0,
      // Informations de remise
      remiseType: montantRemise > 0 ? remiseType : undefined,
      remiseValeur: montantRemise > 0 ? parseFloat(remiseValeur) : undefined,
      totalAvantRemise: montantRemise > 0 ? sousTotal : undefined,
    };
  }, [
    cart,
    total,
    sousTotal,
    montantRemise,
    remiseType,
    remiseValeur,
    methodePaiement,
    montantPaye,
    monnaieRendue,
    user,
    selectedServer,
    clientName,
  ]);

  const handlePayment = useCallback(async () => {
    if (cart.length === 0) {
      showErrorToast("Le panier est vide");
      return;
    }

    const montant = parseFloat(montantPaye) || 0;
    if (methodePaiement === "especes" && montant < total) {
      showErrorToast("Le montant payé est insuffisant");
      return;
    }

    setProcessing(true);

    try {
      const saleData: Sale = {
        serveur_id: selectedServer?.id,
        client_nom: clientName || "Client comptoir",
        total,
        montant_paye: methodePaiement === "especes" ? montant : total,
        monnaie_rendue: methodePaiement === "especes" ? monnaieRendue : 0,
        methode_paiement: methodePaiement,
        montant_restant: 0,
        statut_paiement: "paye",
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
        // Informations de remise
        remise_type: montantRemise > 0 ? remiseType : undefined,
        remise_valeur: montantRemise > 0 ? parseFloat(remiseValeur) : undefined,
        total_avant_remise: montantRemise > 0 ? sousTotal : undefined,
        produits: cart.map((item) => ({
          produit_id: item.id!,
          nom_produit: item.nom,
          quantite: item.quantity,
          prix_unitaire: item.prix_vente,
          sous_total: item.prix_vente * item.quantity,
        })),
      };

      // Creer la vente et recuperer l'ID
      const saleResult = await window.electronAPI.createSale(saleData);

      // Creer et afficher la facture
      const receipt = createReceiptData();

      // Sauvegarder la facture liee a la vente
      const invoiceData = {
        numero: receipt.numero,
        vente_id: saleResult.id,
        date_facture: receipt.date,
        heure_facture: receipt.heure,
        vendeur: receipt.caissier,
        client_nom: clientName || "Client comptoir",
        serveur_nom: receipt.serveur,
        total_ttc: receipt.totalTTC,
        methode_paiement: receipt.methodePaiement,
        montant_paye: receipt.montantPaye,
        monnaie_rendue: receipt.monnaieRendue,
        // Informations de remise
        remise_type: receipt.remiseType,
        remise_valeur: receipt.remiseValeur,
        total_avant_remise: receipt.totalAvantRemise,
        articles: receipt.articles,
      };

      await window.electronAPI.createInvoice(invoiceData);

      setReceiptData(receipt);
      setShowReceipt(true);

      // Fermer le modal de paiement
      setShowPayment(false);
      setMontantPaye("");
      setMethodePaiement("especes");

      showSaleToast(total);
    } catch (error) {
      console.error("Erreur enregistrement vente:", error);
      showErrorToast("Erreur lors de l'enregistrement de la vente");
    } finally {
      setProcessing(false);
    }
  }, [
    cart,
    montantPaye,
    methodePaiement,
    total,
    sousTotal,
    montantRemise,
    remiseType,
    remiseValeur,
    monnaieRendue,
    selectedServer,
    clientName,
    user,
    createReceiptData,
  ]);

  const handleReceiptClose = useCallback(() => {
    setShowReceipt(false);
    setReceiptData(null);
    clearCart();
    // Réinitialiser la remise
    setRemiseType("pourcentage");
    setRemiseValeur("");
    loadProducts();
  }, [clearCart]);

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6">
      {/* Gauche - Liste des produits */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* En-tête avec stats */}

        {/* Recherche améliorée */}
        <div className="card shadow-lg">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un produit par nom ou code-barre..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-2">
              {totalItems} résultat
              {totalItems > 1 ? "s" : ""} trouvé
              {totalItems > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Grille de produits améliorée */}
        <div className="flex-1 overflow-y-auto card shadow-lg">
          {paginatedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-linear-to-br from-gray-100 to-gray-200 rounded-full p-8 mb-4 animate-pulse">
                <Package className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Aucun produit trouvé
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? "Essayez une autre recherche"
                  : "Aucun produit disponible"}
              </p>
            </div>
          ) : (
            <>
              <div
                className={`grid gap-4 p-4 ${
                  sidebarContext?.isCollapsed
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5"
                }`}
              >
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onViewDetails={handleViewProductDetails}
                    imageCache={imageCache}
                  />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                itemsPerPageOptions={[10, 20, 40, 60, 100]}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Droite - Panier */}
      <div className="w-85 flex flex-col space-y-4">
        <div className="card flex-1 flex flex-col shadow-xl border-2 border-gray-100">
          {/* En-tête du panier */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-gray-100">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">Panier</h2>
              <p className="text-sm text-gray-500">
                {cart.length} {cart.length > 1 ? "articles" : "article"}
              </p>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                title="Vider le panier"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Sélecteur de serveur */}
          <div className="border-b-2 border-gray-100 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Serveur
            </label>
            <select
              value={selectedServer?.id || ""}
              onChange={(e) => {
                const server = servers.find(
                  (s) => s.id === parseInt(e.target.value),
                );
                setSelectedServer(server || null);
              }}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            >
              <option value="">Aucun serveur</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Nom du client (optionnel) */}
          <div className="border-b-2 border-gray-100 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-green-600" />
              Client (optionnel)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom du client..."
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all outline-none"
            />
          </div>

          {/* Items du panier */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 rounded-full p-8 w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                  <ShoppingCart className="w-16 h-16 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Le panier est vide</p>
                <p className="text-gray-400 text-sm mt-1">
                  Ajoutez des produits pour commencer
                </p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 space-y-3 border border-gray-200 hover:shadow-md transition-all duration-200 animate-slideIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 leading-tight mb-1">
                        {item.nom}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.prix_vente || 0)} / unité
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id!)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
                      <button
                        onClick={() =>
                          updateCartQuantity(item.id!, item.quantity - 1)
                        }
                        className="w-8 h-8 bg-gray-100 rounded-md hover:bg-gray-200 active:scale-95 flex items-center justify-center transition-all"
                      >
                        <Minus className="w-4 h-4 text-gray-700" />
                      </button>
                      <span className="w-10 text-center font-bold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(item.id!, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.quantite_stock}
                        className="w-8 h-8 bg-blue-600 rounded-md hover:bg-blue-700 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">
                        {formatCurrency(
                          Number(item.prix_vente || 0) * item.quantity,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total et actions */}
          <div className="border-t-2 border-gray-200 pt-4 space-y-4">
            {/* Sous-totaux */}
            {cart.length > 0 && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total</span>
                  <span className="font-medium">
                    {formatCurrency(sousTotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Articles</span>
                  <span className="font-medium">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>

                {/* Section Remise */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-600 text-sm">Remise:</span>
                    <select
                      value={remiseType}
                      onChange={(e) =>
                        setRemiseType(
                          e.target.value as "pourcentage" | "montant",
                        )
                      }
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="pourcentage">%</option>
                      <option value="montant">Montant</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max={remiseType === "pourcentage" ? 100 : sousTotal}
                      value={remiseValeur}
                      onChange={(e) => setRemiseValeur(e.target.value)}
                      placeholder={remiseType === "pourcentage" ? "0%" : "0"}
                      className="w-20 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {remiseValeur && parseFloat(remiseValeur) > 0 && (
                      <button
                        onClick={() => setRemiseValeur("")}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {montantRemise > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>
                        Remise (
                        {remiseType === "pourcentage"
                          ? `${remiseValeur}%`
                          : "fixe"}
                        )
                      </span>
                      <span>-{formatCurrency(montantRemise)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total principal */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">
                  Total à payer
                </span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(total || 0)}
                </span>
              </div>
              {montantRemise > 0 && (
                <div className="text-xs text-gray-500 mt-1 text-right">
                  Remise: {formatCurrency(montantRemise)}
                </div>
              )}
            </div>

            {/* Bouton de paiement */}
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="relative overflow-hidden w-full py-4 bg-blue-600  hover:to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group"
            >
              <CreditCard className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span>Procéder au paiement</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                F9
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full modal-content animate-scaleIn">
            {/* En-tête du modal */}
            <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white px-6 py-6 rounded-t-2xl">
              <button
                onClick={() => {
                  setShowPayment(false);
                  setMontantPaye("");
                }}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                disabled={processing}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Finaliser le paiement</h2>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20 mt-4">
                <p className="text-blue-100 text-sm mb-1">Montant total</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(total || 0)}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Méthode de paiement */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Méthode de paiement
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setMethodePaiement("especes");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "especes"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "especes"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "especes"
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      Espèces
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setMethodePaiement("carte");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "carte"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "carte"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "carte"
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      Carte
                    </p>
                  </button>
                  <button
                    onClick={() => {
                      setMethodePaiement("mobile");
                      setMontantPaye("");
                    }}
                    className={`group p-4 rounded-xl border-2 transition-all duration-200 ${
                      methodePaiement === "mobile"
                        ? "border-blue-600 bg-blue-50 shadow-lg scale-105"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center transition-colors ${
                        methodePaiement === "mobile"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        methodePaiement === "mobile"
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      Mobile
                    </p>
                  </button>
                </div>
              </div>

              {/* Montant payé (seulement pour espèces) */}
              {methodePaiement === "especes" && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      Montant reçu
                    </label>
                    <div className="relative">
                      <input
                        ref={paymentInputRef}
                        type="number"
                        value={montantPaye}
                        onChange={(e) => setMontantPaye(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            parseFloat(montantPaye) >= total
                          ) {
                            handlePayment();
                          }
                        }}
                        step="0.01"
                        min={total}
                        className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                        FCFA
                      </span>
                    </div>
                    {montantPaye && parseFloat(montantPaye) < total && (
                      <p className="text-red-600 text-sm mt-2 flex items-center gap-1 animate-pulse font-semibold">
                        Montant insuffisant
                      </p>
                    )}
                  </div>

                  {/* Boutons de montants rapides */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Montants rapides
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => handleQuickAmount(amount)}
                          className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all hover:scale-105 active:scale-95 ${
                            parseFloat(montantPaye) === amount
                              ? "bg-blue-600 text-white shadow-lg"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {formatCurrency(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Monnaie à rendre */}
              {methodePaiement === "especes" &&
                montantPaye &&
                parseFloat(montantPaye) >= total && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5 animate-slideDown">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-green-600 rounded-lg p-1.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-green-800">
                        Monnaie à rendre
                      </p>
                    </div>
                    <p className="text-4xl font-bold text-green-600">
                      {formatCurrency(monnaieRendue || 0)}
                    </p>
                    {monnaieRendue > 0 && (
                      <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                        <Keyboard className="w-3 h-3" />
                        Appuyez sur Entrée pour valider
                      </p>
                    )}
                  </div>
                )}

              {/* Résumé pour carte et mobile */}
              {(methodePaiement === "carte" ||
                methodePaiement === "mobile") && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                  <p className="text-sm text-blue-800 mb-2 font-medium">
                    Montant exact à payer
                  </p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(total || 0)}
                  </p>
                  <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" />
                    Appuyez sur Entrée pour valider
                  </p>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-100">
                <button
                  onClick={() => {
                    setShowPayment(false);
                    setMontantPaye("");
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:shadow-md active:scale-95 flex items-center justify-center gap-2"
                  disabled={processing}
                >
                  <X className="w-4 h-4" />
                  Annuler
                  <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                    ESC
                  </span>
                </button>
                <button
                  onClick={handlePayment}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !processing) {
                      handlePayment();
                    }
                  }}
                  disabled={
                    processing ||
                    (methodePaiement === "especes" &&
                      parseFloat(montantPaye) < total)
                  }
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {processing ? (
                    <span className="animate-pulse">
                      Traitement en cours...
                    </span>
                  ) : (
                    <>
                      Valider la vente
                      <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                        ↵
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails du produit */}
      {showProductDetail && selectedProduct && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full animate-scaleIn border-4 border-white">
            <div className="relative bg-blue-600 text-white px-8 py-6 rounded-t-3xl">
              <button
                onClick={handleCloseProductDetail}
                className="absolute top-4 right-4 text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all hover:rotate-90 duration-300"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-start gap-4">
                {selectedProduct.image_url &&
                imageCache.get(selectedProduct.id!) ? (
                  <img
                    src={imageCache.get(selectedProduct.id!)}
                    alt={selectedProduct.nom}
                    className="w-24 h-24 object-contain bg-white/20 rounded-xl p-2"
                  />
                ) : (
                  <div className="w-24 h-24 bg-white/20 rounded-xl flex items-center justify-center">
                    <Package className="w-12 h-12 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2">
                    {selectedProduct.nom}
                  </h2>
                  <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                    {selectedProduct.categorie_nom || "Sans catégorie"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-blue-50 to-indigo-50 rounded-2xl p-5">
                  <p className="text-sm text-gray-600 mb-1">Prix de vente</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(selectedProduct.prix_vente || 0)}
                  </p>
                </div>
                <div className="bg-green-50 to-emerald-50 rounded-2xl p-5">
                  <p className="text-sm text-gray-600 mb-1">Stock disponible</p>
                  <p
                    className={`text-3xl font-bold ${
                      selectedProduct.quantite_stock <=
                      selectedProduct.stock_min
                        ? "text-orange-600"
                        : selectedProduct.quantite_stock === 0
                          ? "text-red-600"
                          : "text-green-600"
                    }`}
                  >
                    {selectedProduct.quantite_stock}
                  </p>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="bg-gray-50 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </p>
                  <p className="text-gray-600">{selectedProduct.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Code-barre</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedProduct.code_barre || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Stock minimum</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedProduct.stock_min}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Prix d'achat</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(selectedProduct.prix_achat || 0)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Marge</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {(
                      (selectedProduct.prix_vente || 0) -
                      (selectedProduct.prix_achat || 0)
                    ).toFixed(2)}{" "}
                    FCFA
                  </p>
                </div>
              </div>

              {selectedProduct.quantite_stock > selectedProduct.stock_min && (
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    handleCloseProductDetail();
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter au panier
                </button>
              )}

              {selectedProduct.quantite_stock <= selectedProduct.stock_min && (
                <div className="text-center">
                  <p className="text-orange-600 font-semibold mb-2">
                    Stock insuffisant
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedProduct.quantite_stock === 0
                      ? "Ce produit est épuisé"
                      : `Seuil d'alerte atteint (minimum: ${selectedProduct.stock_min})`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation du ticket */}
      {showReceipt && receiptData && (
        <ReceiptPreview
          receipt={receiptData}
          config={config}
          onClose={handleReceiptClose}
          onPrint={handleReceiptClose}
        />
      )}
    </div>
  );
};

export default PointOfSale;
