import { BarChart3, DollarSign, UserCheck, Users, Settings, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router";
import ribentekLogo from "figma:asset/1300735e89082c752bf754257679f55329d5f192.png";

interface SidebarProps {
  children: React.ReactNode;
}

export function Layout({ children }: SidebarProps) {
  const location = useLocation();

  const menuItems = [
    { path: "/cobranzas", label: "Dashboard Cobranzas", icon: DollarSign },
    { path: "/deudas", label: "Gestión de Deudas", icon: BarChart3 },
    { path: "/bandeja", label: "Bandeja", icon: MessageSquare },
    { path: "/contactos", label: "Contactos", icon: UserCheck },
    { path: "/usuarios", label: "Usuarios", icon: Users },
    { path: "/configuracion", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-1">
            <img 
              src={ribentekLogo} 
              alt="Ribentek" 
              className="size-16 rounded-lg"
            />
            <div>
              <h1 className="font-semibold text-xl text-slate-900">
                Ribentek
              </h1>
              <p className="text-sm text-slate-600">AI Cobranzas</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="size-10 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-600">AD</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Administrador</p>
              <p className="text-xs text-slate-500">admin@empresa.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}