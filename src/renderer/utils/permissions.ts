import { User } from "../types";

export type UserRole = "admin" | "caissier" | "gestionnaire";

export interface RoutePermission {
  path: string;
  label: string;
  icon: string;
  allowedRoles: UserRole[];
}

// Définition des permissions pour chaque route
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/categories",
    label: "Catégories",
    icon: "Grid3x3",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/produits",
    label: "Produits",
    icon: "Package",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/achats",
    label: "Approvisionnements",
    icon: "Package",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/inventaire",
    label: "Inventaire",
    icon: "ClipboardList",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/caisse",
    label: "Caisse",
    icon: "ShoppingCart",
    allowedRoles: ["admin", "caissier"],
  },
  {
    path: "/utilisateurs",
    label: "Utilisateurs",
    icon: "Users",
    allowedRoles: ["admin"],
  },
  {
    path: "/fournisseurs",
    label: "Fournisseurs",
    icon: "Truck",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/dettes-fournisseurs",
    label: "Dettes Fournisseurs",
    icon: "AlertCircle",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/factures",
    label: "Factures",
    icon: "FileText",
    allowedRoles: ["admin", "gestionnaire", "caissier"],
  },
  {
    path: "/proforma",
    label: "Proforma",
    icon: "FileCheck",
    allowedRoles: ["admin", "gestionnaire", "caissier"],
  },
  // {
  //   path: "/serveurs",
  //   label: "Serveurs",
  //   icon: "User",
  //   allowedRoles: ["admin", "gestionnaire"],
  // },
  {
    path: "/ventes",
    label: "Historique",
    icon: "History",
    allowedRoles: ["admin", "gestionnaire", "caissier"],
  },
  {
    path: "/statistiques",
    label: "Statistiques",
    icon: "BarChart3",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/comptabilite",
    label: "Comptabilité",
    icon: "DollarSign",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/depenses",
    label: "Dépenses",
    icon: "DollarSign",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/audit",
    label: "Audit",
    icon: "Shield",
    allowedRoles: ["admin"],
  },
  {
    path: "/sauvegardes",
    label: "Sauvegardes",
    icon: "Database",
    allowedRoles: ["admin"],
  },
  {
    path: "/maintenance",
    label: "Maintenance",
    icon: "Settings",
    allowedRoles: ["admin"],
  },
  {
    path: "/clients",
    label: "Clients",
    icon: "UserCircle",
    allowedRoles: ["admin", "gestionnaire"],
  },
  {
    path: "/dettes-clients",
    label: "Dettes Clients",
    icon: "AlertCircle",
    allowedRoles: ["admin", "gestionnaire"],
  },

  {
    path: "/parametres",
    label: "Paramètres",
    icon: "Settings",
    allowedRoles: ["admin"],
  },
];

// Vérifier si un utilisateur a accès à une route
export const hasAccess = (user: User | null, path: string): boolean => {
  if (!user) return false;

  const route = ROUTE_PERMISSIONS.find((r) => r.path === path);
  if (!route) return false;

  return route.allowedRoles.includes(user.role);
};

// Obtenir les routes autorisées pour un utilisateur
export const getAllowedRoutes = (user: User | null): RoutePermission[] => {
  if (!user) return [];

  return ROUTE_PERMISSIONS.filter((route) =>
    route.allowedRoles.includes(user.role),
  );
};

// Obtenir la route par défaut pour un utilisateur
export const getDefaultRoute = (user: User | null): string => {
  if (!user) return "/login";

  switch (user.role) {
    case "admin":
      return "/";
    case "gestionnaire":
      return "/";
    case "caissier":
      return "/caisse";
    default:
      return "/login";
  }
};
