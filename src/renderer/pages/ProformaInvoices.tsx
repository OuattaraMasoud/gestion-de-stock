import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Printer,
  X,
  Trash2,
  Edit,
  FileCheck,
  Package,
  UserPlus,
} from "lucide-react";
import { Configuration } from "../types";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import { montantEnLettres } from "../utils/numberToWords";
import { useAuthStore } from "../store/useAuthStore";
import { toast } from "react-hot-toast";
import { generateInvoiceQR } from "../utils/qrcode";

interface ProformaArticle {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

interface ProformaInvoice {
  id?: number;
  numero: string;
  client_id?: number;
  client_nom: string;
  client_telephone?: string;
  client_email?: string;
  date_proforma: string;
  date_validite?: string;
  total_ht: number;
  total_ttc: number;
  remise_type?: string;
  remise_valeur: number;
  total_avant_remise?: number;
  articles: ProformaArticle[];
  notes?: string;
  statut: string;
  vente_id?: number;
  created_at?: string;
}

const ProformaInvoices: React.FC = () => {
  const { user } = useAuthStore();
  const [proformas, setProformas] = useState<ProformaInvoice[]>([]);
  const [selectedProforma, setSelectedProforma] =
    useState<ProformaInvoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProforma, setEditingProforma] =
    useState<ProformaInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statutFilter, setStatutFilter] = useState("tous");
  const [totalItems, setTotalItems] = useState(0);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const proformaRef = useRef<HTMLDivElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    client_id: number | null;
    client_nom: string;
    client_telephone: string;
    client_email: string;
    date_validite: string;
    remise_type: string;
    remise_valeur: number;
    notes: string;
    articles: any[];
  }>({
    client_id: null,
    client_nom: "",
    client_telephone: "",
    client_email: "",
    date_validite: "",
    remise_type: "",
    remise_valeur: 0,
    notes: "",
    articles: [],
  });

  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [articleTempId, setArticleTempId] = useState(1);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
  });

  useEffect(() => {
    loadConfig();
    loadClients();
    loadProducts();
  }, []);

  useEffect(() => {
    loadProformas();
  }, [currentPage, itemsPerPage, searchQuery, statutFilter]);

  const loadConfig = async () => {
    try {
      const data = await window.electronAPI.getConfiguration();
      setConfig(data);
      const logo = await window.electronAPI.getCompanyLogo();
      setLogoBase64(logo);
    } catch (error) {
      console.error("Erreur chargement configuration:", error);
    }
  };

  const loadClients = async () => {
    try {
      const data = await window.electronAPI.getClients();
      setClients(data);
    } catch (error) {
      console.error("Erreur chargement clients:", error);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    }
  };

  const loadProformas = async () => {
    try {
      const result = await window.electronAPI.getProformaInvoicesPaginated(
        currentPage,
        itemsPerPage,
        searchQuery || undefined,
        statutFilter !== "tous" ? statutFilter : undefined,
      );
      setProformas(result.data);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Erreur chargement proformas:", error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const resetForm = () => {
    setFormData({
      client_id: null,
      client_nom: "",
      client_telephone: "",
      client_email: "",
      date_validite: "",
      remise_type: "",
      remise_valeur: 0,
      notes: "",
      articles: [],
    });
    setProductSearch("");
    setArticleTempId(1);
  };

  const handleClientSelect = (client: any) => {
    setFormData({
      ...formData,
      client_id: client.id,
      client_nom: client.nom,
      client_telephone: client.telephone || "",
      client_email: client.email || "",
    });
  };

  const handleAddProduct = (product: any) => {
    const existing = formData.articles.find((a) => a.produit_id === product.id);
    if (existing) {
      setFormData({
        ...formData,
        articles: formData.articles.map((a) =>
          a.produit_id === product.id
            ? {
                ...a,
                quantite: a.quantite + 1,
                total: (a.quantite + 1) * a.prixUnitaire,
              }
            : a,
        ),
      });
    } else {
      setArticleTempId((prev) => prev + 1);
      setFormData({
        ...formData,
        articles: [
          ...formData.articles,
          {
            tempId: articleTempId,
            produit_id: product.id,
            designation: product.nom,
            quantite: 1,
            prixUnitaire: product.prix_vente,
            total: product.prix_vente,
          },
        ],
      });
    }
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const handleUpdateQuantity = (tempId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setFormData({
        ...formData,
        articles: formData.articles.filter((a) => a.tempId !== tempId),
      });
    } else {
      setFormData({
        ...formData,
        articles: formData.articles.map((a) =>
          a.tempId === tempId
            ? {
                ...a,
                quantite: newQuantity,
                total: newQuantity * a.prixUnitaire,
              }
            : a,
        ),
      });
    }
  };

  const handleRemoveArticle = (tempId: number) => {
    setFormData({
      ...formData,
      articles: formData.articles.filter((a) => a.tempId !== tempId),
    });
  };

  const handleUpdatePrice = (tempId: number, newPrice: number) => {
    setFormData({
      ...formData,
      articles: formData.articles.map((a) =>
        a.tempId === tempId
          ? {
              ...a,
              prixUnitaire: newPrice,
              total: a.quantite * newPrice,
            }
          : a,
      ),
    });
  };

  const handleCreateClient = async () => {
    if (!newClientData.nom.trim()) {
      toast.error("Le nom du client est requis");
      return;
    }
    try {
      const client = await window.electronAPI.createClient(newClientData);
      toast.success("Client créé avec succès");
      const newClient = { ...newClientData, ...client };
      setClients([...clients, newClient]);
      setFormData({
        ...formData,
        client_id: newClient.id,
        client_nom: newClient.nom,
        client_telephone: newClient.telephone || "",
        client_email: newClient.email || "",
      });
      setShowNewClientModal(false);
      setNewClientData({ nom: "", telephone: "", email: "", adresse: "" });
    } catch (error) {
      console.error("Erreur création client:", error);
      toast.error("Erreur lors de la création du client");
    }
  };

  const calculateTotal = () => {
    const subtotal = formData.articles.reduce((sum, a) => sum + a.total, 0);
    let remise = 0;
    if (formData.remise_type === "pourcentage") {
      remise = subtotal * (formData.remise_valeur / 100);
    } else if (formData.remise_type === "montant") {
      remise = formData.remise_valeur;
    }
    return {
      subtotal,
      remise,
      total: subtotal - remise,
    };
  };

  const handleCreateProforma = async () => {
    if (formData.articles.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    const { subtotal, remise, total } = calculateTotal();

    try {
      await window.electronAPI.createProformaInvoice(
        {
          client_id: formData.client_id,
          client_nom: formData.client_nom || "Client comptoir",
          client_telephone: formData.client_telephone,
          client_email: formData.client_email,
          date_validite: formData.date_validite || null,
          total_ht: subtotal,
          total_ttc: total,
          remise_type: formData.remise_type || null,
          remise_valeur: formData.remise_valeur,
          total_avant_remise: remise > 0 ? subtotal : null,
          articles: formData.articles.map((a) => ({
            designation: a.designation,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            total: a.total,
          })),
          notes: formData.notes || null,
        },
        user?.id,
        user?.nom,
      );

      toast.success("Facture proforma créée avec succès");
      setShowCreateModal(false);
      resetForm();
      loadProformas();
    } catch (error) {
      console.error("Erreur création proforma:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const handleEditProforma = (proforma: ProformaInvoice) => {
    let tempId = 1;
    setEditingProforma(proforma);
    setFormData({
      client_id: proforma.client_id || null,
      client_nom: proforma.client_nom,
      client_telephone: proforma.client_telephone || "",
      client_email: proforma.client_email || "",
      date_validite: proforma.date_validite || "",
      remise_type: proforma.remise_type || "",
      remise_valeur: proforma.remise_valeur || 0,
      notes: proforma.notes || "",
      articles: proforma.articles.map((a) => ({
        tempId: tempId++,
        produit_id: 0,
        designation: a.designation,
        quantite: a.quantite,
        prixUnitaire: a.prixUnitaire,
        total: a.total,
      })),
    });
    setArticleTempId(tempId);
    setShowEditModal(true);
    setSelectedProforma(null);
  };

  const handleUpdateProforma = async () => {
    if (!editingProforma || formData.articles.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    const { subtotal, remise, total } = calculateTotal();

    try {
      await window.electronAPI.updateProformaInvoice(
        editingProforma.id!,
        {
          client_id: formData.client_id,
          client_nom: formData.client_nom || "Client comptoir",
          client_telephone: formData.client_telephone,
          client_email: formData.client_email,
          date_validite: formData.date_validite || null,
          total_ht: subtotal,
          total_ttc: total,
          remise_type: formData.remise_type || null,
          remise_valeur: formData.remise_valeur,
          total_avant_remise: remise > 0 ? subtotal : null,
          articles: formData.articles.map((a) => ({
            designation: a.designation,
            quantite: a.quantite,
            prixUnitaire: a.prixUnitaire,
            total: a.total,
          })),
          notes: formData.notes || null,
        },
        user?.id,
        user?.nom,
      );

      toast.success("Facture proforma modifiée avec succès");
      setShowEditModal(false);
      setEditingProforma(null);
      resetForm();
      loadProformas();
    } catch (error) {
      console.error("Erreur modification proforma:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDeleteProforma = async (id: number) => {
    if (
      !confirm("Êtes-vous sûr de vouloir supprimer cette facture proforma ?")
    ) {
      return;
    }

    try {
      await window.electronAPI.deleteProformaInvoice(id, user?.id, user?.nom);
      toast.success("Facture proforma supprimée");
      setSelectedProforma(null);
      loadProformas();
    } catch (error) {
      console.error("Erreur suppression proforma:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleConvertToSale = async (proforma: ProformaInvoice) => {
    if (
      !confirm(
        "Convertir cette facture proforma en vente ? Le stock sera déduit.",
      )
    ) {
      return;
    }

    try {
      const saleResult = await window.electronAPI.createSale({
        client_id: proforma.client_id,
        client_nom: proforma.client_nom,
        total: proforma.total_ttc,
        montant_paye: proforma.total_ttc,
        montant_restant: 0,
        monnaie_rendue: 0,
        statut_paiement: "paye",
        methode_paiement: "especes",
        utilisateur_id: user?.id,
        utilisateur_nom: user?.nom,
        remise_type:
          (proforma.remise_type as "pourcentage" | "montant" | undefined) ||
          undefined,
        remise_valeur: proforma.remise_valeur || 0,
        total_avant_remise: proforma.total_avant_remise || undefined,
        produits: proforma.articles.map((a) => {
          const product = products.find((p) => p.nom === a.designation);
          return {
            produit_id: product?.id || 0,
            nom_produit: a.designation,
            quantite: a.quantite,
            prix_unitaire: a.prixUnitaire,
            sous_total: a.total,
          };
        }),
      });

      // Générer le numéro de facture
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      const invoiceNumber = `${year}${month}${day}-${random}`;

      // Créer la facture
      const invoiceData = {
        numero: invoiceNumber,
        vente_id: saleResult.id,
        date_facture: now.toLocaleDateString("fr-FR"),
        heure_facture: now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        vendeur: user?.nom || "Inconnu",
        client_nom: proforma.client_nom || "Client comptoir",
        client_telephone: proforma.client_telephone || undefined,
        client_email: proforma.client_email || undefined,
        serveur_nom: undefined,
        total_ttc: proforma.total_ttc,
        methode_paiement: "especes",
        montant_paye: proforma.total_ttc,
        monnaie_rendue: 0,
        montant_restant: 0,
        statut_paiement: "paye" as const,
        remise_type:
          (proforma.remise_type as "pourcentage" | "montant" | undefined) ||
          undefined,
        remise_valeur: proforma.remise_valeur || 0,
        total_avant_remise: proforma.total_avant_remise || undefined,
        articles: proforma.articles.map((a) => ({
          designation: a.designation,
          quantite: a.quantite,
          prixUnitaire: a.prixUnitaire,
          total: a.total,
        })),
      };

      await window.electronAPI.createInvoice(invoiceData);

      await window.electronAPI.updateProformaStatus(
        proforma.id!,
        "convertie",
        saleResult.id,
        user?.id,
        user?.nom,
      );

      toast.success("Facture proforma convertie en vente avec succès");
      setSelectedProforma(null);
      loadProformas();
    } catch (error) {
      console.error("Erreur conversion:", error);
      toast.error("Erreur lors de la conversion en vente");
    }
  };

  const format = config?.format_facture || "80mm";

  // Générer le QR code quand une proforma est sélectionnée
  useEffect(() => {
    if (selectedProforma) {
      const remise = selectedProforma.total_avant_remise
        ? selectedProforma.total_avant_remise - selectedProforma.total_ttc
        : 0;
      generateInvoiceQR({
        numero: selectedProforma.numero,
        date: selectedProforma.date_proforma,
        client: selectedProforma.client_nom || "Client",
        totalAchat:
          selectedProforma.total_avant_remise || selectedProforma.total_ttc,
        remise,
        tva: 0,
        totalTTC: selectedProforma.total_ttc,
        devise: config?.devise,
      })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(null));
    } else {
      setQrCodeUrl(null);
    }
  }, [selectedProforma, config?.devise]);

  const handlePrint = async () => {
    if (!selectedProforma || !proformaRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    if (format !== "A4" && format !== "A5") {
      // Format ticket 80mm
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Proforma - ${selectedProforma.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: 80mm auto; margin: 2mm; }
              body { font-family: 'Courier New', 'Lucida Console', monospace; font-size: 12px; line-height: 1.4; color: #000; background: white; width: 76mm; margin: 0 auto; }
              .ticket { width: 76mm; padding: 2mm; background: white; }
              @media print { body { width: 76mm; } .ticket { width: 76mm; } }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div style="text-align: center; padding-bottom: 3mm; border-bottom: 1px dashed #000; margin-bottom: 3mm;">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 40px; max-width: 60mm; margin-bottom: 2mm; object-fit: contain;" />` : ""}
                <h1 style="font-size: 14px; font-weight: bold; margin-bottom: 2mm; text-transform: uppercase;">${config?.nom_entreprise || "Mon Entreprise"}</h1>
                ${config?.telephone ? `<p style="font-size: 10px; margin: 1mm 0;">Tel: ${config.telephone}</p>` : ""}
                ${config?.telephone2 ? `<p style="font-size: 10px; margin: 1mm 0;">${config.telephone2}</p>` : ""}
                ${config?.adresse ? `<p style="font-size: 10px; margin: 1mm 0;">${config.adresse}</p>` : ""}
                ${config?.email ? `<p style="font-size: 10px; margin: 1mm 0;">${config.email}</p>` : ""}
                ${config?.nif ? `<p style="font-size: 10px; margin: 1mm 0;">NIF: ${config.nif}</p>` : ""}
              </div>
              <div style="text-align: center; font-size: 14px; font-weight: bold; margin: 3mm 0; padding: 2mm 0; border-bottom: 1px dashed #000;">
                PROFORMA N° ${selectedProforma.numero}
              </div>
              <div style="margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Date:</span><span>${selectedProforma.date_proforma}</span></div>
                ${selectedProforma.date_validite ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Valide:</span><span>${selectedProforma.date_validite}</span></div>` : ""}
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Client:</span><span>${selectedProforma.client_nom}</span></div>
                ${selectedProforma.client_telephone ? `<div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;"><span>Tel:</span><span>${selectedProforma.client_telephone}</span></div>` : ""}
              </div>
              <div style="margin-bottom: 3mm; padding-bottom: 3mm;">
                ${selectedProforma.articles
                  .map(
                    (a) => `
                  <div style="margin: 2mm 0;">
                    <div style="font-size: 11px; font-weight: bold;">${a.designation}</div>
                    <div style="display: flex; justify-content: space-between; padding-left: 2mm; font-size: 10px;">
                      <span>${a.quantite} x ${formatCurrency(a.prixUnitaire)}</span>
                      <span style="font-weight: bold;">${formatCurrency(a.total)}</span>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
              <div style="margin-bottom: 3mm; padding-bottom: 3mm; border-bottom: 1px dashed #000;">
                ${
                  selectedProforma.total_avant_remise
                    ? `
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0; border-top: 1px dashed #000; padding-top: 2mm;">
                    <span>Sous-total:</span><span>${formatCurrency(selectedProforma.total_avant_remise)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 1mm 0;">
                    <span>Remise (${selectedProforma.remise_type === "pourcentage" ? selectedProforma.remise_valeur + "%" : "fixe"}):</span>
                    <span>-${formatCurrency(selectedProforma.total_avant_remise - selectedProforma.total_ttc)}</span>
                  </div>
                `
                    : ""
                }
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000;">
                  <span>TOTAL:</span><span>${formatCurrency(selectedProforma.total_ttc)}</span>
                </div>
              </div>
              ${selectedProforma.notes ? `<div style="font-size: 10px; margin: 2mm 0; padding: 2mm 0; border-bottom: 1px dashed #000;"><strong>Notes:</strong> ${selectedProforma.notes}</div>` : ""}
              ${qrCodeUrl ? `<div style="text-align: center; padding-top: 3mm;"><img src="${qrCodeUrl}" alt="QR Code" style="width: 25mm; height: 25mm;" /></div>` : ""}
              <div style="text-align: center; padding-top: 3mm;">
                <p style="font-size: 12px; font-weight: bold; margin-bottom: 2mm;">${config?.message_pied || "Merci de votre confiance !"}</p>
                <p style="font-size: 9px; margin: 1mm 0;">--------------------------------</p>
                ${config?.support_text ? `<p style="font-size: 9px; margin: 1mm 0;">${config.support_text}</p>` : ""}
              </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500); };</script>
          </body>
        </html>
      `);
    } else if (format === "A5") {
      // Format A5 - Facture Proforma compacte
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Proforma - ${selectedProforma.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A5; margin: 6mm 6mm 25mm 6mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #333; }
              .invoice { max-width: 136mm; margin: 0 auto; }
              .header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a; margin-bottom: 8px; }
              .company-logo { display: flex; align-items: center; }
              .company-logo img { max-height: 70px; max-width: 90px; object-fit: contain; }
              .company-info { flex: 1; padding: 0 12px; text-align: center; }
              .company-info h1 { font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .company-info .slogan { font-size: 10px; color: #1e3a8a; margin: 0; }
              .invoice-badge { background: #1e3a8a; color: white; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-align: center; min-width: 65px; }
              .invoice-badge .numero { font-size: 8px; font-weight: normal; margin-top: 1px; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
              .info-box { width: 48%; background: #eff6ff; padding: 6px 8px; border-radius: 4px; border: 1px solid #bfdbfe; }
              .info-box h3 { font-size: 8px; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.3px; margin-bottom: 3px; padding-bottom: 2px; border-bottom: 1px solid #bfdbfe; }
              .info-box p { margin: 1px 0; font-size: 9px; }
              .info-box strong { color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin: 6px 0; }
              thead th { background: #1e3a8a; color: white; padding: 5px 6px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.2px; }
              thead th:first-child { border-radius: 4px 0 0 0; }
              thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
              thead th.text-right { text-align: right; }
              tbody td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9px; }
              tbody tr:nth-child(even) { background: #eff6ff; }
              tbody td.text-right { text-align: right; }
              .totals-section { display: flex; justify-content: flex-end; margin-top: 6px; }
              .totals-box { width: 200px; }
              .totals-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; }
              .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
              .totals-row.discount { color: #dc2626; }
              .totals-row.grand-total { font-size: 11px; font-weight: bold; color: #1e3a8a; border-top: 2px solid #1e3a8a; padding-top: 4px; margin-top: 3px; }
              .notes { margin-top: 6px; padding: 4px 8px; background: #f9f9f9; border-radius: 4px; font-size: 8px; }
              .validity-notice { background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 8px; margin-top: 6px; border-radius: 4px; font-size: 8px; }
              .amount-words { margin-top: 6px; padding: 4px 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; font-style: italic; font-size: 8px; color: #1e3a8a; }
              .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 8px; padding-top: 6px; }
              .qr-code { text-align: center; }
              .qr-code img { width: 60px; height: 60px; }
              .qr-code p { font-size: 7px; color: #64748b; margin-top: 2px; }
              .footer { position: fixed; bottom: 6mm; left: 6mm; right: 6mm; border-top: 1px solid #1e3a8a; padding-top: 4px; text-align: center; font-size: 7.5px; color: #1e3a8a; line-height: 1.5; }
              .footer p { margin: 1px 0; }
              .footer strong { font-weight: 700; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="invoice">
              <div class="header">
                <div class="company-logo">
                  ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
                </div>
                <div class="company-info">
                  <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                  ${config?.description_entreprise ? `<p class="slogan">${config.description_entreprise}</p>` : ""}
                </div>
                <div class="invoice-badge">
                  PROFORMA
                  <div class="numero">N° ${selectedProforma.numero}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${selectedProforma.client_nom}</strong></p>
                  ${selectedProforma.client_telephone ? `<p>Tel: ${selectedProforma.client_telephone}</p>` : ""}
                  ${selectedProforma.client_email ? `<p>${selectedProforma.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Document</h3>
                  <p><strong>N°:</strong> ${selectedProforma.numero} | <strong>Date:</strong> ${selectedProforma.date_proforma}</p>
                  ${selectedProforma.date_validite ? `<p><strong>Valide jusqu'au:</strong> ${selectedProforma.date_validite}</p>` : ""}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th class="text-right" style="width: 35px;">Qte</th>
                    <th class="text-right" style="width: 70px;">P.U.</th>
                    <th class="text-right" style="width: 70px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedProforma.articles
                    .map(
                      (a) => `
                    <tr>
                      <td>${a.designation}</td>
                      <td class="text-right">${a.quantite}</td>
                      <td class="text-right">${formatCurrency(a.prixUnitaire)}</td>
                      <td class="text-right">${formatCurrency(a.total)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  ${
                    selectedProforma.total_avant_remise
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(selectedProforma.total_avant_remise)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${selectedProforma.remise_type === "pourcentage" ? selectedProforma.remise_valeur + "%" : formatCurrency(selectedProforma.remise_valeur)}):</span>
                      <span>-${formatCurrency(selectedProforma.total_avant_remise - selectedProforma.total_ttc)}</span>
                    </div>
                  `
                      : ""
                  }
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(selectedProforma.total_ttc)}</span>
                  </div>
                </div>
              </div>

              ${selectedProforma.notes ? `<div class="notes"><strong>Notes:</strong> ${selectedProforma.notes}</div>` : ""}
              ${selectedProforma.date_validite ? `<div class="validity-notice"><strong>Important:</strong> Offre valable jusqu'au ${selectedProforma.date_validite}</div>` : ""}

              <div style="margin-top: 3mm">
                Arrêté à : <strong>${montantEnLettres(selectedProforma.total_ttc, "francs CFA")}</strong>
              </div>

              <div class="qr-stamp-section">
                <div class="qr-code">
                  ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
                </div>
              </div>

              <div class="footer">
                ${[
                  [
                    config?.telephone
                      ? `<strong>Tél:</strong> ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}`
                      : "",
                    config?.email
                      ? `<strong>Email:</strong> ${config.email}`
                      : "",
                    config?.adresse
                      ? `<strong>Adresse:</strong> ${config.adresse}${config?.ville ? " " + config.ville : ""}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;"),
                  [
                    config?.secteur || "",
                    config?.nif ? `<strong>IFU:</strong> ${config.nif}` : "",
                    config?.rccm ? `<strong>RCCM:</strong> ${config.rccm}` : "",
                    config?.regime_fiscal
                      ? `<strong>Régime fiscal:</strong> ${config.regime_fiscal}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;"),
                  [
                    config?.division_fiscale
                      ? `<strong>Division fiscale:</strong> ${config.division_fiscale}`
                      : "",
                    config?.numero_compte_uba
                      ? `<strong>N° Compte UBA:</strong> ${config.numero_compte_uba}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;"),
                  config?.reference_cadastrale
                    ? `<strong>Réf. cadastrales:</strong> ${config.reference_cadastrale}`
                    : "",
                ]
                  .filter(Boolean)
                  .map((line) => `<p>${line}</p>`)
                  .join("")}
              </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500); };</script>
          </body>
        </html>
      `);
    } else {
      // Format A4 - Facture Proforma professionnelle compacte
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Proforma - ${selectedProforma.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4; margin: 8mm 8mm 30mm 8mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #333; }
              .invoice { max-width: 194mm; margin: 0 auto; }
              .header { display: flex; align-items: center; padding-bottom: 12px; border-bottom: 3px solid #1e3a8a; margin-bottom: 10px; }
              .company-logo { display: flex; align-items: center; }
              .company-logo img { max-height: 90px; max-width: 120px; object-fit: contain; }
              .company-info { flex: 1; padding: 0 20px; text-align: center; }
              .company-info h1 { font-size: 20px; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; }
              .company-info .slogan { font-size: 13px; color: #1e3a8a; margin: 0; }
              .invoice-badge { background: #1e3a8a; color: white; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: bold; text-align: center; min-width: 80px; }
              .invoice-badge .numero { font-size: 10px; font-weight: normal; margin-top: 1px; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 10px; }
              .info-box { width: 48%; background: #eff6ff; padding: 8px 10px; border-radius: 4px; border: 1px solid #bfdbfe; }
              .info-box h3 { font-size: 9px; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.3px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #bfdbfe; }
              .info-box p { margin: 2px 0; font-size: 10px; }
              .info-box strong { color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0; }
              thead th { background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; }
              thead th:first-child { border-radius: 4px 0 0 0; }
              thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
              thead th.text-right { text-align: right; }
              tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
              tbody tr:nth-child(even) { background: #eff6ff; }
              tbody td.text-right { text-align: right; }
              .totals-section { display: flex; justify-content: flex-end; margin-top: 8px; }
              .totals-box { width: 240px; }
              .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; }
              .totals-row.subtotal { border-bottom: 1px solid #e2e8f0; }
              .totals-row.discount { color: #dc2626; }
              .totals-row.grand-total { font-size: 13px; font-weight: bold; color: #1e3a8a; border-top: 2px solid #1e3a8a; padding-top: 6px; margin-top: 4px; }
              .notes { margin-top: 8px; padding: 6px 10px; background: #f9f9f9; border-radius: 4px; font-size: 9px; }
              .validity-notice { background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 10px; margin-top: 8px; border-radius: 4px; font-size: 9px; }
              .amount-words { margin-top: 8px; padding: 6px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; font-style: italic; font-size: 9px; color: #1e3a8a; }
              .qr-stamp-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding-top: 8px; }
              .qr-code { text-align: center; }
              .qr-code img { width: 80px; height: 80px; }
              .qr-code p { font-size: 8px; color: #64748b; margin-top: 2px; }
              .stamp-area { width: 150px; height: 80px; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
              .stamp-area p { font-size: 9px; color: #94a3b8; text-align: center; }
              .footer { position: fixed; bottom: 8mm; left: 8mm; right: 8mm; border-top: 1px solid #1e3a8a; padding-top: 6px; text-align: center; font-size: 8.5px; color: #1e3a8a; line-height: 1.6; }
              .footer p { margin: 1px 0; }
              .footer strong { font-weight: 700; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="invoice">
              <div class="header">
                <div class="company-logo">
                  ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ""}
                </div>
                <div class="company-info">
                  <h1>${config?.nom_entreprise || "Mon Entreprise"}</h1>
                  ${config?.description_entreprise ? `<p class="slogan">${config.description_entreprise}</p>` : ""}
                </div>
                <div class="invoice-badge">
                  PROFORMA
                  <div class="numero">N° ${selectedProforma.numero}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <h3>Client</h3>
                  <p><strong>${selectedProforma.client_nom}</strong></p>
                  ${selectedProforma.client_telephone ? `<p>Tel: ${selectedProforma.client_telephone}</p>` : ""}
                  ${selectedProforma.client_email ? `<p>${selectedProforma.client_email}</p>` : ""}
                </div>
                <div class="info-box">
                  <h3>Document</h3>
                  <p><strong>N°:</strong> ${selectedProforma.numero} | <strong>Date:</strong> ${selectedProforma.date_proforma}</p>
                  ${selectedProforma.date_validite ? `<p><strong>Valide jusqu'au:</strong> ${selectedProforma.date_validite}</p>` : ""}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Designation</th>
                    <th class="text-right" style="width: 40px;">Qte</th>
                    <th class="text-right" style="width: 80px;">P.U.</th>
                    <th class="text-right" style="width: 80px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedProforma.articles
                    .map(
                      (a) => `
                    <tr>
                      <td>${a.designation}</td>
                      <td class="text-right">${a.quantite}</td>
                      <td class="text-right">${formatCurrency(a.prixUnitaire)}</td>
                      <td class="text-right">${formatCurrency(a.total)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <div class="totals-box">
                  ${
                    selectedProforma.total_avant_remise
                      ? `
                    <div class="totals-row subtotal">
                      <span>Sous-total:</span>
                      <span>${formatCurrency(selectedProforma.total_avant_remise)}</span>
                    </div>
                    <div class="totals-row discount">
                      <span>Remise (${selectedProforma.remise_type === "pourcentage" ? selectedProforma.remise_valeur + "%" : formatCurrency(selectedProforma.remise_valeur)}):</span>
                      <span>-${formatCurrency(selectedProforma.total_avant_remise - selectedProforma.total_ttc)}</span>
                    </div>
                  `
                      : ""
                  }
                  <div class="totals-row grand-total">
                    <span>Total TTC:</span>
                    <span>${formatCurrency(selectedProforma.total_ttc)}</span>
                  </div>
                </div>
              </div>

              ${selectedProforma.notes ? `<div class="notes"><strong>Notes:</strong> ${selectedProforma.notes}</div>` : ""}

              ${selectedProforma.date_validite ? `<div class="validity-notice"><strong>Important:</strong> Offre valable jusqu'au ${selectedProforma.date_validite}</div>` : ""}

              <div class="amount-words">
                Arrete la presente facture proforma a la somme de : <strong>${montantEnLettres(selectedProforma.total_ttc, "francs CFA")}</strong>
              </div>

              <div class="qr-stamp-section">
                <div class="qr-code">
                  ${qrCodeUrl ? `<img src="${qrCodeUrl}" alt="QR Code" /><p>Scanner pour verifier</p>` : ""}
                </div>
                <div >
                </div>
              </div>

              <div class="footer">
                ${[
                  [
                    config?.telephone
                      ? `<strong>Téléphones:</strong> ${config.telephone}${config?.telephone2 ? " / " + config.telephone2 : ""}`
                      : "",
                    config?.email
                      ? `<strong>Email:</strong> ${config.email}`
                      : "",
                    config?.adresse
                      ? `<strong>Adresse:</strong> ${config.adresse}${config?.ville ? " " + config.ville : ""}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;&nbsp;&nbsp;"),
                  [
                    config?.secteur || "",
                    config?.nif ? `<strong>IFU:</strong> ${config.nif}` : "",
                    config?.rccm ? `<strong>RCCM:</strong> ${config.rccm}` : "",
                    config?.regime_fiscal
                      ? `<strong>Régime fiscal:</strong> ${config.regime_fiscal}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;&nbsp;&nbsp;"),
                  [
                    config?.division_fiscale
                      ? `<strong>Division fiscale:</strong> ${config.division_fiscale}`
                      : "",
                    config?.numero_compte_uba
                      ? `<strong>N° de Compte UBA:</strong> ${config.numero_compte_uba}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("&nbsp;&nbsp;&nbsp;&nbsp;"),
                  config?.reference_cadastrale
                    ? `<strong>Référence cadastrales:</strong> ${config.reference_cadastrale}`
                    : "",
                ]
                  .filter(Boolean)
                  .map((line) => `<p>${line}</p>`)
                  .join("")}
              </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 500); };</script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };

  const filteredProducts = productSearch
    ? products.filter(
        (p) =>
          p.nom.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.code_barre?.includes(productSearch),
      )
    : products.slice(0, 10);

  const { subtotal, remise, total } = calculateTotal();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getStatutBadge = (statut: string) => {
    const styles: Record<string, string> = {
      en_attente: "bg-yellow-100 text-yellow-700",
      acceptee: "bg-green-100 text-green-700",
      refusee: "bg-red-100 text-red-700",
      convertie: "bg-blue-100 text-blue-700",
      expiree: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    };
    const labels: Record<string, string> = {
      en_attente: "En attente",
      acceptee: "Acceptée",
      refusee: "Refusée",
      convertie: "Convertie",
      expiree: "Expirée",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[statut] || styles.en_attente}`}
      >
        {labels[statut] || statut}
      </span>
    );
  };

  const formContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client
          </label>
          <select
            value={formData.client_id || ""}
            onChange={(e) => {
              const client = clients.find(
                (c) => c.id === parseInt(e.target.value),
              );
              if (client) {
                handleClientSelect(client);
              } else {
                setFormData({
                  ...formData,
                  client_id: null,
                  client_nom: "",
                  client_telephone: "",
                  client_email: "",
                });
              }
            }}
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          >
            <option value="">Client comptoir</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="w-4 h-4" />
            Créer un nouveau client
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date de validité
          </label>
          <input
            type="date"
            value={formData.date_validite}
            onChange={(e) =>
              setFormData({ ...formData, date_validite: e.target.value })
            }
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Téléphone
          </label>
          <input
            type="text"
            value={formData.client_telephone}
            onChange={(e) =>
              setFormData({ ...formData, client_telephone: e.target.value })
            }
            placeholder="Téléphone client"
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.client_email}
            onChange={(e) =>
              setFormData({ ...formData, client_email: e.target.value })
            }
            placeholder="Email client"
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Ajouter un produit
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          />
          {showProductDropdown && productSearch && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="p-3 text-gray-500 dark:text-gray-400 text-center">
                  Aucun produit trouvé
                </p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span>{product.nom}</span>
                    </div>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(product.prix_vente)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Articles
        </label>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Produit
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 w-32">
                  Qté
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Prix
                </th>
                <th className="px-4 py-2 text-right text-xs w-40 font-medium text-gray-500 dark:text-gray-400">
                  Total
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formData.articles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Aucun article
                  </td>
                </tr>
              ) : (
                formData.articles.map((article) => (
                  <tr
                    key={article.tempId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 font-medium">
                      {article.designation}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            handleUpdateQuantity(
                              article.tempId,
                              article.quantite - 1,
                            )
                          }
                          className="w-7 h-7 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-gray-200"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold">
                          {article.quantite}
                        </span>
                        <button
                          onClick={() =>
                            handleUpdateQuantity(
                              article.tempId,
                              article.quantite + 1,
                            )
                          }
                          className="w-7 h-7 bg-blue-600 text-white rounded flex items-center justify-center hover:bg-blue-700"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <input
                        type="number"
                        value={article.prixUnitaire}
                        onChange={(e) =>
                          handleUpdatePrice(
                            article.tempId,
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-24 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded focus:border-blue-500 outline-none bg-white dark:bg-gray-800"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">
                      {formatCurrency(article.total)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveArticle(article.tempId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type de remise
          </label>
          <select
            value={formData.remise_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                remise_type: e.target.value,
                remise_valeur: 0,
              })
            }
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
          >
            <option value="">Aucune remise</option>
            <option value="pourcentage">Pourcentage (%)</option>
            <option value="montant">Montant fixe</option>
          </select>
        </div>
        {formData.remise_type && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valeur remise
            </label>
            <input
              type="number"
              value={formData.remise_valeur}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  remise_valeur: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notes ou conditions particulières..."
          rows={2}
          className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-blue-500 outline-none"
        />
      </div>

      <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between mb-2">
          <span>Sous-total:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {remise > 0 && (
          <div className="flex justify-between mb-2 text-red-600">
            <span>Remise:</span>
            <span>-{formatCurrency(remise)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Total TTC:</span>
          <span className="text-blue-600">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Factures Proforma
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gérez vos devis et factures proforma
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle proforma
        </button>
      </div>

      <div className="card shadow-lg mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par numéro ou client..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
            />
          </div>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
          >
            <option value="tous">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="acceptee">Acceptée</option>
            <option value="convertie">Convertie</option>
            <option value="refusee">Refusée</option>
            <option value="expiree">Expirée</option>
          </select>
        </div>
      </div>

      <div className="card shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                N° Proforma
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Total TTC
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Validité
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {proformas.map((proforma) => (
              <tr
                key={proforma.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                  {proforma.numero}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {proforma.date_proforma}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {proforma.client_nom}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                  {formatCurrency(proforma.total_ttc)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {proforma.date_validite || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatutBadge(proforma.statut)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedProforma(proforma)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Voir"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {proforma.statut === "en_attente" && (
                      <>
                        <button
                          onClick={() => handleEditProforma(proforma)}
                          className="text-green-600 hover:text-green-800"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleConvertToSale(proforma)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Convertir en vente"
                        >
                          <FileCheck className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {(user?.role === "admin" ||
                      user?.role === "gestionnaire") &&
                      proforma.statut !== "convertie" && (
                        <button
                          onClick={() => handleDeleteProforma(proforma.id!)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {proformas.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucune facture proforma
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Créez votre première facture proforma
            </p>
          </div>
        )}
      </div>

      {proformas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          itemsPerPageOptions={[10, 20, 50, 100]}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}

      {/* Modal Création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <h2 className="text-xl font-bold">Nouvelle Facture Proforma</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="hover:bg-white/20 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">{formContent}</div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateProforma}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Créer la proforma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {showEditModal && editingProforma && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit className="w-6 h-6" />
                <h2 className="text-xl font-bold">
                  Modifier {editingProforma.numero}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProforma(null);
                  resetForm();
                }}
                className="hover:bg-white/20 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">{formContent}</div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProforma(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateProforma}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails */}
      {selectedProforma && !showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-blue-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedProforma.numero}
                  </h2>
                  <p className="text-blue-100 text-sm">Facture Proforma</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProforma(null)}
                className="hover:bg-white/20 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto" ref={proformaRef}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Client
                  </p>
                  <p className="font-semibold">{selectedProforma.client_nom}</p>
                  {selectedProforma.client_telephone && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedProforma.client_telephone}
                    </p>
                  )}
                  {selectedProforma.client_email && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedProforma.client_email}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Date
                  </p>
                  <p className="font-semibold">
                    {selectedProforma.date_proforma}
                  </p>
                  {selectedProforma.date_validite && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Valide jusqu'au {selectedProforma.date_validite}
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full mb-6">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Article
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                      Qté
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                      Prix
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedProforma.articles.map((article, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">{article.designation}</td>
                      <td className="px-4 py-3 text-center">
                        {article.quantite}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatCurrency(article.prixUnitaire)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(article.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-lg p-4">
                {selectedProforma.total_avant_remise && (
                  <div className="flex justify-between mb-2">
                    <span>Sous-total:</span>
                    <span>
                      {formatCurrency(selectedProforma.total_avant_remise)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold">
                  <span>Total TTC:</span>
                  <span className="text-blue-600">
                    {formatCurrency(selectedProforma.total_ttc)}
                  </span>
                </div>
              </div>

              {selectedProforma.notes && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Notes:</strong> {selectedProforma.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex gap-3 rounded-b-2xl">
              {selectedProforma.statut === "en_attente" && (
                <button
                  onClick={() => handleConvertToSale(selectedProforma)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  Convertir en vente
                </button>
              )}
              <button
                onClick={handlePrint}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                {format === "A4"
                  ? "Imprimer A4"
                  : format === "A5"
                    ? "Imprimer A5"
                    : "Imprimer ticket"}
              </button>
              <button
                onClick={() => setSelectedProforma(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nouveau Client */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="w-6 h-6" />
                <h2 className="text-xl font-bold">Nouveau Client</h2>
              </div>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="hover:bg-white/20 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  value={newClientData.nom}
                  onChange={(e) =>
                    setNewClientData({ ...newClientData, nom: e.target.value })
                  }
                  placeholder="Nom du client"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  value={newClientData.telephone}
                  onChange={(e) =>
                    setNewClientData({
                      ...newClientData,
                      telephone: e.target.value,
                    })
                  }
                  placeholder="Numéro de téléphone"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) =>
                    setNewClientData({
                      ...newClientData,
                      email: e.target.value,
                    })
                  }
                  placeholder="Adresse email"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={newClientData.adresse}
                  onChange={(e) =>
                    setNewClientData({
                      ...newClientData,
                      adresse: e.target.value,
                    })
                  }
                  placeholder="Adresse"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-green-500 outline-none"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateClient}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Créer le client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProformaInvoices;
