import { BanIcon, CircleCheck, Info } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "./formatters";

// Toasts personnalisés sans confettis
export const showSuccessToast = (message: string, emoji: string = "✅") => {
  toast.success(message, {
    icon: emoji,
    duration: 3000,
    style: {
      borderRadius: "10px",
      background: "#10b981",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showAddToast = (itemName: string) => {
  toast.success(`${itemName} ajouté avec succès !`, {
    icon: <CircleCheck size={20} />,
    duration: 3000,
    style: {
      borderRadius: "10px",
      background: "#10b981",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showUpdateToast = (itemName: string) => {
  toast.success(`${itemName} modifié avec succès !`, {
    icon: <CircleCheck size={20} />,
    duration: 3000,
    style: {
      borderRadius: "10px",
      background: "#3b82f6",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showDeleteToast = (itemName: string) => {
  toast.success(`${itemName} supprimé avec succès !`, {
    icon: <CircleCheck size={20} />,
    duration: 3000,
    style: {
      borderRadius: "10px",
      background: "#10b981",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showErrorToast = (message: string) => {
  toast.error(message, {
    icon: <BanIcon size={20} />,
    duration: 4000,
    style: {
      borderRadius: "10px",
      background: "#ef4444",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showInfoToast = (message: string) => {
  toast(message, {
    icon: <Info size={20} />,
    duration: 3000,
    style: {
      borderRadius: "10px",
      background: "#3b82f6",
      color: "#fff",
      fontWeight: "600",
      padding: "16px",
      fontSize: "15px",
    },
  });
};

export const showSaleToast = (total: number) => {
  toast.success(`Vente enregistrée ! Total: ${formatCurrency(total || 0)}`, {
    icon: <CircleCheck size={20} />,
    duration: 4000,
    style: {
      borderRadius: "10px",
      background: "#10b981",
      color: "#fff",
      fontWeight: "700",
      padding: "20px",
      fontSize: "16px",
    },
  });
};
