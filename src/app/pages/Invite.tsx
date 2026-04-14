import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../../lib/supabase";
import { getAdminApiBase } from "../services/admin.service";

type InviteState = "checking" | "invalid" | "ready" | "accepting" | "accepted";

export default function InvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get("token"), [params]);
  const [state, setState] = useState<InviteState>("checking");
  const [message, setMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ tenantName: string; email: string; role: string } | null>(null);
  const [startingGoogle, setStartingGoogle] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setMessage("Token de invitación inválido.");
      return;
    }

    fetch(`${getAdminApiBase()}/invites/${token}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Invitación inválida");
        setInviteInfo(payload);
        setState("ready");
      })
      .catch((err: Error) => {
        setState("invalid");
        setMessage(err.message);
      });
  }, [token]);

  const acceptInvite = async () => {
    if (!token) return;
    setState("accepting");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      navigate(`/login?next=/invite?token=${token}`, { replace: true });
      return;
    }

    const res = await fetch(`${getAdminApiBase()}/invites/${token}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await res.json();
    if (!res.ok) {
      setState("invalid");
      setMessage(payload.error ?? "No se pudo aceptar la invitación");
      return;
    }
    if (payload.tenant_id) {
      window.localStorage.setItem("aicobranzas-active-workspace", payload.tenant_id);
    }
    setState("accepted");
    setTimeout(() => navigate("/cobranzas", { replace: true }), 1200);
  };

  const continueWithGoogle = async () => {
    if (!token) return;
    setStartingGoogle(true);
    const redirectTo = `${window.location.origin}/invite?token=${token}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setStartingGoogle(false);
      setMessage(error.message);
      setState("invalid");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-center">
        {state === "checking" && <><Loader2 className="size-10 mx-auto animate-spin text-blue-600" /><h1 className="text-xl font-semibold">Validando invitación...</h1></>}
        {state === "invalid" && <><XCircle className="size-10 mx-auto text-red-500" /><h1 className="text-xl font-semibold">Invitación inválida</h1><p className="text-sm text-slate-600">{message}</p><Button className="w-full" onClick={() => navigate("/login")}>Ir a login</Button></>}
        {state === "ready" && inviteInfo && (
          <>
            <h1 className="text-xl font-semibold">Te invitaron a un workspace</h1>
            <p className="text-sm text-slate-600">Workspace: <span className="font-medium">{inviteInfo.tenantName}</span></p>
            <p className="text-sm text-slate-600">Email invitado: <span className="font-medium">{inviteInfo.email}</span></p>
            <p className="text-sm text-slate-600">Rol: <span className="font-medium">{inviteInfo.role}</span></p>
            <div className="space-y-2 pt-1">
              <Button className="w-full" onClick={acceptInvite}>
                Aceptar invitación
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={startingGoogle}
                onClick={continueWithGoogle}
              >
                {startingGoogle ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Redirigiendo...
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-2" />
                    Continuar con Google
                  </>
                )}
              </Button>
            </div>
          </>
        )}
        {state === "accepting" && <><Loader2 className="size-10 mx-auto animate-spin text-blue-600" /><h1 className="text-xl font-semibold">Aceptando invitación...</h1></>}
        {state === "accepted" && <><CheckCircle2 className="size-10 mx-auto text-green-500" /><h1 className="text-xl font-semibold">Invitación aceptada</h1><p className="text-sm text-slate-600">Redirigiendo al dashboard...</p></>}
      </div>
    </div>
  );
}
