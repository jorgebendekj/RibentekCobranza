import { useState } from "react";
import { Search, Plus, Edit, UserCheck, UserX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// Tipos para Usuarios
interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: "Admin" | "Operador";
  estado: "Activo" | "Inactivo";
  fechaCreacion: string;
  ultimoAcceso: string;
}

// Mock data de usuarios
const mockUsuarios: Usuario[] = [
  {
    id: "U001",
    nombre: "Carlos Admin",
    email: "admin@empresa.com",
    rol: "Admin",
    estado: "Activo",
    fechaCreacion: "2025-01-15",
    ultimoAcceso: "2026-03-30 14:25",
  },
  {
    id: "U002",
    nombre: "Ana López",
    email: "ana.lopez@empresa.com",
    rol: "Operador",
    estado: "Activo",
    fechaCreacion: "2025-02-20",
    ultimoAcceso: "2026-03-30 11:40",
  },
  {
    id: "U003",
    nombre: "Juan Pérez",
    email: "juan.perez@empresa.com",
    rol: "Operador",
    estado: "Activo",
    fechaCreacion: "2025-03-10",
    ultimoAcceso: "2026-03-29 16:15",
  },
  {
    id: "U004",
    nombre: "María García",
    email: "maria.garcia@empresa.com",
    rol: "Operador",
    estado: "Inactivo",
    fechaCreacion: "2025-01-25",
    ultimoAcceso: "2026-03-15 09:30",
  },
  {
    id: "U005",
    nombre: "Roberto Silva",
    email: "roberto.silva@empresa.com",
    rol: "Admin",
    estado: "Activo",
    fechaCreacion: "2025-01-18",
    ultimoAcceso: "2026-03-30 08:50",
  },
];

export default function Usuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>(mockUsuarios);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  
  // Form states
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRol, setFormRol] = useState<"Admin" | "Operador">("Operador");

  const filteredUsuarios = usuarios.filter(
    (usuario) =>
      usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRolBadge = (rol: Usuario["rol"]) => {
    const variants: Record<Usuario["rol"], string> = {
      Admin: "bg-purple-100 text-purple-800",
      Operador: "bg-blue-100 text-blue-800",
    };
    return <Badge className={variants[rol]}>{rol}</Badge>;
  };

  const getEstadoBadge = (estado: Usuario["estado"]) => {
    const variants: Record<Usuario["estado"], string> = {
      Activo: "bg-green-100 text-green-800",
      Inactivo: "bg-slate-100 text-slate-800",
    };
    return <Badge className={variants[estado]}>{estado}</Badge>;
  };

  const handleToggleEstado = (id: string) => {
    setUsuarios((prev) =>
      prev.map((user) =>
        user.id === id
          ? {
              ...user,
              estado: user.estado === "Activo" ? "Inactivo" : "Activo",
            }
          : user
      )
    );
  };

  const handleCreateUsuario = () => {
    const newUsuario: Usuario = {
      id: `U${String(usuarios.length + 1).padStart(3, "0")}`,
      nombre: formNombre,
      email: formEmail,
      rol: formRol,
      estado: "Activo",
      fechaCreacion: new Date().toISOString().split("T")[0],
      ultimoAcceso: "-",
    };
    setUsuarios([...usuarios, newUsuario]);
    setIsCreateDialogOpen(false);
    setFormNombre("");
    setFormEmail("");
    setFormRol("Operador");
  };

  const handleEditUsuario = () => {
    if (!selectedUsuario) return;
    setUsuarios((prev) =>
      prev.map((user) =>
        user.id === selectedUsuario.id
          ? { ...user, nombre: formNombre, email: formEmail, rol: formRol }
          : user
      )
    );
    setIsEditDialogOpen(false);
    setSelectedUsuario(null);
    setFormNombre("");
    setFormEmail("");
    setFormRol("Operador");
  };

  const openEditDialog = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setFormNombre(usuario.nombre);
    setFormEmail(usuario.email);
    setFormRol(usuario.rol);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl text-slate-900">Usuarios</h1>
          <p className="text-slate-600 mt-2">
            Gestión de usuarios del sistema
          </p>
        </div>

        {/* Create User Button */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Juan Pérez"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Ej: juan.perez@empresa.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rol">Rol</Label>
                <Select value={formRol} onValueChange={(value: "Admin" | "Operador") => setFormRol(value)}>
                  <SelectTrigger id="rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUsuario}>Crear Usuario</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Total Usuarios</p>
            <p className="text-2xl font-semibold mt-1">{usuarios.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Usuarios Activos</p>
            <p className="text-2xl font-semibold mt-1">
              {usuarios.filter((u) => u.estado === "Activo").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Administradores</p>
            <p className="text-2xl font-semibold mt-1">
              {usuarios.filter((u) => u.rol === "Admin").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Operadores</p>
            <p className="text-2xl font-semibold mt-1">
              {usuarios.filter((u) => u.rol === "Operador").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Buscar usuario por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="font-medium">{usuario.nombre}</TableCell>
                  <TableCell className="text-slate-600">{usuario.email}</TableCell>
                  <TableCell>{getRolBadge(usuario.rol)}</TableCell>
                  <TableCell>{getEstadoBadge(usuario.estado)}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {usuario.ultimoAcceso}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(usuario)}
                      >
                        <Edit className="size-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant={usuario.estado === "Activo" ? "ghost" : "default"}
                        size="sm"
                        onClick={() => handleToggleEstado(usuario.id)}
                      >
                        {usuario.estado === "Activo" ? (
                          <>
                            <UserX className="size-4 mr-2" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-4 mr-2" />
                            Activar
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredUsuarios.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No se encontraron usuarios
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre Completo</Label>
              <Input
                id="edit-nombre"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rol">Rol</Label>
              <Select value={formRol} onValueChange={(value: "Admin" | "Operador") => setFormRol(value)}>
                <SelectTrigger id="edit-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditUsuario}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
