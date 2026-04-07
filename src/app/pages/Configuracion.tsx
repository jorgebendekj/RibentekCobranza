import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Settings, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { useWhatsappConfig, useSaveWhatsappConfig } from "../hooks/useWhatsapp";

export default function Configuracion() {
  const { data: config, isLoading } = useWhatsappConfig();
  const saveConfig = useSaveWhatsappConfig();

  const getInitial = (key: string) => sessionStorage.getItem(`config_draft_${key}`) ?? "";
  const [metaId, setMetaId] = useState(getInitial("metaId"));
  const [wabaId, setWabaId] = useState(getInitial("wabaId"));
  const [accessToken, setAccessToken] = useState(getInitial("accessToken"));
  const [showToken, setShowToken] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form once when config is successfully loaded
  useEffect(() => {
    if (config && !isInitialized) {
      if (!sessionStorage.getItem("config_draft_metaId")) setMetaId(config.meta_id);
      if (!sessionStorage.getItem("config_draft_wabaId")) setWabaId(config.waba_id);
      if (!sessionStorage.getItem("config_draft_accessToken")) setAccessToken(config.token);
      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  // Sync to session storage on change
  useEffect(() => { sessionStorage.setItem("config_draft_metaId", metaId); }, [metaId]);
  useEffect(() => { sessionStorage.setItem("config_draft_wabaId", wabaId); }, [wabaId]);
  useEffect(() => { sessionStorage.setItem("config_draft_accessToken", accessToken); }, [accessToken]);
  const handleSave = () => {
    if (!metaId || !wabaId || !accessToken) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    saveConfig.mutate(
      { meta_id: metaId, waba_id: wabaId, token: accessToken },
      {
        onSuccess: () => {
          sessionStorage.removeItem("config_draft_metaId");
          sessionStorage.removeItem("config_draft_wabaId");
          sessionStorage.removeItem("config_draft_accessToken");
          toast.success("Configuración guardada correctamente");
        },
        onError: (err) => toast.error(`Error al guardar: ${err.message}`),
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
              {/* Meta ID */}
              <div className="space-y-2">
                <Label htmlFor="metaId">Meta ID</Label>
                <Input
                  id="metaId"
                  placeholder="Ej: 123456789012345"
                  value={metaId}
                  onChange={(e) => setMetaId(e.target.value)}
                />
                <p className="text-xs text-slate-500">ID de tu aplicación en Meta Developer Console</p>
              </div>

              {/* WhatsApp Business ID */}
              <div className="space-y-2">
                <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
                <Input
                  id="wabaId"
                  placeholder="Ej: 987654321098765"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                />
                <p className="text-xs text-slate-500">ID de tu cuenta de WhatsApp Business</p>
              </div>

              {/* Access Token */}
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
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Token de acceso permanente de Meta Developer Console</p>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  className="min-w-[200px]"
                  disabled={saveConfig.isPending}
                >
                  {saveConfig.isPending ? (
                    "Guardando..."
                  ) : saveConfig.isSuccess ? (
                    <><Check className="size-4 mr-2" />Guardado</>
                  ) : (
                    "Guardar configuración"
                  )}
                </Button>
                {saveConfig.isSuccess && (
                  <span className="text-sm text-green-600 font-medium">
                    Configuración guardada correctamente
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Help card (static) */}
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">¿Cómo obtener estos datos?</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-slate-600">
            {[
              <>Accede a <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta Developer Console</a></>,
              "Crea o selecciona una aplicación de WhatsApp Business",
              "Copia el Meta ID desde la configuración de la aplicación",
              "Obtén el WhatsApp Business ID desde la sección de WhatsApp",
              "Genera un token de acceso permanente con los permisos necesarios",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-semibold text-slate-900 min-w-[24px]">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
