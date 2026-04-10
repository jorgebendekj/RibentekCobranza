import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Search, Filter, Download, ChevronDown, ChevronUp, Calendar, FileText, Phone,
  User, DollarSign, Users, Settings,
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
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { ContactSelectorModal } from "../components/ContactSelectorModal";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useDebtDetails, useDebtsSummary } from "../hooks/useDebts";
import { useCreateMassSend, useMassSends, usePreviewMassSend, useRunMassSend, useTemplates } from "../hooks/useWhatsapp";
import { useContacts } from "../hooks/useContacts";
import type { DebtStatus } from "../data/supabase.types";
import { DEBT_STATUS_LABELS } from "../data/supabase.types";
import { Checkbox } from "../components/ui/checkbox";

type VistaMode = "individual" | "agrupada";
type MassStep = 1 | 2 | 3 | 4 | 5;

const STATUS_OPTIONS: Array<{ value: DebtStatus | "all"; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "Pending", label: "Pendiente" },
  { value: "Active", label: "En Gestión" },
  { value: "Paid", label: "Pagada" },
  { value: "Expired", label: "Vencida" },
];

export function GestionDeudas() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DebtStatus | "all">("all");
  const [sortBy, setSortBy] = useState<string>("expiration_date_desc");
  const [vistaMode, setVistaMode] = useState<VistaMode>("individual");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Wizard de envíos masivos
  const [showCobranzasModal, setShowCobranzasModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<MassStep>(1);
  const [massSendName, setMassSendName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [language, setLanguage] = useState("es_LA");
  const [massSendMode, setMassSendMode] = useState<"manual" | "scheduled">("manual");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [minDaysOverdue, setMinDaysOverdue] = useState<string>("");
  const [maxDaysOverdue, setMaxDaysOverdue] = useState<string>("");
  const [minAmountDue, setMinAmountDue] = useState<string>("");
  const [maxAmountDue, setMaxAmountDue] = useState<string>("");
  const [debtStatusForSend, setDebtStatusForSend] = useState<string>("");
  const [showIncludeSelector, setShowIncludeSelector] = useState(false);
  const [showExcludeSelector, setShowExcludeSelector] = useState(false);
  const [includedContactIds, setIncludedContactIds] = useState<string[]>([]);
  const [excludedContactIds, setExcludedContactIds] = useState<string[]>([]);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [createdMassSendId, setCreatedMassSendId] = useState<string | null>(null);

  // ── Data from Supabase ───────────────────────────────────
  const { data: debtDetails = [], isLoading: detailsLoading } = useDebtDetails({
    status: statusFilter,
    search: searchTerm,
    sortBy: sortBy as any,
  });
  const { data: summary, isLoading: summaryLoading } = useDebtsSummary();
  const { data: templates = [] } = useTemplates();
  const { data: contacts = [] } = useContacts();
  const { data: massSends = [] } = useMassSends();
  const previewMutation = usePreviewMassSend();
  const createMutation = useCreateMassSend();
  const runMutation = useRunMassSend();

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

  const massFilters = useMemo(() => ({
    min_days_overdue: minDaysOverdue ? Number(minDaysOverdue) : null,
    max_days_overdue: maxDaysOverdue ? Number(maxDaysOverdue) : null,
    min_amount_due: minAmountDue ? Number(minAmountDue) : null,
    max_amount_due: maxAmountDue ? Number(maxAmountDue) : null,
    debt_status: debtStatusForSend || null,
  }), [debtStatusForSend, maxAmountDue, maxDaysOverdue, minAmountDue, minDaysOverdue]);

  const massStepProgress = Math.round((currentStep / 5) * 100);

  const handleCloseModal = () => {
    setShowCobranzasModal(false);
    setCurrentStep(1);
    setMassSendName("");
    setTemplateId("");
    setLanguage("es_LA");
    setMassSendMode("manual");
    setCronExpression("0 9 * * *");
    setMinDaysOverdue("");
    setMaxDaysOverdue("");
    setMinAmountDue("");
    setMaxAmountDue("");
    setDebtStatusForSend("");
    setIncludedContactIds([]);
    setExcludedContactIds([]);
    setConfirmChecked(false);
    setCreatedMassSendId(null);
    previewMutation.reset();
  };

  const validateStep = (step: MassStep) => {
    if (step === 1) {
      if (!massSendName.trim()) {
        toast.error("Define un nombre para el envío.");
        return false;
      }
      if (!templateId) {
        toast.error("Selecciona una plantilla aprobada.");
        return false;
      }
      if (massSendMode === "scheduled" && !cronExpression.trim()) {
        toast.error("La expresión cron es obligatoria en modo programado.");
        return false;
      }
    }
    if (step === 4 && !previewMutation.data) {
      toast.error("Debes generar la vista previa antes de continuar.");
      return false;
    }
    if (step === 5 && !confirmChecked) {
      toast.error("Confirma la revisión final para ejecutar.");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(5, (prev + 1) as MassStep));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(1, (prev - 1) as MassStep));

  const runPreview = () => {
    previewMutation.mutate(massFilters, {
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const effectiveTotalRecipients = Math.max(
    0,
    (previewMutation.data?.total_recipients || 0) + includedContactIds.length - excludedContactIds.length
  );

  const executeMassSend = () => {
    if (!validateStep(5)) return;
    createMutation.mutate({
      name: massSendName.trim(),
      template_id: templateId,
      language,
      filters: {
        ...massFilters,
        included_contact_ids: includedContactIds,
        excluded_contact_ids: excludedContactIds,
      } as unknown as Record<string, unknown>,
      mode: massSendMode,
      schedule: massSendMode === "scheduled"
        ? { cron_expression: cronExpression.trim(), timezone: "America/Bogota", enabled: true }
        : null,
    }, {
      onSuccess: ({ mass_send }) => {
        setCreatedMassSendId(mass_send.id);
        if (massSendMode === "manual") {
          runMutation.mutate(mass_send.id, {
            onSuccess: (runResult) => {
              toast.success(`Envío ejecutado. Sent: ${runResult.summary.sent}, failed: ${runResult.summary.failed}, skipped: ${runResult.summary.skipped}`);
              handleCloseModal();
            },
            onError: (err) => toast.error((err as Error).message),
          });
          return;
        }
        toast.success("Envío programado correctamente.");
        handleCloseModal();
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

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

      {/* Gestión de envíos masivos con stepper */}
      <Dialog open={showCobranzasModal} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Envíos masivos desde Gestión de Deudas</DialogTitle>
            <DialogDescription>
              Paso {currentStep} de 5 · flujo híbrido con filtros y selección manual de contactos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Progress value={massStepProgress} />
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((step) => (
                <Badge key={step} variant={currentStep === step ? "default" : "outline"}>
                  {step === 1 ? "Plantilla" : step === 2 ? "Filtros" : step === 3 ? "Audiencia" : step === 4 ? "Preview" : "Confirmar"}
                </Badge>
              ))}
            </div>
          </div>

          {currentStep === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mass-send-name">Nombre del envío</Label>
                <Input
                  id="mass-send-name"
                  value={massSendName}
                  onChange={(e) => setMassSendName(e.target.value)}
                  placeholder="Mora vencida - segmento alto riesgo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mass-template">Plantilla aprobada</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="mass-template"><SelectValue placeholder="Selecciona plantilla" /></SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((template) => String(template.meta_status).toUpperCase() === "APPROVED")
                      .map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.template_name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mass-language">Idioma</Label>
                <Input id="mass-language" value={language} onChange={(e) => setLanguage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mass-mode">Modo</Label>
                <Select value={massSendMode} onValueChange={(v) => setMassSendMode(v as "manual" | "scheduled")}>
                  <SelectTrigger id="mass-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (ejecutar ahora)</SelectItem>
                    <SelectItem value="scheduled">Programado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {massSendMode === "scheduled" ? (
                <div className="space-y-2">
                  <Label htmlFor="mass-cron">Expresión cron</Label>
                  <Input id="mass-cron" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} placeholder="0 9 * * *" />
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mínimo días mora</Label>
                <Input type="number" value={minDaysOverdue} onChange={(e) => setMinDaysOverdue(e.target.value)} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Máximo días mora</Label>
                <Input type="number" value={maxDaysOverdue} onChange={(e) => setMaxDaysOverdue(e.target.value)} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Mínimo monto pendiente</Label>
                <Input type="number" value={minAmountDue} onChange={(e) => setMinAmountDue(e.target.value)} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Máximo monto pendiente</Label>
                <Input type="number" value={maxAmountDue} onChange={(e) => setMaxAmountDue(e.target.value)} min={0} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Estado de deuda (opcional)</Label>
                <Select value={debtStatusForSend || "all"} onValueChange={(v) => setDebtStatusForSend(v === "all" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowIncludeSelector(true)}>
                  Seleccionar inclusiones ({includedContactIds.length})
                </Button>
                <Button variant="outline" onClick={() => setShowExcludeSelector(true)}>
                  Seleccionar exclusiones ({excludedContactIds.length})
                </Button>
                <Button onClick={runPreview} disabled={previewMutation.isPending}>
                  {previewMutation.isPending ? "Calculando..." : "Actualizar preview"}
                </Button>
              </div>
              <div className="rounded-md border p-3 text-sm text-slate-600">
                <p>Base por filtros: <span className="font-medium">{previewMutation.data?.total_recipients ?? 0}</span></p>
                <p>Incluir manual: <span className="font-medium">{includedContactIds.length}</span></p>
                <p>Excluir manual: <span className="font-medium">{excludedContactIds.length}</span></p>
                <p>Total final estimado: <span className="font-semibold">{effectiveTotalRecipients}</span></p>
              </div>
              {previewMutation.data?.sample?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Muestra de destinatarios por filtro</p>
                  <div className="max-h-56 overflow-y-auto border rounded-md">
                    {previewMutation.data.sample.map((item) => (
                      <div key={item.contact_id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm">{item.contact_name}</p>
                          <p className="text-xs text-slate-500">{item.phone_number}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`exclude-${item.contact_id}`} className="text-xs text-slate-500">Excluir</Label>
                          <Checkbox
                            id={`exclude-${item.contact_id}`}
                            checked={excludedContactIds.includes(item.contact_id)}
                            onCheckedChange={(checked) => {
                              setExcludedContactIds((prev) =>
                                checked ? Array.from(new Set([...prev, item.contact_id])) : prev.filter((id) => id !== item.contact_id)
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No hay preview generado todavía.</p>
              )}
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="space-y-3">
              <Button onClick={runPreview} disabled={previewMutation.isPending}>
                {previewMutation.isPending ? "Recalculando..." : "Revalidar preview"}
              </Button>
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>Envío: <span className="font-medium">{massSendName || "—"}</span></p>
                <p>Plantilla: <span className="font-medium">{templates.find((template) => template.id === templateId)?.template_name || "—"}</span></p>
                <p>Modo: <span className="font-medium">{massSendMode === "manual" ? "Manual" : "Programado"}</span></p>
                <p>Total final estimado: <span className="font-semibold">{effectiveTotalRecipients}</span></p>
                {effectiveTotalRecipients <= 0 ? (
                  <p className="text-amber-700">Advertencia: no hay destinatarios estimados para enviar.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>Nombre: <span className="font-medium">{massSendName}</span></p>
                <p>Destinatarios estimados: <span className="font-medium">{effectiveTotalRecipients}</span></p>
                <p>Incluidos manualmente: <span className="font-medium">{includedContactIds.length}</span></p>
                <p>Excluidos manualmente: <span className="font-medium">{excludedContactIds.length}</span></p>
                <p>Modo: <span className="font-medium">{massSendMode === "manual" ? "Manual (ejecución inmediata)" : "Programado"}</span></p>
                {massSendMode === "scheduled" ? <p>Cron: <span className="font-mono">{cronExpression}</span></p> : null}
                {createdMassSendId ? <p>ID creado: <span className="font-mono">{createdMassSendId}</span></p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="confirm-final-send" checked={confirmChecked} onCheckedChange={(checked) => setConfirmChecked(Boolean(checked))} />
                <Label htmlFor="confirm-final-send">Confirmo que revisé filtros, audiencia y plantilla antes de ejecutar.</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/mensajeria/dashboard")}>Ver impacto en dashboard</Button>
                <Button variant="outline" onClick={() => navigate("/bandeja")}>Ir a Bandeja</Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
            {currentStep > 1 ? (
              <Button variant="outline" onClick={prevStep}>Anterior</Button>
            ) : null}
            {currentStep < 5 ? (
              <Button onClick={nextStep}>Siguiente</Button>
            ) : (
              <Button
                onClick={executeMassSend}
                disabled={createMutation.isPending || runMutation.isPending || !confirmChecked}
              >
                {createMutation.isPending || runMutation.isPending
                  ? "Procesando..."
                  : massSendMode === "manual"
                    ? "Crear y ejecutar"
                    : "Crear y programar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactSelectorModal
        open={showIncludeSelector}
        onOpenChange={setShowIncludeSelector}
        contacts={contacts.map((contact) => ({ id: contact.id, nombre: contact.name, telefono: contact.phone_number ?? "", email: contact.email ?? "" }))}
        selectedContactIds={includedContactIds}
        onSelectedContactIdsChange={setIncludedContactIds}
      />

      <ContactSelectorModal
        open={showExcludeSelector}
        onOpenChange={setShowExcludeSelector}
        contacts={contacts.map((contact) => ({ id: contact.id, nombre: contact.name, telefono: contact.phone_number ?? "", email: contact.email ?? "" }))}
        selectedContactIds={excludedContactIds}
        onSelectedContactIdsChange={setExcludedContactIds}
      />
    </div>
  );
}