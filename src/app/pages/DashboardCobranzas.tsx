import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Bell, 
  DollarSign, 
  TrendingUp, 
  Percent,
  ArrowUp,
  ArrowDown,
  Download,
  Calendar,
  MoreVertical,
  Settings,
  Clock,
  MessageSquare,
  Plus,
  Trash2,
  Search,
  Users,
  Eye,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ContactSelectorModal } from "../components/ContactSelectorModal";
import { DetailModal } from "../components/DetailModal";

type DateRange = "hoy" | "7dias" | "30dias" | "personalizado";
type SendType = "manual" | "automatico";
type FlowStep = 1 | 2;

interface ReminderRule {
  id: string;
  days: string;
  templateId: string;
}

interface Contact {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
}

// Mock data de contactos (reutilizando la data del módulo Contactos)
const mockContacts: Contact[] = [
  { id: "CT001", nombre: "Roberto Silva", telefono: "+591 7654 3210", email: "roberto.silva@company.com" },
  { id: "CT002", nombre: "María González", telefono: "+591 7123 4567", email: "maria.gonzalez@email.com" },
  { id: "CT003", nombre: "Carlos Mendoza", telefono: "+591 7234 5678", email: "carlos.m@business.com" },
  { id: "CT004", nombre: "Ana Rodríguez", telefono: "+591 7345 6789", email: "ana.rodriguez@mail.com" },
  { id: "CT005", nombre: "Patricia Vargas", telefono: "+591 7456 7890", email: "patricia.v@email.com" },
  { id: "CT006", nombre: "Luis Fernández", telefono: "+591 7567 8901", email: "luis.f@mail.com" },
  { id: "CT007", nombre: "Carmen Torres", telefono: "+591 7678 9012", email: "carmen.torres@email.com" },
  { id: "CT008", nombre: "Jorge Ramírez", telefono: "+591 7789 0123", email: "jorge.ramirez@company.com" },
];

// Mock data para Cobranzas
const cobranzasStats = {
  totalRecordatorios: 189,
  totalRecaudado: 847250,
  promedioRecaudacion: 4482,
  tasaRecuperacion: 76.3,
};

const actividadCobranzas = [
  { categoria: "Semana 1", recordatorios: 45, pagos: 38 },
  { categoria: "Semana 2", recordatorios: 52, pagos: 41 },
  { categoria: "Semana 3", recordatorios: 48, pagos: 43 },
  { categoria: "Semana 4", recordatorios: 44, pagos: 35 },
];

const recaudacionDiaria = [
  { fecha: "24 Mar", monto: 95400 },
  { fecha: "25 Mar", monto: 118200 },
  { fecha: "26 Mar", monto: 105800 },
  { fecha: "27 Mar", monto: 142300 },
  { fecha: "28 Mar", monto: 128600 },
  { fecha: "29 Mar", monto: 135700 },
  { fecha: "30 Mar", monto: 121250 },
];

const estadoClientes = [
  { estado: "Pendiente", cantidad: 45, porcentaje: 23.8 },
  { estado: "Pagado", cantidad: 128, porcentaje: 67.7 },
  { estado: "En seguimiento", cantidad: 16, porcentaje: 8.5 },
];

