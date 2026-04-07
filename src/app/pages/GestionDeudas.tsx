import { useState, useMemo } from "react";
import {
  Search, Filter, Download, ChevronDown, ChevronUp, Calendar, FileText, Phone,
  User, DollarSign, ArrowUpDown, Users, CreditCard, Settings, Upload, Clock,
  MessageSquare, Plus, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Skeleton } from "../components/ui/skeleton";
import { ContactSelectorModal } from "../components/ContactSelectorModal";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useDebtDetails, useDebtsSummary } from "../hooks/useDebts";
import { useTemplates } from "../hooks/useWhatsapp";
import { useContacts } from "../hooks/useContacts";
import type { DebtStatus } from "../data/supabase.types";
import { DEBT_STATUS_LABELS } from "../data/supabase.types";

type VistaMode = "individual" | "agrupada";
type SendType = "automatico" | "manual";
type ReminderRule = { id: string; days: string; templateId: string };

const STATUS_OPTIONS: Array<{ value: DebtStatus | "all"; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "Pending", label: "Pendiente" },
  { value: "Active", label: "En Gestión" },
  { value: "Paid", label: "Pagada" },
  { value: "Expired", label: "Vencida" },
];

export function GestionDeudas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DebtStatus | "all">("all");
  const [sortBy, setSortBy] = useState<string>("expiration_date_desc");
  const [vistaMode, setVistaMode] = useState<VistaMode>("individual");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Modal
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

  // ── Data from Supabase ───────────────────────────────────
  const { data: debtDetails = [], isLoading: detailsLoading } = useDebtDetails({
    status: statusFilter,
    search: searchTerm,
    sortBy: sortBy as any,
  });
  const { data: summary, isLoading: summaryLoading } = useDebtsSummary();
  const { data: templates = [] } = useTemplates();
  const { data: contacts = [] } = useContacts();

  // ── Grouped view ─────────────────────────────────────────
  const clientesAgrupados = useMemo(() => {
    const map = new Map<string, {
      clienteId: string; cliente: string; telefono: string;
      cantidadDeudas: number; totalAdeudado: number; deudas: typeof debtDetails;
    }>();
    for (const d of debtDetails) {
      const cid = d.contact_id;
      if (!map.has(cid)) {
        map.set(cid, {
          clienteId: cid,
          cliente: d.contacts?.name ?? "—",
          telefono: d.contacts?.phone_number ?? "—",
          cantidadDeudas: 0,
          totalAdeudado: 0,
          deudas: [],
        });
      }
      const group = map.get(cid)!;
      group.cantidadDeudas++;
      group.totalAdeudado += Number(d.total);
      group.deudas.push(d);
    }
    return Array.from(map.values());
  }, [debtDetails]);

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Stats fallback ───────────────────────────────────────
  const stats = {
    totalDeudas: summary?.totalDeudas ?? debtDetails.length,
    totalAdeudado: summary?.totalAdeudado ?? debtDetails.reduce((s, d) => s + Number(d.total), 0),
    deudasVencidas: debtDetails.filter(d => d.debt_status === "Expired").length,
    clientesConDeuda: new Set(debtDetails.filter(d => d.debt_status !== "Paid").map(d => d.contact_id)).size,
  };

  const getEstadoBadge = (status: DebtStatus) => {
    const variants: Record<DebtStatus, string> = {
      Pending:  "bg-yellow-50 text-yellow-700 border-yellow-200",
      Active:   "bg-blue-50 text-blue-700 border-blue-200",
      Paid:     "bg-green-50 text-green-700 border-green-200",
      Expired:  "bg-red-50 text-red-700 border-red-200",
    };
    return <Badge variant="outline" className={variants[status]}>{DEBT_STATUS_LABELS[status]}</Badge>;
  };

  const fmt = (v: number) => v.toLocaleString("es-BO", { minimumFractionDigits: 0 });

  const exportToExcel = () => {
    const data = debtDetails.map(d => ({
      ID: d.id.slice(0, 8),
      Cliente: d.contacts?.name,
      Teléfono: d.contacts?.phone_number,
      Concepto: d.debt_description,
      "Monto (Bs.)": d.debt_amount,
      "Mora (Bs.)": d.penalty_amount,
      "Total (Bs.)": d.total,
      Estado: DEBT_STATUS_LABELS[d.debt_status],
      Vencimiento: d.expiration_date,
      "Días Vencido": d.days_overdue ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deudas");
    XLSX.writeFile(wb, `Deudas_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const downloadTemplate = () => {
    const tpl = [{ Nombre: "Juan Pérez", Teléfono: "+591 7123 4567", Monto: 5000, Concepto: "Factura #001", FechaVencimiento: "2026-04-15" }];
    const ws = XLSX.utils.json_to_sheet(tpl);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Deudas.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      setDebtPreview(XLSX.utils.sheet_to_json(ws).slice(0, 5));
    };
    reader.readAsBinaryString(file);
  };

  const handleCloseModal = () => {
    setShowCobranzasModal(false);
    setCurrentStep(1);
    setDebtPreview([]);
    setReminderMessage("");
  };

  const handleFinishFlow = () => {
    toast.success(`Recordatorios ${sendType === "manual" ? "enviados" : "programados"} correctamente`);
    handleCloseModal();
  };

  const addReminderRule = () =>
    setReminderRules(r => [...r, { id: String(Date.now()), days: "0", templateId: "" }]);
  const removeReminderRule = (id: string) =>
    setReminderRules(r => r.filter(x => x.id !== id));
  const updateReminderRule = (id: string, field: "days" | "templateId", value: string) =>
    setReminderRules(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl text-slate-900">Gestión de Deudas</h1>
          <p className="text-slate-600 mt-2">Administra y visualiza el estado de la cartera de deudas</p>
        </div>
        <Button onClick={() => setShowCobranzasModal(true)} size="lg">
          <Settings className="size-4 mr-2" />Gestionar cobranzas
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Deudas", value: stats.totalDeudas, Icon: FileText, color: "blue" },
          { label: "Total Adeudado", value: `Bs. ${fmt(stats.totalAdeudado)}`, Icon: DollarSign, color: "green" },
          { label: "Deudas Vencidas", value: stats.deudasVencidas, Icon: Calendar, color: "red" },
          { label: "Clientes con Deuda", value: stats.clientesConDeuda, Icon: Users, color: "purple" },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-600">{label}</p>
                <div className={`bg-${color}-50 p-2 rounded-lg`}>
                  <Icon className={`size-5 text-${color}-600`} />
                </div>
              </div>
              {(detailsLoading || summaryLoading) ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, teléfono o concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DebtStatus | "all")}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue placeholder="Ordenar por" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expiration_date_desc">Fecha (más reciente)</SelectItem>
                <SelectItem value="expiration_date_asc">Fecha (más antigua)</SelectItem>
                <SelectItem value="amount_desc">Monto (mayor)</SelectItem>
                <SelectItem value="amount_asc">Monto (menor)</SelectItem>
                <SelectItem value="name_asc">Cliente (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToExcel} variant="outline" className="w-full">
              <Download className="size-4 mr-2" />Exportar
            </Button>
          </div>

          {/* Vista toggle */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600 mr-2">Vista:</p>
            <Button variant={vistaMode === "individual" ? "default" : "outline"} size="sm" onClick={() => setVistaMode("individual")}>
              <FileText className="size-4 mr-2" />Individual
            </Button>
            <Button variant={vistaMode === "agrupada" ? "default" : "outline"} size="sm" onClick={() => setVistaMode("agrupada")}>
              <Users className="size-4 mr-2" />Agrupada por Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vista Individual */}
      {vistaMode === "individual" && (
        <Card>
          <CardHeader>
            <CardTitle>Listado de Deudas</CardTitle>
            <p className="text-sm text-slate-600">Mostrando {debtDetails.length} deudas</p>
          </CardHeader>
          <CardContent>
            {detailsLoading ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["Cliente", "Teléfono", "Concepto", "Monto", "Total", "Estado", "Vencimiento"].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-sm font-medium text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {debtDetails.map(d => (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-900">{d.contacts?.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Phone className="size-4 text-slate-400" />
                            <span className="text-sm text-slate-600">{d.contacts?.phone_number ?? "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">{d.debt_description ?? "—"}</td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right">Bs. {fmt(d.debt_amount)}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900 text-right">Bs. {fmt(d.total)}</td>
                        <td className="py-3 px-4">{getEstadoBadge(d.debt_status)}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            <p className="text-slate-900">{d.expiration_date}</p>
                            {(d.days_overdue ?? 0) > 0 && (
                              <p className="text-red-600 text-xs">{d.days_overdue} días vencidos</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {debtDetails.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No se encontraron deudas</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vista Agrupada */}
      {vistaMode === "agrupada" && (
        <Card>
          <CardHeader>
            <CardTitle>Deudas Agrupadas por Cliente</CardTitle>
            <p className="text-sm text-slate-600">Mostrando {clientesAgrupados.length} clientes</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientesAgrupados.map(c => {
                const isExpanded = expandedClients.has(c.clienteId);
                return (
                  <div key={c.clienteId} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div
                      className="bg-slate-50 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => toggleClient(c.clienteId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="bg-blue-100 p-3 rounded-lg"><User className="size-6 text-blue-600" /></div>
                          <div>
                            <h3 className="font-medium text-slate-900">{c.cliente}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="size-3 text-slate-400" />
                              <p className="text-sm text-slate-600">{c.telefono}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-slate-600">Deudas</p>
                            <p className="font-semibold text-slate-900">{c.cantidadDeudas}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-600">Total Adeudado</p>
                            <p className="font-semibold text-lg text-slate-900">Bs. {fmt(c.totalAdeudado)}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="size-5 text-slate-400" /> : <ChevronDown className="size-5 text-slate-400" />}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-4 bg-white overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200">
                              {["Concepto", "Monto", "Total", "Estado", "Vencimiento"].map(h => (
                                <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-600">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.deudas.map(d => (
                              <tr key={d.id} className="border-b border-slate-100">
                                <td className="py-2 px-3 text-sm text-slate-600">{d.debt_description ?? "—"}</td>
                                <td className="py-2 px-3 text-sm text-slate-900 text-right">Bs. {fmt(d.debt_amount)}</td>
                                <td className="py-2 px-3 text-sm font-medium text-slate-900 text-right">Bs. {fmt(d.total)}</td>
                                <td className="py-2 px-3">{getEstadoBadge(d.debt_status)}</td>
                                <td className="py-2 px-3">
                                  <div className="text-sm">
                                    <p className="text-slate-900">{d.expiration_date}</p>
                                    {(d.days_overdue ?? 0) > 0 && (
                                      <p className="text-red-600 text-xs">{d.days_overdue} días vencidos</p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gestionar Cobranzas Modal */}
      <Dialog open={showCobranzasModal} onOpenChange={(o) => !o && handleCloseModal()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Cobranzas</DialogTitle>
            <DialogDescription>
              {currentStep === 1 ? "Paso 1: Cargar deudas" : "Paso 2: Configurar recordatorio"}
            </DialogDescription>
          </DialogHeader>

          {currentStep === 1 ? (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <Upload className="size-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 mb-4">Arrastra un archivo Excel o haz clic para seleccionar</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={downloadTemplate} size="sm">
                    <Download className="size-4 mr-2" />Descargar plantilla
                  </Button>
                  <label>
                    <Button size="sm" asChild>
                      <span><Upload className="size-4 mr-2" />Subir archivo</span>
                    </Button>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
              {debtPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Vista previa (primeras 5 filas):</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>{Object.keys(debtPreview[0]).map(k => <th key={k} className="p-2 text-left">{k}</th>)}</tr>
                      </thead>
                      <tbody>
                        {debtPreview.map((row, i) => (
                          <tr key={i} className="border-t">
                            {Object.values(row).map((v, j) => <td key={j} className="p-2">{String(v)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Send Type */}
              <div className="space-y-3">
                <Label>Tipo de envío</Label>
                <RadioGroup value={sendType} onValueChange={(v) => setSendType(v as SendType)} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="automatico" id="auto" /><Label htmlFor="auto">Automático</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="manual" id="manual" /><Label htmlFor="manual">Manual</Label></div>
                </RadioGroup>
              </div>

              {sendType === "manual" && (
                <div className="space-y-2">
                  <Label>Mensaje personalizado</Label>
                  <textarea
                    className="w-full min-h-[100px] border border-slate-200 rounded-md p-3 text-sm"
                    placeholder="Escribe tu mensaje aquí..."
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                  />
                </div>
              )}

              {sendType === "automatico" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Reglas de recordatorio</Label>
                    <Button size="sm" variant="outline" onClick={addReminderRule}>
                      <Plus className="size-4 mr-1" />Agregar regla
                    </Button>
                  </div>
                  {reminderRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Días (negativo = antes del vencimiento)</Label>
                          <Input
                            type="number"
                            value={rule.days}
                            onChange={(e) => updateReminderRule(rule.id, "days", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Plantilla Meta</Label>
                          <Select value={rule.templateId} onValueChange={(v) => updateReminderRule(rule.id, "templateId", v)}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar plantilla" /></SelectTrigger>
                            <SelectContent>
                              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {reminderRules.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => removeReminderRule(rule.id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Target */}
              <div className="space-y-3">
                <Label>Destinatarios</Label>
                <RadioGroup value={reminderTarget} onValueChange={(v) => setReminderTarget(v as any)} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="todos" id="todos" /><Label htmlFor="todos">Todos los clientes</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="lista" id="lista" /><Label htmlFor="lista">Lista específica</Label></div>
                </RadioGroup>
                {reminderTarget === "lista" && (
                  <Button variant="outline" onClick={() => setShowContactSelector(true)}>
                    <Users className="size-4 mr-2" />
                    Seleccionar contactos ({selectedContactIds.length} seleccionados)
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
            {currentStep === 1 ? (
              <Button onClick={() => debtPreview.length > 0 && setCurrentStep(2)} disabled={debtPreview.length === 0}>
                Siguiente
              </Button>
            ) : (
              <Button onClick={handleFinishFlow}>
                {sendType === "manual" ? "Enviar ahora" : "Programar recordatorios"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Selector */}
      <ContactSelectorModal
        open={showContactSelector}
        onOpenChange={setShowContactSelector}
        contacts={contacts.map(c => ({ id: c.id, nombre: c.name, telefono: c.phone_number ?? "", email: c.email ?? "" }))}
        selectedContactIds={selectedContactIds}
        onSelectedContactIdsChange={setSelectedContactIds}
      />
    </div>
  );
}