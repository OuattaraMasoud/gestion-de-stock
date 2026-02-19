import React, { useState, createContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  History,
  BarChart3,
  Users,
  User,
  LogOut,
  Grid3x3,
  Truck,
  UserCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  FileText,
  FileCheck,
  Shield,
  Database,
  AlertCircle,
  ClipboardList,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { getAllowedRoutes } from "../utils/permissions";
import { useThemeStore, ThemeMode } from "../store/useThemeStore";

interface LayoutProps {
  children: React.ReactNode;
}

export const SidebarContext = createContext<{
  isCollapsed: boolean;
  toggleSidebar: () => void;
} | null>(null);

const MENU_GROUPS = [
  {
    key: "catalogue",
    label: "Catalogue & Stock",
    icon: Package,
    paths: ["/categories", "/produits", "/achats", "/inventaire"],
  },
  {
    key: "ventes",
    label: "Ventes",
    icon: ShoppingCart,
    paths: ["/caisse", "/factures", "/proforma", "/ventes"],
  },
  {
    key: "partenaires",
    label: "Partenaires",
    icon: UserCircle,
    paths: ["/fournisseurs", "/dettes-fournisseurs", "/clients", "/dettes-clients"],
  },
  {
    key: "equipe",
    label: "Équipe",
    icon: Users,
    paths: ["/utilisateurs"],
  },
  {
    key: "finance",
    label: "Finance & Rapports",
    icon: BarChart3,
    paths: ["/statistiques", "/comptabilite", "/depenses"],
  },
  {
    key: "admin",
    label: "Administration",
    icon: Settings,
    paths: ["/audit", "/sauvegardes", "/maintenance", "/parametres"],
  },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MENU_GROUPS.forEach((g) => {
      initial[g.key] = true;
    });
    return initial;
  });

  const handleLogout = () => {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      logout();
      navigate("/login");
    }
  };

  const toggleSidebar = () => setIsCollapsed((v) => !v);
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const iconMap: Record<string, any> = {
    LayoutDashboard,
    Package,
    ShoppingCart,
    History,
    BarChart3,
    Users,
    User,
    Grid3x3,
    Truck,
    UserCircle,
    DollarSign,
    Settings,
    FileText,
    FileCheck,
    Shield,
    Database,
    AlertCircle,
    ClipboardList,
  };

  const allowedRoutes = getAllowedRoutes(user);
  const allowedPaths = new Set(allowedRoutes.map((r) => r.path));
  const routeMap = Object.fromEntries(allowedRoutes.map((r) => [r.path, r]));

  const isActive = (path: string) => location.pathname === path;

  const renderLink = (path: string, indented = false) => {
    const route = routeMap[path];
    if (!route) return null;
    const Icon = iconMap[route.icon] || Package;
    const active = isActive(path);

    return (
      <li key={path}>
        <Link
          to={path}
          className={`flex items-center ${
            isCollapsed ? "justify-center" : indented ? "gap-3 pl-3" : "gap-3"
          } px-3 py-2.5 rounded-lg transition-all duration-200 ${
            active
              ? "bg-white text-blue-600 shadow-lg"
              : "text-blue-100 hover:bg-blue-700 hover:text-white"
          }`}
          title={isCollapsed ? route.label : undefined}
        >
          <Icon
            className={`${isCollapsed ? "w-7 h-7" : "w-4 h-4"} flex-shrink-0`}
          />
          {!isCollapsed && (
            <span className="font-medium whitespace-nowrap text-sm">
              {route.label}
            </span>
          )}
        </Link>
      </li>
    );
  };

  const themeButtons: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'light', icon: <Sun className="w-3.5 h-3.5" />, label: 'Clair' },
    { mode: 'dark', icon: <Moon className="w-3.5 h-3.5" />, label: 'Sombre' },
    { mode: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: 'Système' },
  ];

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <aside
          className={`${
            isCollapsed ? "w-22" : "w-64"
          } bg-linear-to-b from-blue-600 to-blue-800 text-white flex flex-col shadow-xl transition-all duration-300`}
        >
          {/* Logo */}
          <div className="p-4 border-b border-blue-500 flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                <span>SynkaPOS</span>
              </h1>
            )}
            {isCollapsed && (
              <div className="w-full flex justify-center">
                <Package className="w-8 h-8" />
              </div>
            )}
            <button
              onClick={toggleSidebar}
              className="text-blue-200 bg-blue-500 hover:text-white transition-colors p-1 rounded-md hover:bg-blue-700"
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto custom-scrollbar">
            <ul className="space-y-0.5">
              {/* Dashboard standalone */}
              {renderLink("/")}

              {/* Grouped items */}
              {MENU_GROUPS.map((group) => {
                const groupItems = group.paths.filter((p) =>
                  allowedPaths.has(p),
                );
                if (groupItems.length === 0) return null;

                const GroupIcon = group.icon;
                const isGroupActive = groupItems.some((p) => isActive(p));
                const isOpen = openGroups[group.key];

                // Sidebar collapsed: show icons without group structure
                if (isCollapsed) {
                  return (
                    <React.Fragment key={group.key}>
                      {groupItems.map((path) => renderLink(path))}
                    </React.Fragment>
                  );
                }

                return (
                  <li key={group.key} className="pt-2">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                        isGroupActive
                          ? "text-white"
                          : "text-blue-300 hover:text-blue-100"
                      }`}
                    >
                      <GroupIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        {group.label}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    {/* Group items */}
                    {isOpen && (
                      <ul className="mt-0.5 ml-2 pl-2 border-l border-blue-500/40 space-y-0.5">
                        {groupItems.map((path) => renderLink(path, true))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Theme Toggle */}
          <div className="px-4 pb-2">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                {themeButtons.map((btn) => (
                  <button
                    key={btn.mode}
                    onClick={() => setMode(btn.mode)}
                    title={btn.label}
                    className={`p-1.5 rounded-md transition-colors ${
                      mode === btn.mode
                        ? 'bg-white/20 text-white'
                        : 'text-blue-300 hover:text-white hover:bg-blue-700/50'
                    }`}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-blue-700/40 rounded-lg p-1">
                {themeButtons.map((btn) => (
                  <button
                    key={btn.mode}
                    onClick={() => setMode(btn.mode)}
                    title={btn.label}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-xs font-medium transition-colors ${
                      mode === btn.mode
                        ? 'bg-white/20 text-white'
                        : 'text-blue-300 hover:text-white'
                    }`}
                  >
                    {btn.icon}
                    <span className="hidden xl:inline">{btn.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User + Logout */}
          <div className="p-4 border-t border-blue-500 space-y-2">
            {!isCollapsed && (
              <div className="flex items-center gap-3 px-3 py-3 bg-blue-700 rounded-lg">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {user?.nom?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{user?.nom}</p>
                  <p className="text-xs text-blue-200 truncate">{user?.email}</p>
                  <p className="text-xs text-blue-300 capitalize mt-0.5 truncate">
                    {user?.role}
                  </p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div
                className="flex justify-center py-2 bg-blue-700 rounded-lg"
                title={`${user?.nom} - ${user?.role}`}
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-base">
                    {user?.nom?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`flex items-center ${
                isCollapsed ? "justify-center" : "gap-2"
              } px-3 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors w-full`}
              title={isCollapsed ? "Déconnexion" : undefined}
            >
              <LogOut
                className={`${isCollapsed ? "w-6 h-6" : "w-5 h-5"} flex-shrink-0`}
              />
              {!isCollapsed && (
                <span className="font-medium">Déconnexion</span>
              )}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default Layout;