// Plantillas Meta disponibles
const metaTemplates = [
  { id: "template_1", name: "Recordatorio de Pago Estándar" },
  { id: "template_2", name: "Recordatorio Pre-vencimiento" },
  { id: "template_3", name: "Recordatorio Post-vencimiento" },
  { id: "template_4", name: "Plan de Pagos Disponible" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function DashboardCobranzas() {
  const [dateRange, setDateRange] = useState<DateRange>("7dias");
  const [showCobranzasModal, setShowCobranzasModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [sendType, setSendType] = useState<SendType>("automatico");
  const [reminderTarget, setReminderTarget] = useState<"todos" | "lista">("todos");
  const [reminderMessage, setReminderMessage] = useState("");
  const [debtFile, setDebtFile] = useState<File | null>(null);
  const [debtPreview, setDebtPreview] = useState<any[]>([]);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([
    { id: "1", days: "-3", templateId: "" },
  ]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showActividadDetail, setShowActividadDetail] = useState(false);
  const [showRecaudacionDetail, setShowRecaudacionDetail] = useState(false);
  const [showEstadoClientesDetail, setShowEstadoClientesDetail] = useState(false);
  const [showResumenDetail, setShowResumenDetail] = useState(false);
  const [showKpiRecordatoriosDetail, setShowKpiRecordatoriosDetail] = useState(false);
  const [showKpiRecaudadoDetail, setShowKpiRecaudadoDetail] = useState(false);
  const [showKpiPromedioDetail, setShowKpiPromedioDetail] = useState(false);
  const [showKpiTasaDetail, setShowKpiTasaDetail] = useState(false);

  // Datos desglosados para "Ver detalle"
  const actividadDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Recordatorios Enviados": 3, "Pagos Realizados": 2, Estado: "Activo", Fecha: "28 Mar" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Recordatorios Enviados": 2, "Pagos Realizados": 2, Estado: "Activo", Fecha: "29 Mar" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Recordatorios Enviados": 4, "Pagos Realizados": 3, Estado: "Activo", Fecha: "27 Mar" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Recordatorios Enviados": 2, "Pagos Realizados": 1, Estado: "Pendiente", Fecha: "30 Mar" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Recordatorios Enviados": 3, "Pagos Realizados": 3, Estado: "Activo", Fecha: "26 Mar" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Recordatorios Enviados": 1, "Pagos Realizados": 1, Estado: "Activo", Fecha: "29 Mar" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Recordatorios Enviados": 5, "Pagos Realizados": 4, Estado: "Activo", Fecha: "25 Mar" },
    { Cliente: "Jorge Ramírez", Teléfono: "+591 7789 0123", "Recordatorios Enviados": 2, "Pagos Realizados": 0, Estado: "En seguimiento", Fecha: "30 Mar" },
  ];

  const recaudacionDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Monto (Bs.)": "18,500", "Fecha de Pago": "28 Mar 2026", "Método": "Transferencia", Estado: "Confirmado" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Monto (Bs.)": "12,300", "Fecha de Pago": "29 Mar 2026", "Método": "Efectivo", Estado: "Confirmado" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Monto (Bs.)": "25,800", "Fecha de Pago": "27 Mar 2026", "Método": "Transferencia", Estado: "Confirmado" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Monto (Bs.)": "8,750", "Fecha de Pago": "26 Mar 2026", "Método": "Tarjeta", Estado: "Confirmado" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Monto (Bs.)": "15,200", "Fecha de Pago": "29 Mar 2026", "Método": "Transferencia", Estado: "Confirmado" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Monto (Bs.)": "32,100", "Fecha de Pago": "25 Mar 2026", "Método": "Transferencia", Estado: "Confirmado" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Monto (Bs.)": "9,400", "Fecha de Pago": "30 Mar 2026", "Método": "Efectivo", Estado: "Pendiente" },
  ];

  const estadoClientesDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "28 Mar 2026", "Días Vencido": "0" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "29 Mar 2026", "Días Vencido": "0" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "27 Mar 2026", "Días Vencido": "0" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", Estado: "Pendiente", "Monto Deuda (Bs.)": "4,500", "Último Pago": "15 Mar 2026", "Días Vencido": "5" },
    { Cliente: "Jorge Ramírez", Teléfono: "+591 7789 0123", Estado: "En seguimiento", "Monto Deuda (Bs.)": "12,300", "Último Pago": "10 Mar 2026", "Días Vencido": "12" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "26 Mar 2026", "Días Vencido": "0" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "29 Mar 2026", "Días Vencido": "0" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", Estado: "Pagado", "Monto Deuda (Bs.)": "0", "Último Pago": "25 Mar 2026", "Días Vencido": "0" },
  ];

  const resumenDetailData = [
    { Métrica: "Promedio de recaudación diaria", Valor: "Bs. 121,035", Tendencia: "+18%", Periodo: "Últimos 7 días" },
    { Métrica: "Tiempo promedio de respuesta", Valor: "1.8 min", Tendencia: "-12%", Periodo: "Últimos 7 días" },
    { Métrica: "Efectividad de recordatorios", Valor: "82.5%", Tendencia: "+7%", Periodo: "Últimos 7 días" },
    { Métrica: "Tasa de conversión", Valor: "76.3%", Tendencia: "+4%", Periodo: "Últimos 7 días" },
    { Métrica: "Recordatorios enviados", Valor: "189", Tendencia: "+6%", Periodo: "Últimos 7 días" },
  ];

  // Datos desglosados para KPIs
  const kpiRecordatoriosDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Recordatorios Enviados": 3, "Último Recordatorio": "28 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Recordatorios Enviados": 2, "Último Recordatorio": "29 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Recordatorios Enviados": 4, "Último Recordatorio": "27 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Recordatorios Enviados": 2, "Último Recordatorio": "30 Mar 2026", Estado: "Pendiente", Canal: "WhatsApp" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Recordatorios Enviados": 3, "Último Recordatorio": "26 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Recordatorios Enviados": 1, "Último Recordatorio": "29 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Recordatorios Enviados": 5, "Último Recordatorio": "25 Mar 2026", Estado: "Respondido", Canal: "WhatsApp" },
    { Cliente: "Jorge Ramírez", Teléfono: "+591 7789 0123", "Recordatorios Enviados": 2, "Último Recordatorio": "30 Mar 2026", Estado: "Sin respuesta", Canal: "WhatsApp" },
  ];

  const kpiRecaudadoDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Monto (Bs.)": "18,500", Fecha: "28 Mar 2026", Método: "Transferencia", Concepto: "Factura #1234" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Monto (Bs.)": "12,300", Fecha: "29 Mar 2026", Método: "Efectivo", Concepto: "Factura #1235" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Monto (Bs.)": "25,800", Fecha: "27 Mar 2026", Método: "Transferencia", Concepto: "Factura #1236" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Monto (Bs.)": "8,750", Fecha: "26 Mar 2026", Método: "Tarjeta", Concepto: "Factura #1237" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Monto (Bs.)": "15,200", Fecha: "29 Mar 2026", Método: "Transferencia", Concepto: "Factura #1238" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Monto (Bs.)": "32,100", Fecha: "25 Mar 2026", Método: "Transferencia", Concepto: "Factura #1239" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Monto (Bs.)": "9,400", Fecha: "30 Mar 2026", Método: "Efectivo", Concepto: "Factura #1240" },
  ];

  const kpiPromedioDetailData = [
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Monto Promedio (Bs.)": "10,700", "Pagos Realizados": 3, "Total Acumulado (Bs.)": "32,100" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Monto Promedio (Bs.)": "8,600", "Pagos Realizados": 3, "Total Acumulado (Bs.)": "25,800" },
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Monto Promedio (Bs.)": "9,250", "Pagos Realizados": 2, "Total Acumulado (Bs.)": "18,500" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Monto Promedio (Bs.)": "15,200", "Pagos Realizados": 1, "Total Acumulado (Bs.)": "15,200" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Monto Promedio (Bs.)": "6,150", "Pagos Realizados": 2, "Total Acumulado (Bs.)": "12,300" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Monto Promedio (Bs.)": "9,400", "Pagos Realizados": 1, "Total Acumulado (Bs.)": "9,400" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Monto Promedio (Bs.)": "2,916", "Pagos Realizados": 3, "Total Acumulado (Bs.)": "8,750" },
  ];

  const kpiTasaDetailData = [
    { Cliente: "Roberto Silva", Teléfono: "+591 7654 3210", "Recordatorios Enviados": 3, "Pagos Realizados": 2, "Tasa de Recuperación (%)": "66.7%", Estado: "Activo" },
    { Cliente: "María González", Teléfono: "+591 7123 4567", "Recordatorios Enviados": 2, "Pagos Realizados": 2, "Tasa de Recuperación (%)": "100%", Estado: "Activo" },
    { Cliente: "Carlos Mendoza", Teléfono: "+591 7234 5678", "Recordatorios Enviados": 4, "Pagos Realizados": 3, "Tasa de Recuperación (%)": "75%", Estado: "Activo" },
    { Cliente: "Patricia Vargas", Teléfono: "+591 7456 7890", "Recordatorios Enviados": 3, "Pagos Realizados": 3, "Tasa de Recuperación (%)": "100%", Estado: "Activo" },
    { Cliente: "Luis Fernández", Teléfono: "+591 7567 8901", "Recordatorios Enviados": 1, "Pagos Realizados": 1, "Tasa de Recuperación (%)": "100%", Estado: "Activo" },
    { Cliente: "Carmen Torres", Teléfono: "+591 7678 9012", "Recordatorios Enviados": 5, "Pagos Realizados": 4, "Tasa de Recuperación (%)": "80%", Estado: "Activo" },
    { Cliente: "Ana Rodríguez", Teléfono: "+591 7345 6789", "Recordatorios Enviados": 2, "Pagos Realizados": 1, "Tasa de Recuperación (%)": "50%", Estado: "Pendiente" },
    { Cliente: "Jorge Ramírez", Teléfono: "+591 7789 0123", "Recordatorios Enviados": 2, "Pagos Realizados": 0, "Tasa de Recuperación (%)": "0%", Estado: "En seguimiento" },
  ];

  const stats = [
    {
      title: "Total de Recordatorios",
      value: cobranzasStats.totalRecordatorios,
      icon: Bell,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: { value: "+6%", isPositive: true },
    },
    {
      title: "Total Recaudado",
      value: `Bs. ${formatCurrency(cobranzasStats.totalRecaudado)}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: { value: "+22%", isPositive: true },
    },
    {
      title: "Promedio de Pago",
      value: `Bs. ${formatCurrency(cobranzasStats.promedioRecaudacion)}`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      trend: { value: "+9%", isPositive: true },
    },
    {
      title: "Tasa de Recuperación",
      value: `${cobranzasStats.tasaRecuperacion}%`,
      icon: Percent,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      trend: { value: "+4%", isPositive: true },
    },
  ];

  const handleExportToExcel = () => {
    const exportData = [
      { Sección: "KPIs", Métrica: "", Valor: "" },
      { Sección: "", Métrica: "Total de Recordatorios", Valor: cobranzasStats.totalRecordatorios },
      { Sección: "", Métrica: "Total Recaudado (Bs.)", Valor: cobranzasStats.totalRecaudado },
      { Sección: "", Métrica: "Promedio de Pago (Bs.)", Valor: cobranzasStats.promedioRecaudacion },
      { Sección: "", Métrica: "Tasa de Recuperación (%)", Valor: cobranzasStats.tasaRecuperacion },
      { Sección: "", Métrica: "", Valor: "" },
      { Sección: "Actividad de Cobranzas", Métrica: "", Valor: "" },
      ...actividadCobranzas.map((item) => ({
        Sección: "",
        Métrica: item.categoria,
        "Recordatorios Enviados": item.recordatorios,
        "Pagos Recibidos": item.pagos,
      })),
      { Sección: "", Métrica: "", Valor: "" },
      { Sección: "Recaudación Diaria", Métrica: "", Valor: "" },
      ...recaudacionDiaria.map((item) => ({
        Sección: "",
        Métrica: item.fecha,
        "Monto Recaudado (Bs.)": item.monto,
      })),
      { Sección: "", Métrica: "", Valor: "" },
      { Sección: "Estado de Clientes", Métrica: "", Valor: "" },
      ...estadoClientes.map((item) => ({
        Sección: "",
        Métrica: item.estado,
        Cantidad: item.cantidad,
        "Porcentaje (%)": item.porcentaje,
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Cobranzas");
    const fileName = `Dashboard_Cobranzas_${dateRange}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportActividad = () => {
    const data = actividadCobranzas.map((item) => ({
      Periodo: item.categoria,
      "Recordatorios Enviados": item.recordatorios,
      "Pagos Recibidos": item.pagos,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actividad");
    XLSX.writeFile(wb, `Actividad_Cobranzas_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportRecaudacion = () => {
    const data = recaudacionDiaria.map((item) => ({
      Fecha: item.fecha,
      "Monto Recaudado (Bs.)": item.monto,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recaudación");
    XLSX.writeFile(wb, `Recaudacion_Diaria_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportEstadoClientes = () => {
    const data = estadoClientes.map((item) => ({
      Estado: item.estado,
      Cantidad: item.cantidad,
      "Porcentaje (%)": item.porcentaje,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estado Clientes");
    XLSX.writeFile(wb, `Estado_Clientes_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportResumenRendimiento = () => {
    const data = [
      { Métrica: "Promedio de recaudación diaria", Valor: `Bs. ${formatCurrency(121035)}` },
      { Métrica: "Tiempo promedio de respuesta", Valor: "1.8 min" },
      { Métrica: "Efectividad de recordatorios", Valor: "82.5%"},
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen");
    XLSX.writeFile(wb, `Resumen_Rendimiento_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportKpiRecordatorios = () => {
    const ws = XLSX.utils.json_to_sheet(kpiRecordatoriosDetailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Total Recordatorios");
    XLSX.writeFile(wb, `Total_Recordatorios_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportKpiRecaudado = () => {
    const ws = XLSX.utils.json_to_sheet(kpiRecaudadoDetailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Total Recaudado");
    XLSX.writeFile(wb, `Total_Recaudado_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportKpiPromedio = () => {
    const ws = XLSX.utils.json_to_sheet(kpiPromedioDetailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Promedio de Pago");
    XLSX.writeFile(wb, `Promedio_Pago_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportKpiTasa = () => {
    const ws = XLSX.utils.json_to_sheet(kpiTasaDetailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasa de Recuperación");
    XLSX.writeFile(wb, `Tasa_Recuperacion_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const downloadDebtTemplate = () => {
    const template = [
      {
        "Nombre": "Juan Pérez",
        "Teléfono": "+52 555 1234 5678",
        "Deuda por": "Factura #1234",
        "Fecha de Vencimiento": "2026-04-15",
        "Monto Mora (Bs.)": "150",
        "Monto Cuota (Bs.)": "500",
        "Total Deuda (Bs.)": "650",
      },
      {
        "Nombre": "María García",
        "Teléfono": "+52 555 9876 5432",
        "Deuda por": "Factura #5678",
        "Fecha de Vencimiento": "2026-04-20",
        "Monto Mora (Bs.)": "200",
        "Monto Cuota (Bs.)": "750",
        "Total Deuda (Bs.)": "950",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Deudas");
    XLSX.writeFile(wb, "Plantilla_Deudas.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      
      setDebtPreview(jsonData.slice(0, 5)); // Preview primeras 5 filas
      setDebtFile(file);
    };
    reader.readAsBinaryString(file);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!debtFile) {
        toast.error("Por favor selecciona un archivo");
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleFinishFlow = () => {
    if (sendType === "automatico" && reminderRules.some(r => !r.templateId)) {
      toast.error("Por favor selecciona una plantilla para cada recordatorio");
      return;
    }
    if (sendType === "manual" && !reminderMessage) {
      toast.error("Por favor ingresa un mensaje");
      return;
    }
    
    const action = sendType === "manual" ? "enviados" : "programados";
    toast.success(`Recordatorios ${action} exitosamente`);
    handleCloseModal();
  };

  const handleCloseModal = () => {
    setShowCobranzasModal(false);
    setCurrentStep(1);
    setDebtFile(null);
    setDebtPreview([]);
    setSendType("automatico");
    setReminderMessage("");
    setReminderRules([{ id: "1", days: "-3", templateId: "" }]);
  };

  const addReminderRule = () => {
    const newId = String(Date.now());
    setReminderRules([...reminderRules, { id: newId, days: "0", templateId: "" }]);
  };

  const removeReminderRule = (id: string) => {
    if (reminderRules.length > 1) {
      setReminderRules(reminderRules.filter(r => r.id !== id));
    }
  };

  const updateReminderRule = (id: string, field: "days" | "templateId", value: string) => {
    setReminderRules(reminderRules.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const getTemplateName = (templateId: string) => {
    return metaTemplates.find(t => t.id === templateId)?.name || "Sin seleccionar";
  };

  const getDateRangeLabel = () => {
    const labels: Record<DateRange, string> = {
      hoy: "Hoy",
      "7dias": "Últimos 7 días",
      "30dias": "Últimos 30 días",
      personalizado: "Personalizado",
    };
    return labels[dateRange];
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl text-slate-900">Dashboard Cobranzas</h1>
          <p className="text-slate-600 mt-2">
            Rendimiento del Agente IA de Cobranzas
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-slate-600" />
            <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rango de fechas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="7dias">Últimos 7 días</SelectItem>
                <SelectItem value="30dias">Últimos 30 días</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Button */}
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="size-4 mr-2" />
            Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Active Filter Indicator */}
      {dateRange && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Periodo seleccionado:</span> {getDateRangeLabel()}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend.isPositive ? ArrowUp : ArrowDown;
          
          // Map functions for each KPI
          const kpiActions = [
            { onDetail: () => setShowKpiRecordatoriosDetail(true), onExport: exportKpiRecordatorios },
            { onDetail: () => setShowKpiRecaudadoDetail(true), onExport: exportKpiRecaudado },
            { onDetail: () => setShowKpiPromedioDetail(true), onExport: exportKpiPromedio },
            { onDetail: () => setShowKpiTasaDetail(true), onExport: exportKpiTasa },
          ];

          return (
            <Card key={stat.title}>
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">{stat.title}</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={kpiActions[index].onDetail}>
                        <Eye className="size-4 mr-2" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={kpiActions[index].onExport}>
                        <Download className="size-4 mr-2" />
                        Exportar a Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="flex items-center justify-between mb-3">
                  <div className={`${stat.bgColor} p-2 rounded-lg`}>
                    <Icon className={`size-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-semibold text-slate-900">
                    {stat.value}
                  </p>
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    stat.trend.isPositive ? "text-green-600" : "text-red-600"
                  }`}>
                    <TrendIcon className="size-3" />
                    <span>{stat.trend.value}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Actividad de Cobranzas</CardTitle>
                <p className="text-sm text-slate-600">
                  Recordatorios enviados vs pagos recibidos
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowActividadDetail(true)}>
                    <Eye className="size-4 mr-2" />
                    Ver detalle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportActividad}>
                    <Download className="size-4 mr-2" />
                    Exportar a Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={actividadCobranzas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="categoria"
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  key="recordatorios-bar"
                  dataKey="recordatorios"
                  fill="#3b82f6"
                  name="Recordatorios Enviados"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  key="pagos-bar"
                  dataKey="pagos"
                  fill="#10b981"
                  name="Pagos Recibidos"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Recaudación Diaria</CardTitle>
                <p className="text-sm text-slate-600">
                  Monto recaudado por día
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowRecaudacionDetail(true)}>
                    <Eye className="size-4 mr-2" />
                    Ver detalle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportRecaudacion}>
                    <Download className="size-4 mr-2" />
                    Exportar a Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={recaudacionDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="fecha"
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickFormatter={(value) => `${formatCurrency(value / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => `Bs. ${formatCurrency(value)}`}
                />
                <Legend />
                <Line
                  key="monto-line"
                  type="monotone"
                  dataKey="monto"
                  stroke="#10b981"
                  name="Monto Recaudado (Bs.)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#10b981" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Clientes */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Estado de Clientes</CardTitle>
              <p className="text-sm text-slate-600">
                Distribución de clientes por estado de pago
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEstadoClientesDetail(true)}>
                  <Eye className="size-4 mr-2" />
                  Ver detalle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportEstadoClientes}>
                  <Download className="size-4 mr-2" />
                  Exportar a Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {estadoClientes.map((item) => {
              const colors: Record<string, { bg: string; text: string; border: string }> = {
                Pendiente: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
                Pagado: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
                "En seguimiento": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
              };

              return (
                <div
                  key={item.estado}
                  className={`border-2 rounded-lg p-4 ${colors[item.estado].bg} ${colors[item.estado].border}`}
                >
                  <p className={`text-sm font-medium mb-2 ${colors[item.estado].text}`}>
                    {item.estado}
                  </p>
                  <p className="text-3xl font-semibold text-slate-900 mb-1">
                    {item.cantidad}
                  </p>
                  <p className={`text-xs ${colors[item.estado].text}`}>
                    {item.porcentaje}% del total
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>Resumen de Rendimiento</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowResumenDetail(true)}>
                  <Eye className="size-4 mr-2" />
                  Ver detalle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportResumenRendimiento}>
                  <Download className="size-4 mr-2" />
                  Exportar a Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Promedio de recaudación diaria</p>
              <p className="text-2xl font-semibold text-slate-900">
                Bs. {formatCurrency(121035)}
              </p>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <ArrowUp className="size-3" />
                <span>18% vs semana anterior</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Tiempo promedio de respuesta
              </p>
              <p className="text-2xl font-semibold text-slate-900">1.8 min</p>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <ArrowDown className="size-3" />
                <span>12% vs semana anterior</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Efectividad de recordatorios</p>
              <p className="text-2xl font-semibold text-slate-900">82.5%</p>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <ArrowUp className="size-3" />
                <span>7% vs semana anterior</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Detail Modals */}
      <DetailModal
        open={showActividadDetail}
        onOpenChange={setShowActividadDetail}
        title="Detalles de Actividad de Cobranzas"
        description="Datos desglosados de recordatorios y pagos por cliente"
        data={actividadDetailData}
      />

      <DetailModal
        open={showRecaudacionDetail}
        onOpenChange={setShowRecaudacionDetail}
        title="Detalles de Recaudación Diaria"
        description="Pagos recibidos por cliente con método de pago"
        data={recaudacionDetailData}
      />

      <DetailModal
        open={showEstadoClientesDetail}
        onOpenChange={setShowEstadoClientesDetail}
        title="Detalles de Estado de Clientes"
        description="Estado de cuenta y deudas por cliente"
        data={estadoClientesDetailData}
      />

      <DetailModal
        open={showResumenDetail}
        onOpenChange={setShowResumenDetail}
        title="Detalles de Resumen de Rendimiento"
        description="Métricas clave de rendimiento del agente de cobranzas"
        data={resumenDetailData}
      />

      <DetailModal
        open={showKpiRecordatoriosDetail}
        onOpenChange={setShowKpiRecordatoriosDetail}
        title="Detalles de Recordatorios Enviados"
        description="Resumen de recordatorios enviados por cliente"
        data={kpiRecordatoriosDetailData}
      />

      <DetailModal
        open={showKpiRecaudadoDetail}
        onOpenChange={setShowKpiRecaudadoDetail}
        title="Detalles de Recaudación"
        description="Monto recaudado por cliente"
        data={kpiRecaudadoDetailData}
      />

      <DetailModal
        open={showKpiPromedioDetail}
        onOpenChange={setShowKpiPromedioDetail}
        title="Detalles de Promedio de Pagos"
        description="Promedio de pagos realizados por cliente"
        data={kpiPromedioDetailData}
      />

      <DetailModal
        open={showKpiTasaDetail}
        onOpenChange={setShowKpiTasaDetail}
        title="Detalles de Tasa de Recuperación"
        description="Tasa de recuperación de pagos por cliente"
        data={kpiTasaDetailData}
      />
    </div>
  );
}