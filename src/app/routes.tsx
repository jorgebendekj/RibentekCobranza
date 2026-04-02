import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import DashboardComercial from "./pages/DashboardComercial";
import DashboardCobranzas from "./pages/DashboardCobranzas";
import { GestionDeudas } from "./pages/GestionDeudas";
import { Bandeja } from "./pages/Bandeja";
import Contactos from "./pages/Contactos";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/cobranzas" replace />,
  },
  {
    path: "/cobranzas",
    element: (
      <Layout>
        <DashboardCobranzas />
      </Layout>
    ),
  },
  {
    path: "/deudas",
    element: (
      <Layout>
        <GestionDeudas />
      </Layout>
    ),
  },
  {
    path: "/bandeja",
    element: (
      <Layout>
        <Bandeja />
      </Layout>
    ),
  },
  {
    path: "/contactos",
    element: (
      <Layout>
        <Contactos />
      </Layout>
    ),
  },
  {
    path: "/usuarios",
    element: (
      <Layout>
        <Usuarios />
      </Layout>
    ),
  },
  {
    path: "/configuracion",
    element: (
      <Layout>
        <Configuracion />
      </Layout>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/cobranzas" replace />,
  },
]);