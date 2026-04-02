import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  Phone,
  User,
  DollarSign,
  ArrowUpDown,
  Users,
  CreditCard,
  Settings,
  Upload,
  Clock,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { ContactSelectorModal } from "../components/ContactSelectorModal";
import * as XLSX from "xlsx";

type Deuda = {
  id: string;
  clienteId: string;
  cliente: string;
  telefono: string;
  concepto: string;
  monto: number;
  saldo: number;
  estado: "Pendiente" | "En Gestión" | "Pagada" | "Vencida";
  fechaEmision: string;
  fechaVencimiento: string;
  diasVencidos?: number;
};

type ClienteAgrupado = {
  clienteId: string;
  cliente: string;
  telefono: string;
  cantidadDeudas: number;
  totalAdeudado: number;
  deudas: Deuda[];
};

type VistaMode = "individual" | "agrupada";

type SendType = "automatico" | "manual";
type ReminderRule = {
  id: string;
  days: string;
  templateId: string;
};

export function GestionDeudas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [ordenamiento, setOrdenamiento] = useState<string>("fecha-desc");
  const [vistaMode, setVistaMode] = useState<VistaMode>("individual");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Modal Gestionar Cobranzas
  const [showCobranzasModal, setShowCobranzasModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [debtPreview, setDebtPreview] = useState<any[]>([]);
  const [sendType, setSendType] = useState<SendType>("automatico");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderTarget, setReminderTarget] = useState<"todos" | "lista">("todos");
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([
    { id: "1", days: "-3", templateId: "" },
  ]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Mock contacts
  const mockContacts = [
    { id: "1", nombre: "Roberto Silva", telefono: "+591 7654 3210", email: "roberto.silva@email.com" },
    { id: "2", nombre: "María González", telefono: "+591 7123 4567", email: "maria.gonzalez@email.com" },
    { id: "3", nombre: "Carlos Mendoza", telefono: "+591 7234 5678", email: "carlos.mendoza@email.com" },
  ];

  // Meta templates
  const metaTemplates = [
    { id: "template1", name: "Recordatorio Amigable" },
    { id: "template2", name: "Recordatorio Formal" },
    { id: "template3", name: "Recordatorio Urgente" },
  ];

  // Datos de ejemplo
  const deudas: Deuda[] = [
    {
      id: "D001",
      clienteId: "C001",
      cliente: "Roberto Silva",
      telefono: "+591 7654 3210",
      concepto: "Factura #1234 - Servicios Marzo",
      monto: 18500,
      saldo: 18500,
      estado: "Pendiente",
      fechaEmision: "01 Mar 2026",
      fechaVencimiento: "15 Mar 2026",
      diasVencidos: 16,
    },
    {
      id: "D002",
      clienteId: "C001",
      cliente: "Roberto Silva",
      telefono: "+591 7654 3210",
      concepto: "Factura #1180 - Servicios Febrero",
      monto: 12300,
      saldo: 12300,
      estado: "Vencida",
      fechaEmision: "01 Feb 2026",
      fechaVencimiento: "15 Feb 2026",
      diasVencidos: 44,
    },
    {
      id: "D003",
      clienteId: "C002",
      cliente: "María González",
      telefono: "+591 7123 4567",
      concepto: "Factura #1235 - Consultoría",
      monto: 25800,
      saldo: 0,
      estado: "Pagada",
      fechaEmision: "05 Mar 2026",
      fechaVencimiento: "20 Mar 2026",
    },
    {
      id: "D004",
      clienteId: "C003",
      cliente: "Carlos Mendoza",
      telefono: "+591 7234 5678",
      concepto: "Factura #1236 - Mantenimiento",
      monto: 8750,
      saldo: 8750,
      estado: "En Gestión",
      fechaEmision: "10 Mar 2026",
      fechaVencimiento: "25 Mar 2026",
    },
    {
      id: "D005",
      clienteId: "C003",
      cliente: "Carlos Mendoza",
      telefono: "+591 7234 5678",
      concepto: "Factura #1150 - Servicios Enero",
      monto: 15200,
      saldo: 15200,
      estado: "Vencida",
      fechaEmision: "01 Ene 2026",
      fechaVencimiento: "15 Ene 2026",
      diasVencidos: 75,
    },
    {
      id: "D006",
      clienteId: "C003",
      cliente: "Carlos Mendoza",
      telefono: "+591 7234 5678",
      concepto: "Factura #1210 - Soporte Técnico",
      monto: 6400,
      saldo: 6400,
      estado: "Pendiente",
      fechaEmision: "15 Feb 2026",
      fechaVencimiento: "28 Feb 2026",
      diasVencidos: 31,
    },
    {
      id: "D007",
      clienteId: "C004",
      cliente: "Ana Rodríguez",
      telefono: "+591 7345 6789",
      concepto: "Factura #1240 - Capacitación",
      monto: 32100,
      saldo: 16050,
      estado: "En Gestión",
      fechaEmision: "20 Mar 2026",
      fechaVencimiento: "05 Abr 2026",
    },
    {
      id: "D008",
      clienteId: "C005",
      cliente: "Patricia Vargas",
      telefono: "+591 7456 7890",
      concepto: "Factura #1237 - Software",
      monto: 9400,
      saldo: 0,
      estado: "Pagada",
      fechaEmision: "12 Mar 2026",
      fechaVencimiento: "27 Mar 2026",
    },
    {
      id: "D009",
      clienteId: "C006",
      cliente: "Luis Fernández",
      telefono: "+591 7567 8901",
      concepto: "Factura #1238 - Implementación",
      monto: 18700,
      saldo: 18700,
      estado: "Vencida",
      fechaEmision: "08 Mar 2026",
      fechaVencimiento: "23 Mar 2026",
      diasVencidos: 8,
    },
    {
      id: "D010",
      clienteId: "C007",
      cliente: "Carmen Torres",
      telefono: "+591 7678 9012",
      concepto: "Factura #1239 - Desarrollo",
      monto: 45600,
      saldo: 45600,
      estado: "Pendiente",
      fechaEmision: "25 Mar 2026",
      fechaVencimiento: "10 Abr 2026",
    },
  ];

  // Filtrar deudas
  const filteredDeudas = deudas.filter((deuda) => {
    const matchesSearch =
      deuda.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deuda.telefono.includes(searchTerm) ||
      deuda.concepto.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado =
      estadoFilter === "todos" || deuda.estado === estadoFilter;

    return matchesSearch && matchesEstado;
  });

  // Ordenar deudas
  const sortedDeudas = [...filteredDeudas].sort((a, b) => {
    switch (ordenamiento) {
      case "fecha-desc":
        return new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime();
      case "fecha-asc":
        return new Date(a.fechaEmision).getTime() - new Date(b.fechaEmision).getTime();
      case "monto-desc":
        return b.saldo - a.saldo;
      case "monto-asc":
        return a.saldo - b.saldo;
      case "cliente-asc":
        return a.cliente.localeCompare(b.cliente);
      default:
        return 0;
    }
  });

  // Agrupar deudas por cliente
  const clientesAgrupados: ClienteAgrupado[] = Object.values(
    filteredDeudas.reduce((acc, deuda) => {
      if (!acc[deuda.clienteId]) {
        acc[deuda.clienteId] = {
          clienteId: deuda.clienteId,
          cliente: deuda.cliente,
          telefono: deuda.telefono,
          cantidadDeudas: 0,
          totalAdeudado: 0,
          deudas: [],
        };
      }
      acc[deuda.clienteId].cantidadDeudas++;
      acc[deuda.clienteId].totalAdeudado += deuda.saldo;
      acc[deuda.clienteId].deudas.push(deuda);
      return acc;
    }, {} as Record<string, ClienteAgrupado>)
  );

  // Toggle expandir cliente
  const toggleClientExpansion = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      Pendiente: { variant: "outline", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      "En Gestión": { variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200" },
      Pagada: { variant: "outline", className: "bg-green-50 text-green-700 border-green-200" },
      Vencida: { variant: "outline", className: "bg-red-50 text-red-700 border-red-200" },
    };
    const badgeConfig = variants[estado] || variants.Pendiente;
    return (
      <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
        {estado}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-BO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const data = sortedDeudas.map((d) => ({
      ID: d.id,
      Cliente: d.cliente,
      Teléfono: d.telefono,
      Concepto: d.concepto,
      "Monto (Bs.)": d.monto,
      "Saldo (Bs.)": d.saldo,
      Estado: d.estado,
      "Fecha Emisión": d.fechaEmision,
      "Fecha Vencimiento": d.fechaVencimiento,
      "Días Vencidos": d.diasVencidos || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deudas");
    XLSX.writeFile(wb, `Deudas_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Estadísticas
  const stats = {
    totalDeudas: deudas.length,
    totalAdeudado: deudas.reduce((sum, d) => sum + d.saldo, 0),
    deudasVencidas: deudas.filter((d) => d.estado === "Vencida").length,
    clientesConDeuda: new Set(deudas.filter((d) => d.saldo > 0).map((d) => d.clienteId)).size,
  };

  // Modal handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (data) {
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setDebtPreview(jsonData.slice(0, 5));
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadDebtTemplate = () => {
    const template = [
      {
        Cliente: "Juan Pérez",
        Teléfono: "+591 7123 4567",
        Monto: 5000,
        Concepto: "Factura #001",
        FechaVencimiento: "2026-04-15",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Deudas.xlsx");
  };

  const handleCloseModal = () => {
    setShowCobranzasModal(false);
    setCurrentStep(1);
    setDebtPreview([]);
    setReminderMessage("");
  };

  const handleNextStep = () => {
    if (currentStep === 1 && debtPreview.length > 0) {
      setCurrentStep(2);
    }
  };

  const handleFinishFlow = () => {
    alert(`Recordatorios ${sendType === "manual" ? "enviados" : "programados"} correctamente`);
    handleCloseModal();
  };

  const addReminderRule = () => {
    const newId = (reminderRules.length + 1).toString();
    setReminderRules([...reminderRules, { id: newId, days: "0", templateId: "" }]);
  };

  const removeReminderRule = (id: string) => {
    setReminderRules(reminderRules.filter((r) => r.id !== id));
  };

  const updateReminderRule = (id: string, field: "days" | "templateId", value: string) => {
    setReminderRules(
      reminderRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const getTemplateName = (id: string) => {
    return metaTemplates.find((t) => t.id === id)?.name || "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl text-slate-900">Gestión de Deudas</h1>
          <p className="text-slate-600 mt-2">
            Administra y visualiza el estado de la cartera de deudas
          </p>
        </div>
        <Button onClick={() => setShowCobranzasModal(true)} size="lg">
          <Settings className="size-4 mr-2" />
          Gestionar cobranzas
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">Total Deudas</p>
              <div className="bg-blue-50 p-2 rounded-lg">
                <FileText className="size-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {stats.totalDeudas}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">Total Adeudado</p>
              <div className="bg-green-50 p-2 rounded-lg">
                <DollarSign className="size-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              Bs. {formatCurrency(stats.totalAdeudado)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">Deudas Vencidas</p>
              <div className="bg-red-50 p-2 rounded-lg">
                <Calendar className="size-5 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {stats.deudasVencidas}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">Clientes con Deuda</p>
              <div className="bg-purple-50 p-2 rounded-lg">
                <Users className="size-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {stats.clientesConDeuda}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Controles */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Búsqueda */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="Buscar por cliente, teléfono o concepto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro Estado */}
            <div>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="En Gestión">En Gestión</SelectItem>
                  <SelectItem value="Pagada">Pagada</SelectItem>
                  <SelectItem value="Vencida">Vencida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordenamiento */}
            <div>
              <Select value={ordenamiento} onValueChange={setOrdenamiento}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha-desc">Fecha (más reciente)</SelectItem>
                  <SelectItem value="fecha-asc">Fecha (más antigua)</SelectItem>
                  <SelectItem value="monto-desc">Monto (mayor)</SelectItem>
                  <SelectItem value="monto-asc">Monto (menor)</SelectItem>
                  <SelectItem value="cliente-asc">Cliente (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Exportar */}
            <div>
              <Button onClick={exportToExcel} variant="outline" className="w-full">
                <Download className="size-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Toggle Vista */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600 mr-2">Vista:</p>
            <Button
              variant={vistaMode === "individual" ? "default" : "outline"}
              size="sm"
              onClick={() => setVistaMode("individual")}
            >
              <FileText className="size-4 mr-2" />
              Individual
            </Button>
            <Button
              variant={vistaMode === "agrupada" ? "default" : "outline"}
              size="sm"
              onClick={() => setVistaMode("agrupada")}
            >
              <Users className="size-4 mr-2" />
              Agrupada por Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vista Individual */}
      {vistaMode === "individual" && (
        <Card>
          <CardHeader>
            <CardTitle>Listado de Deudas</CardTitle>
            <p className="text-sm text-slate-600">
              Mostrando {sortedDeudas.length} de {deudas.length} deudas
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      Cliente
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      Teléfono
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      Concepto
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                      Monto
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                      Saldo
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      Estado
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                      Vencimiento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDeudas.map((deuda) => (
                    <tr
                      key={deuda.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {deuda.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-slate-400" />
                          <span className="text-sm text-slate-900">
                            {deuda.cliente}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Phone className="size-4 text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {deuda.telefono}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">
                        {deuda.concepto}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">
                        Bs. {formatCurrency(deuda.monto)}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900 text-right">
                        Bs. {formatCurrency(deuda.saldo)}
                      </td>
                      <td className="py-3 px-4">{getEstadoBadge(deuda.estado)}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p className="text-slate-900">{deuda.fechaVencimiento}</p>
                          {deuda.diasVencidos && deuda.diasVencidos > 0 && (
                            <p className="text-red-600 text-xs">
                              {deuda.diasVencidos} días vencidos
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vista Agrupada por Cliente */}
      {vistaMode === "agrupada" && (
        <Card>
          <CardHeader>
            <CardTitle>Deudas Agrupadas por Cliente</CardTitle>
            <p className="text-sm text-slate-600">
              Mostrando {clientesAgrupados.length} clientes
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientesAgrupados.map((cliente) => {
                const isExpanded = expandedClients.has(cliente.clienteId);

                return (
                  <div
                    key={cliente.clienteId}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    {/* Cliente Header */}
                    <div
                      className="bg-slate-50 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => toggleClientExpansion(cliente.clienteId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="bg-blue-100 p-3 rounded-lg">
                            <User className="size-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-900">
                              {cliente.cliente}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="size-3 text-slate-400" />
                              <p className="text-sm text-slate-600">
                                {cliente.telefono}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-slate-600">Deudas</p>
                            <p className="font-semibold text-slate-900">
                              {cliente.cantidadDeudas}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">Total Adeudado</p>
                            <p className="font-semibold text-lg text-slate-900">
                              Bs. {formatCurrency(cliente.totalAdeudado)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="size-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="size-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Deudas Expandidas */}
                    {isExpanded && (
                      <div className="p-4 bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 text-xs font-medium text-slate-600">
                                  ID
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-slate-600">
                                  Concepto
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-slate-600">
                                  Monto
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-slate-600">
                                  Saldo
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-slate-600">
                                  Estado
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-slate-600">
                                  Vencimiento
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {cliente.deudas.map((deuda) => (
                                <tr
                                  key={deuda.id}
                                  className="border-b border-slate-100"
                                >
                                  <td className="py-2 px-3 text-sm text-slate-900">
                                    {deuda.id}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-slate-600">
                                    {deuda.concepto}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-slate-900 text-right">
                                    Bs. {formatCurrency(deuda.monto)}
                                  </td>
                                  <td className="py-2 px-3 text-sm font-medium text-slate-900 text-right">
                                    Bs. {formatCurrency(deuda.saldo)}
                                  </td>
                                  <td className="py-2 px-3">
                                    {getEstadoBadge(deuda.estado)}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-sm">
                                      <p className="text-slate-900">
                                        {deuda.fechaVencimiento}
                                      </p>
                                      {deuda.diasVencidos && deuda.diasVencidos > 0 && (
                                        <p className="text-red-600 text-xs">
                                          {deuda.diasVencidos} días vencidos
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: Gestionar Cobranzas */}
      <Dialog open={showCobranzasModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Cobranzas</DialogTitle>
            <DialogDescription>
              {currentStep === 1 
                ? "Paso 1: Carga la lista de deudas desde Excel"
                : "Paso 2: Configura los recordatorios automáticos o envía manualmente"}
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? "text-blue-600" : "text-green-600"}`}>
              <div className={`size-8 rounded-full flex items-center justify-center font-medium ${
                currentStep === 1 ? "bg-blue-100" : "bg-green-100"
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Cargar deudas</span>
            </div>
            <div className={`flex-1 h-0.5 ${currentStep === 2 ? "bg-blue-600" : "bg-slate-200"}`} />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`size-8 rounded-full flex items-center justify-center font-medium ${
                currentStep === 2 ? "bg-blue-100" : "bg-slate-100"
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Configurar recordatorios</span>
            </div>
          </div>

          {/* Step 1: Carga de Deudas */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Seleccionar archivo Excel</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadDebtTemplate}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Descarga la plantilla con el formato requerido
                </p>
              </div>

              {debtPreview.length > 0 && (
                <div className="space-y-2">
                  <Label>Vista previa ({debtPreview.length} registros)</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            {Object.keys(debtPreview[0]).map((key) => (
                              <th key={key} className="px-4 py-2 text-left font-medium text-slate-700">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {debtPreview.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((value: any, i) => (
                                <td key={i} className="px-4 py-2 text-slate-600">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configuración de Recordatorios */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div className="flex gap-2">
                  <Clock className="size-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-900">
                    Los recordatorios automáticos se enviarán en función de la fecha de vencimiento y la configuración definida
                  </p>
                </div>
              </div>

              {/* Tipo de envío */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Tipo de envío</Label>
                <RadioGroup
                  value={sendType}
                  onValueChange={(value: SendType) => setSendType(value)}
                  className="space-y-3"
                >
                  <div className={`border-2 rounded-lg p-4 ${sendType === "automatico" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="automatico" id="automatico" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="automatico" className="text-base font-medium cursor-pointer">
                          Envío Automático
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">
                          Se enviarán recordatorios automáticamente según los días configurados respecto al vencimiento
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`border-2 rounded-lg p-4 ${sendType === "manual" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="manual" id="manual" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="manual" className="text-base font-medium cursor-pointer">
                          Envío Manual
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">
                          Envía los recordatorios inmediatamente después de configurar el mensaje
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Configuración Automática */}
              {sendType === "automatico" && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Secuencia de Recordatorios</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addReminderRule}
                    >
                      <Plus className="size-4 mr-2" />
                      Agregar recordatorio
                    </Button>
                  </div>

                  <p className="text-sm text-slate-600 flex items-start gap-2">
                    <MessageSquare className="size-4 mt-0.5 shrink-0" />
                    <span>Puedes definir múltiples recordatorios antes y después del vencimiento</span>
                  </p>

                  <div className="space-y-3">
                    {reminderRules.map((rule, index) => (
                      <div key={rule.id} className="flex gap-3 items-start p-3 bg-white rounded-lg border">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm">Días respecto al vencimiento</Label>
                            <Input
                              type="number"
                              value={rule.days}
                              onChange={(e) => updateReminderRule(rule.id, "days", e.target.value)}
                              placeholder="-3, 0, +2..."
                            />
                            <p className="text-xs text-slate-500">
                              Negativo = antes, Positivo = después
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">Plantilla Meta</Label>
                            <Select
                              value={rule.templateId}
                              onValueChange={(value) => updateReminderRule(rule.id, "templateId", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona plantilla" />
                              </SelectTrigger>
                              <SelectContent>
                                {metaTemplates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {reminderRules.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReminderRule(rule.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resumen de secuencia */}
                  {reminderRules.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-blue-900 mb-2">Secuencia configurada:</p>
                      <ul className="space-y-1">
                        {reminderRules
                          .sort((a, b) => Number(a.days) - Number(b.days))
                          .map((rule) => (
                            <li key={rule.id} className="text-sm text-blue-800 flex items-center gap-2">
                              <div className="size-1.5 rounded-full bg-blue-600" />
                              <span>
                                {Number(rule.days) === 0 
                                  ? "En la fecha de vencimiento"
                                  : Number(rule.days) < 0 
                                    ? `${Math.abs(Number(rule.days))} días antes del vencimiento`
                                    : `${rule.days} días después del vencimiento`}
                                {rule.templateId && ` → ${getTemplateName(rule.templateId)}`}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Configuración Manual */}
              {sendType === "manual" && (
                <div className="space-y-3">
                  <Label htmlFor="manualMessage">Mensaje del recordatorio</Label>
                  <Textarea
                    id="manualMessage"
                    placeholder="Ej: Hola {nombre}, te recordamos que tienes un pago pendiente de Bs. {monto} con vencimiento el {fecha}."
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-slate-500">
                    Variables disponibles: {"{nombre}"}, {"{monto}"}, {"{fecha}"}
                  </p>
                </div>
              )}

              {/* Destinatarios */}
              <div className="space-y-2">
                <Label>Destinatarios</Label>
                <Select value={reminderTarget} onValueChange={(value: "todos" | "lista") => setReminderTarget(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los clientes cargados</SelectItem>
                    <SelectItem value="lista">Lista personalizada</SelectItem>
                  </SelectContent>
                </Select>
                
                {reminderTarget === "lista" && (
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowContactSelector(true)}
                    >
                      <Users className="size-4 mr-2" />
                      Seleccionar contactos
                    </Button>
                    {selectedContactIds.length > 0 && (
                      <p className="text-sm text-blue-600">
                        {selectedContactIds.length} contacto{selectedContactIds.length !== 1 ? "s" : ""} seleccionado{selectedContactIds.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {currentStep === 2 && (
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Atrás
              </Button>
            )}
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            {currentStep === 1 ? (
              <Button onClick={handleNextStep}>
                Siguiente
              </Button>
            ) : (
              <Button onClick={handleFinishFlow}>
                {sendType === "manual" ? "Enviar recordatorios ahora" : "Programar recordatorios"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Selector Modal */}
      <ContactSelectorModal
        open={showContactSelector}
        onOpenChange={setShowContactSelector}
        contacts={mockContacts}
        selectedContactIds={selectedContactIds}
        onSelectedContactIdsChange={setSelectedContactIds}
      />
    </div>
  );
}