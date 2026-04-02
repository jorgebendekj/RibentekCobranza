import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Settings, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";

export default function Configuracion() {
  const [metaId, setMetaId] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    // Validación básica
    if (!metaId || !whatsappId || !accessToken) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    // Simular guardado
    setIsSaved(true);
    toast.success("Configuración guardada correctamente");

    // Reset estado después de 2 segundos
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return token;
    return token.substring(0, 4) + "•".repeat(token.length - 8) + token.substring(token.length - 4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">Configuración</h1>
        <p className="text-slate-600 mt-2">
          Gestiona la integración con WhatsApp Business
        </p>
      </div>

      {/* Configuración de WhatsApp */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-green-50 p-2 rounded-lg">
              <Settings className="size-5 text-green-600" />
            </div>
            <div>
              <CardTitle>Integración WhatsApp / Meta</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Estos datos permiten conectar el número desde el cual se enviarán los recordatorios de cobranzas
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meta ID */}
          <div className="space-y-2">
            <Label htmlFor="metaId">Meta ID</Label>
            <Input
              id="metaId"
              type="text"
              placeholder="Ej: 123456789012345"
              value={metaId}
              onChange={(e) => setMetaId(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              ID de tu aplicación en Meta Developer Console
            </p>
          </div>

          {/* WhatsApp Business ID */}
          <div className="space-y-2">
            <Label htmlFor="whatsappId">WhatsApp Business ID</Label>
            <Input
              id="whatsappId"
              type="text"
              placeholder="Ej: 987654321098765"
              value={whatsappId}
              onChange={(e) => setWhatsappId(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              ID de tu cuenta de WhatsApp Business
            </p>
          </div>

          {/* Access Token */}
          <div className="space-y-2">
            <Label htmlFor="accessToken">Token de Acceso</Label>
            <div className="relative">
              <Input
                id="accessToken"
                type={showToken ? "text" : "password"}
                placeholder="Ej: EAAxxxxxxxxxxxxxxxxxxxxxxxx"
                value={showToken ? accessToken : maskToken(accessToken)}
                onChange={(e) => setAccessToken(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showToken ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Token de acceso generado en Meta Developer Console
            </p>
          </div>

          {/* Botón de Guardar */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSave}
              className="min-w-[200px]"
              disabled={isSaved}
            >
              {isSaved ? (
                <>
                  <Check className="size-4 mr-2" />
                  Guardado
                </>
              ) : (
                "Guardar configuración"
              )}
            </Button>
            {isSaved && (
              <span className="text-sm text-green-600 font-medium">
                Configuración guardada correctamente
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">¿Cómo obtener estos datos?</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="font-semibold text-slate-900 min-w-[24px]">1.</span>
              <span>
                Accede a{" "}
                <a
                  href="https://developers.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Meta Developer Console
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-slate-900 min-w-[24px]">2.</span>
              <span>Crea una aplicación de WhatsApp Business</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-slate-900 min-w-[24px]">3.</span>
              <span>Copia el Meta ID desde la configuración de la aplicación</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-slate-900 min-w-[24px]">4.</span>
              <span>Obtén el WhatsApp Business ID desde la sección de WhatsApp</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-slate-900 min-w-[24px]">5.</span>
              <span>Genera un token de acceso con los permisos necesarios</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
