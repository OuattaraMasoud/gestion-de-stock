import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LicenseGuard from "./components/LicenseGuard";
import LicenseActivation from "./pages/LicenseActivation";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import PointOfSale from "./pages/PointOfSale";
import SalesHistory from "./pages/SalesHistory";
import Statistics from "./pages/Statistics";
import Users from "./pages/Users";
import Suppliers from "./pages/Suppliers";
import Clients from "./pages/Clients";
import Accounting from "./pages/Accounting";
import Invoices from "./pages/Invoices";
import Servers from "./pages/Servers";
import Settings from "./pages/Settings";
import Purchases from "./pages/Purchases";
import Audit from "./pages/Audit";
import Backup from "./pages/Backup";
import DatabaseMaintenance from "./pages/DatabaseMaintenance";
import SupplierDebts from "./pages/SupplierDebts";

const App: React.FC = () => {
  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
          },
        }}
      />
      <Router>
        <LicenseGuard>
          <Routes>
            <Route path="/activation" element={<LicenseActivation />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/produits" element={<Products />} />
                      <Route path="/categories" element={<Categories />} />
                      <Route path="/caisse" element={<PointOfSale />} />
                      <Route path="/ventes" element={<SalesHistory />} />
                      <Route path="/statistiques" element={<Statistics />} />
                      <Route path="/utilisateurs" element={<Users />} />
                      <Route path="/fournisseurs" element={<Suppliers />} />
                      <Route path="/dettes-fournisseurs" element={<SupplierDebts />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/serveurs" element={<Servers />} />
                      <Route path="/comptabilite" element={<Accounting />} />
                      <Route path="/factures" element={<Invoices />} />
                      <Route path="/parametres" element={<Settings />} />
                      <Route path="/achats" element={<Purchases />} />
                      <Route path="/audit" element={<Audit />} />
                      <Route path="/sauvegardes" element={<Backup />} />
                      <Route path="/maintenance" element={<DatabaseMaintenance />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </LicenseGuard>
      </Router>
    </>
  );
};

export default App;
