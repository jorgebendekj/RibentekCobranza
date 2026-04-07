import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../data/supabase.types";

interface Props {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, dbUser, activeRole, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (dbUser && !dbUser.enabled) return <Navigate to="/login" replace />;

  const ROLE_HIERARCHY: Record<UserRole, number> = { Superadmin: 3, Admin: 2, Agente: 1 };
  const effectiveRole = activeRole ?? dbUser?.role;
  if (requiredRole && effectiveRole && ROLE_HIERARCHY[effectiveRole] < ROLE_HIERARCHY[requiredRole]) {
    return <Navigate to="/cobranzas" replace />;
  }

  return <>{children}</>;
}
