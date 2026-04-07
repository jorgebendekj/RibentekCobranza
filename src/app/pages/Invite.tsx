import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../../lib/supabase";

const ADMIN_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_SERVER_URL ?? "http://localhost:3001";

type InviteState = "checking" | "invalid" | "ready" | "accepting" | "accepted";

export default function InvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => params.get("token"), [params]);
  const [state, setState] = useState<InviteState>("checking");
  const [message, setMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ tenantName: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setMessage("Token de invitación inválido.");
      return;
    }

    fetch(`${ADMIN_URL}/invites/${token}`)
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

    const res = await fetch(`${ADMIN_URL}/invites/${token}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await res.json();
    if (!res.ok) {
      setState("invalid");
      setMessage(payload.error ?? "No se pudo aceptar la invitación");
      return;
    }
    setState("accepted");
    setTimeout(() => navigate("/cobranzas", { replace: true }), 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-center">
        {state === "checking" && <><Loader2 className="size-10 mx-auto animate-spin text-blue-600" /><h1 className="text-xl font-semibold">Validando invitación...</h1></>}
        {state === "invalid" && <><XCircle className="size-10 mx-auto text-red-500" /><h1 className="text-xl font-semibold">Invitación inválida</h1><p className="text-sm text-slate-600">{message}</p><Button className="w-full" onClick={() => navigate("/login")}>Ir a login</Button></>}
        {state === "ready" && inviteInfo && <><h1 className="text-xl font-semibold">Te invitaron a un workspace</h1><p className="text-sm text-slate-600">Workspace: <span className="font-medium">{inviteInfo.tenantName}</span></p><p className="text-sm text-slate-600">Email: <span className="font-medium">{inviteInfo.email}</span></p><p className="text-sm text-slate-600">Rol: <span className="font-medium">{inviteInfo.role}</span></p><Button className="w-full" onClick={acceptInvite}>Aceptar invitación</Button></>}
        {state === "accepting" && <><Loader2 className="size-10 mx-auto animate-spin text-blue-600" /><h1 className="text-xl font-semibold">Aceptando invitación...</h1></>}
        {state === "accepted" && <><CheckCircle2 className="size-10 mx-auto text-green-500" /><h1 className="text-xl font-semibold">Invitación aceptada</h1><p className="text-sm text-slate-600">Redirigiendo al dashboard...</p></>}
      </div>
    </div>
  );
}
