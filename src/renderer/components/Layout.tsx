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
  Settings,
  FileText,
  FileCheck,
  Shield,
  Database,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { getAllowedRoutes } from "../utils/permissions";

interface LayoutProps {
  children: React.ReactNode;
}

export const SidebarContext = createContext<{
  isCollapsed: boolean;
  toggleSidebar: () => void;
} | null>(null);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      logout();
      navigate("/login");
    }
  };

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  // Mapper les icônes pour les permissions
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

  // Obtenir uniquement les routes autorisées pour l'utilisateur connecté
  const allowedRoutes = getAllowedRoutes(user);

  const menuItems = allowedRoutes.map((route) => ({
    path: route.path,
    icon: iconMap[route.icon] || Package,
    label: route.label,
  }));

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside
          className={`${
            isCollapsed ? "w-22" : "w-64"
          } bg-linear-to-b from-blue-600 to-blue-800 text-white flex flex-col shadow-xl transition-all duration-300`}
        >
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

          <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center ${
                        isCollapsed ? "justify-center" : "gap-3"
                      } px-3 py-3 rounded-lg transition-all duration-200 ${
                        active
                          ? "bg-white text-blue-600 shadow-lg"
                          : "text-blue-100 hover:bg-blue-700 hover:text-white"
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`${
                          isCollapsed ? "w-7 h-7" : "w-5 h-5"
                        } flex-shrink-0`}
                      />
                      {!isCollapsed && (
                        <span className="font-medium whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

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
                  <p className="text-xs text-blue-200 truncate">
                    {user?.email}
                  </p>
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
              } px-3 py-2 text-blue-100 hover:bg-blue-700 hover:text-white rounded-lg transition-colors`}
              title={isCollapsed ? "Déconnexion" : undefined}
            >
              <LogOut
                className={`${
                  isCollapsed ? "w-6 h-6" : "w-5 h-5"
                } flex-shrink-0`}
              />
              {!isCollapsed && <span className="font-medium">Déconnexion</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div
            className={`p-8 transition-all duration-300 ${
              isCollapsed ? "" : ""
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
};

export default Layout;
