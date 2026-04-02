import { useState } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

// Tipos para Contactos (simplificado)
interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  ultimaInteraccion: string;
}

// Mock data de contactos (simplificado)
const mockContactos: Contacto[] = [
  {
    id: "CT001",
    nombre: "Roberto Silva",
    telefono: "+591 7654 3210",
    email: "roberto.silva@company.com",
    ultimaInteraccion: "2026-03-29 14:30",
  },
  {
    id: "CT002",
    nombre: "María González",
    telefono: "+591 7123 4567",
    email: "maria.gonzalez@email.com",
    ultimaInteraccion: "2026-03-30 10:15",
  },
  {
    id: "CT003",
    nombre: "Carlos Mendoza",
    telefono: "+591 7234 5678",
    email: "carlos.m@business.com",
    ultimaInteraccion: "2026-03-28 16:45",
  },
  {
    id: "CT004",
    nombre: "Ana Rodríguez",
    telefono: "+591 7345 6789",
    email: "ana.rodriguez@mail.com",
    ultimaInteraccion: "2026-03-30 09:20",
  },
  {
    id: "CT005",
    nombre: "Patricia Vargas",
    telefono: "+591 7456 7890",
    email: "patricia.v@email.com",
    ultimaInteraccion: "2026-03-30 11:00",
  },
  {
    id: "CT006",
    nombre: "Luis Fernández",
    telefono: "+591 7567 8901",
    email: "luis.f@mail.com",
    ultimaInteraccion: "2026-03-29 15:30",
  },
  {
    id: "CT007",
    nombre: "Carmen Torres",
    telefono: "+591 7678 9012",
    email: "carmen.torres@email.com",
    ultimaInteraccion: "2026-03-28 12:00",
  },
  {
    id: "CT008",
    nombre: "Jorge Ramírez",
    telefono: "+591 7789 0123",
    email: "jorge.ramirez@company.com",
    ultimaInteraccion: "2026-03-27 18:20",
  },
];

export default function Contactos() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContactos = mockContactos.filter((contacto) => {
    const matchesSearch =
      contacto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contacto.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contacto.telefono.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">Contactos</h1>
        <p className="text-slate-600 mt-2">
          Gestión de contactos y clientes del sistema
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Total Contactos</p>
            <p className="text-2xl font-semibold mt-1">{mockContactos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Contactos Activos</p>
            <p className="text-2xl font-semibold mt-1">
              {mockContactos.filter((c) => {
                const date = new Date(c.ultimaInteraccion);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const days = diff / (1000 * 60 * 60 * 24);
                return days <= 7;
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600">Últimas 24h</p>
            <p className="text-2xl font-semibold mt-1">
              {mockContactos.filter((c) => {
                const date = new Date(c.ultimaInteraccion);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const hours = diff / (1000 * 60 * 60);
                return hours <= 24;
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
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
          <CardTitle>Lista de Contactos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Última Interacción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContactos.map((contacto) => (
                <TableRow key={contacto.id}>
                  <TableCell className="font-medium">{contacto.nombre}</TableCell>
                  <TableCell className="text-slate-600">{contacto.telefono}</TableCell>
                  <TableCell className="text-slate-600">{contacto.email}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {contacto.ultimaInteraccion}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredContactos.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No se encontraron contactos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
