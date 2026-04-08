import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Settings, Eye, EyeOff, Check, RefreshCw, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useWhatsappConfig,
  useSaveWhatsappConfig,
  useTemplates,
  useCreateMetaTemplate,
  useSyncMetaTemplates,
} from "../hooks/useWhatsapp";

type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

export default function Configuracion() {
  const { data: config, isLoading } = useWhatsappConfig();
  const { data: templates = [], isLoading: isTemplatesLoading } = useTemplates();
  const saveConfig = useSaveWhatsappConfig();
  const createTemplate = useCreateMetaTemplate();
  const syncTemplates = useSyncMetaTemplates();

  const getInitial = (key: string) => sessionStorage.getItem(`config_draft_${key}`) ?? "";
  const [metaId, setMetaId] = useState(getInitial("metaId"));
  const [channelName, setChannelName] = useState(getInitial("channelName"));
  const [wabaId, setWabaId] = useState(getInitial("wabaId"));
  const [phoneNumberId, setPhoneNumberId] = useState(getInitial("phoneNumberId"));
  const [verifyToken, setVerifyToken] = useState(getInitial("verifyToken"));
  const [defaultTemplateLanguage, setDefaultTemplateLanguage] = useState(getInitial("defaultTemplateLanguage") || "es_LA");
  const [accessToken, setAccessToken] = useState(getInitial("accessToken"));
  const [showToken, setShowToken] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("es_LA");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>("UTILITY");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");

  const placeholders = useMemo(() => {
    const matches = bodyText.match(/\{\{\d+\}\}/g) ?? [];
    return [...new Set(matches)];
  }, [bodyText]);

  const placeholderValidation = useMemo(() => {
    if (placeholders.length === 0) return { ok: true, message: "Sin variables dinámicas" };
    const nums = placeholders
      .map((ph) => Number(ph.replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const expected = Array.from({ length: nums.length }, (_, i) => i + 1);
    const ok = nums.length === expected.length && nums.every((n, i) => n === expected[i]);
    return {
      ok,
      message: ok
        ? `Variables válidas: ${placeholders.join(", ")}`
        : "Variables inválidas. Deben ser consecutivas: {{1}}, {{2}}, {{3}}...",
    };
  }, [placeholders]);

  // Initialize form once when config is successfully loaded
  useEffect(() => {
    if (config && !isInitialized) {
      if (!sessionStorage.getItem("config_draft_metaId")) setMetaId(config.meta_id);
      if (!sessionStorage.getItem("config_draft_channelName")) setChannelName(config.channel_name ?? "");
      if (!sessionStorage.getItem("config_draft_wabaId")) setWabaId(config.waba_id);
      if (!sessionStorage.getItem("config_draft_phoneNumberId")) setPhoneNumberId(config.phone_number_id ?? "");
      if (!sessionStorage.getItem("config_draft_verifyToken")) setVerifyToken(config.verify_token ?? "");
      if (!sessionStorage.getItem("config_draft_defaultTemplateLanguage")) setDefaultTemplateLanguage(config.default_template_language ?? "es_LA");
      if (!sessionStorage.getItem("config_draft_accessToken")) setAccessToken(config.token);
      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  // Sync to session storage on change
  useEffect(() => { sessionStorage.setItem("config_draft_metaId", metaId); }, [metaId]);
  useEffect(() => { sessionStorage.setItem("config_draft_channelName", channelName); }, [channelName]);
  useEffect(() => { sessionStorage.setItem("config_draft_wabaId", wabaId); }, [wabaId]);
  useEffect(() => { sessionStorage.setItem("config_draft_phoneNumberId", phoneNumberId); }, [phoneNumberId]);
  useEffect(() => { sessionStorage.setItem("config_draft_verifyToken", verifyToken); }, [verifyToken]);
  useEffect(() => { sessionStorage.setItem("config_draft_defaultTemplateLanguage", defaultTemplateLanguage); }, [defaultTemplateLanguage]);
  useEffect(() => { sessionStorage.setItem("config_draft_accessToken", accessToken); }, [accessToken]);
  const handleSave = () => {
    if (!metaId || !wabaId || !phoneNumberId || !verifyToken || !accessToken) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    saveConfig.mutate(
      {
        channel_name: channelName || undefined,
        meta_id: metaId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        verify_token: verifyToken,
        default_template_language: defaultTemplateLanguage || "es_LA",
        token: accessToken
      },
      {
        onSuccess: () => {
          sessionStorage.removeItem("config_draft_metaId");
          sessionStorage.removeItem("config_draft_channelName");
          sessionStorage.removeItem("config_draft_wabaId");
          sessionStorage.removeItem("config_draft_phoneNumberId");
          sessionStorage.removeItem("config_draft_verifyToken");
          sessionStorage.removeItem("config_draft_defaultTemplateLanguage");
          sessionStorage.removeItem("config_draft_accessToken");
          toast.success("Configuración validada con Meta y guardada correctamente");
        },
        onError: (err) => toast.error(`Error al guardar: ${err.message}`),
      }
    );
  };

  const handleCreateTemplate = () => {
    if (!templateName.trim() || !bodyText.trim()) {
      toast.error("Nombre y cuerpo de plantilla son obligatorios");
      return;
    }
    if (!placeholderValidation.ok) {
      toast.error(placeholderValidation.message);
      return;
    }

    const components: Array<Record<string, unknown>> = [];
    if (headerText.trim()) components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
    components.push({ type: "BODY", text: bodyText.trim() });
    if (footerText.trim()) components.push({ type: "FOOTER", text: footerText.trim() });

    createTemplate.mutate(
      {
        name: templateName.trim(),
        language: templateLanguage,
        category: templateCategory,
        components,
        args: placeholders,
      },
      {
        onSuccess: () => {
          toast.success("Plantilla enviada a Meta correctamente");
          setTemplateName("");
          setHeaderText("");
          setBodyText("");
          setFooterText("");
        },
        onError: (err) => toast.error(`Error creando plantilla: ${err.message}`),
      }
    );
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return token;
    return token.substring(0, 4) + "•".repeat(Math.min(token.length - 8, 20)) + token.substring(token.length - 4);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">Configuración</h1>
        <p className="text-slate-600 mt-2">Gestiona la integración con WhatsApp Business</p>
      </div>
      <Tabs defaultValue="credenciales" className="max-w-5xl">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="credenciales">Credenciales</TabsTrigger>
          <TabsTrigger value="mensajes">Gestor de Mensajes</TabsTrigger>
        </TabsList>

        <TabsContent value="credenciales" className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-2 rounded-lg">
                  <Settings className="size-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Integración WhatsApp / Meta</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Estos datos permiten conectar el número desde el cual se enviarán los recordatorios
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="channelName">Nombre del canal (opcional)</Label>
                    <Input id="channelName" placeholder="Ej: WhatsApp Cobranza Principal" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metaId">Facebook App ID</Label>
                    <Input id="metaId" placeholder="Ej: 123456789012345" value={metaId} onChange={(e) => setMetaId(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
                    <Input id="wabaId" placeholder="Ej: 987654321098765" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Input id="phoneNumberId" placeholder="Ej: 123456789012345" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="verifyToken">Webhook Verify Token</Label>
                    <Input id="verifyToken" placeholder="Token definido al suscribir el webhook en Meta" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultTemplateLanguage">Idioma por defecto de plantillas</Label>
                    <Input id="defaultTemplateLanguage" placeholder="es_LA" value={defaultTemplateLanguage} onChange={(e) => setDefaultTemplateLanguage(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Token de Acceso</Label>
                    <div className="relative">
                      <Input
                        id="accessToken"
                        type={showToken ? "text" : "password"}
                        placeholder="Ej: EAAxxxxxxxxxxxxxxxx"
                        value={showToken ? accessToken : maskToken(accessToken)}
                        onChange={(e) => setAccessToken(e.target.value)}
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={handleSave} className="min-w-[200px]" disabled={saveConfig.isPending}>
                      {saveConfig.isPending ? "Guardando..." : saveConfig.isSuccess ? <><Check className="size-4 mr-2" />Guardado</> : "Guardar configuración"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mensajes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Template Builder</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => syncTemplates.mutate(undefined, {
                    onSuccess: (r) => toast.success(`Sincronizadas: ${r.synced}`),
                    onError: (e) => toast.error(e.message),
                  })}
                  disabled={syncTemplates.isPending}
                >
                  <RefreshCw className="size-4 mr-2" />
                  {syncTemplates.isPending ? "Sincronizando..." : "Sync Meta"}
                </Button>
                <Button onClick={handleCreateTemplate} disabled={createTemplate.isPending}>
                  <PlusCircle className="size-4 mr-2" />
                  {createTemplate.isPending ? "Enviando..." : "Crear plantilla"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nombre de plantilla</Label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="recordatorio_pago_1" />
                </div>
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Input value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} placeholder="es_LA" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["UTILITY", "MARKETING", "AUTHENTICATION"] as TemplateCategory[]).map((c) => (
                    <Button key={c} type="button" variant={templateCategory === c ? "default" : "outline"} onClick={() => setTemplateCategory(c)}>
                      {c}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Header (opcional)</Label>
                <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="Recordatorio de pago" />
              </div>

              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Hola {{1}}, tu deuda de {{2}} vence el {{3}}."
                  className="min-h-28"
                />
                <div className={`text-xs ${placeholderValidation.ok ? "text-green-600" : "text-red-600"}`}>
                  {placeholderValidation.message}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Footer (opcional)</Label>
                <Textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Ribentek AI Cobranzas" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plantillas registradas</CardTitle>
            </CardHeader>
            <CardContent>
              {isTemplatesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-500">No hay plantillas registradas todavía.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{t.template_name}</p>
                        <p className="text-xs text-slate-500">{t.language} · {t.category}</p>
                      </div>
                      <Badge
                        className={
                          t.meta_status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : t.meta_status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }
                      >
                        {t.meta_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
