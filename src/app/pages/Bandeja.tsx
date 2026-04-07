import { useState, useEffect, useCallback } from "react";
import {
  Search, MessageSquare, Phone, Clock, Bot, User, CheckCheck, X,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  useThreads,
  useMessages,
  useRealtimeMessages,
  useRealtimeThreads,
  THREADS_KEY,
  MESSAGES_KEY,
} from "../hooks/useThreads";
import { threadsService } from "../services/threads.service";
import { useAuth } from "../context/AuthContext";
import type { ThreadWithContact } from "../data/supabase.types";

export function Bandeja() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const { data: messages = [] } = useMessages(selectedThreadId);

  // Supabase Realtime — new messages arrive here
  const realtimeMessages = useRealtimeMessages(selectedThreadId);

  // Merge persisted + realtime messages (dedupe by id)
  const allMessages = [
    ...messages,
    ...realtimeMessages.filter(rm => !messages.some(m => m.id === rm.id)),
  ];

  // Supabase Realtime — thread list updates
  const onThreadsUpdate = useCallback(() => {
    qc.invalidateQueries({ queryKey: [THREADS_KEY, tenantId] });
  }, [qc, tenantId]);
  useRealtimeThreads(tenantId, onThreadsUpdate);

  // Mark thread as read when selected
  useEffect(() => {
    if (selectedThreadId) {
      threadsService.markThreadRead(selectedThreadId).catch(() => null);
      qc.invalidateQueries({ queryKey: [MESSAGES_KEY, selectedThreadId] });
    }
  }, [selectedThreadId]);

  // ── Filtering ─────────────────────────────────────────────
  const filteredThreads = threads.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      (t.contacts?.name ?? "").toLowerCase().includes(q) ||
      (t.contacts?.phone_number ?? "").includes(searchTerm) ||
      t.id.toLowerCase().includes(q)
    );
  });

  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null;

  // ── Helpers ───────────────────────────────────────────────
  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs} hora${hrs > 1 ? "s" : ""}`;
    const days = Math.floor(hrs / 24);
    return `Hace ${days} día${days > 1 ? "s" : ""}`;
  };

  // A thread is "active" if last message was < 24h and not null
  const getEstado = (t: ThreadWithContact): "activo" | "resuelto" | "pendiente" => {
    if (!t.last_interaction) return "pendiente";
    const diff = Date.now() - new Date(t.last_interaction).getTime();
    const hrs = diff / 3600000;
    if (hrs < 1) return "activo";
    if (hrs < 48) return "pendiente";
    return "resuelto";
  };

  const getEstadoBadge = (estado: string) => {
    const cfg: Record<string, { className: string; label: string }> = {
      activo:   { className: "bg-blue-50 text-blue-700 border-blue-200", label: "Activo" },
      resuelto: { className: "bg-green-50 text-green-700 border-green-200", label: "Resuelto" },
      pendiente:{ className: "bg-orange-50 text-orange-700 border-orange-200", label: "Pendiente" },
    };
    const c = cfg[estado] ?? cfg.pendiente;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">Bandeja de Conversaciones</h1>
        <p className="text-slate-600 mt-2">Monitorea las interacciones en tiempo real con el agente de IA</p>
      </div>

      <Card className="h-[calc(100vh-220px)]">
        <CardContent className="p-0 h-full">
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-96 border-r border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por cliente, teléfono o ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {threadsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                    <MessageSquare className="size-12 mb-3 text-slate-300" />
                    <p className="font-medium">No se encontraron conversaciones</p>
                    <p className="text-sm mt-1">Intenta con otro término</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredThreads.map((t) => {
                      const estado = getEstado(t);
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedThreadId(t.id)}
                          className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                            selectedThreadId === t.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="bg-slate-200 size-12 rounded-full flex items-center justify-center shrink-0">
                              <User className="size-6 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-medium text-slate-900 truncate">{t.contacts?.name ?? "Desconocido"}</h3>
                                <span className="text-xs text-slate-500 shrink-0">{formatRelativeTime(t.last_interaction)}</span>
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <Phone className="size-3 text-slate-400" />
                                <p className="text-xs text-slate-600">{t.contacts?.phone_number ?? "—"}</p>
                              </div>
                              <p className="text-sm text-slate-600 truncate mb-2">{t.last_message ?? "Sin mensajes"}</p>
                              <div className="flex items-center justify-between">
                                {getEstadoBadge(estado)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Message panel */}
            <div className="flex-1 flex flex-col">
              {!selectedThread ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageSquare className="size-20 mb-4 text-slate-300" />
                  <h2 className="text-xl font-medium mb-2">Selecciona una conversación</h2>
                  <p className="text-sm">Elige una conversación de la lista para ver el historial completo</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="border-b border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-300 size-12 rounded-full flex items-center justify-center">
                          <User className="size-6 text-slate-600" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-lg text-slate-900">{selectedThread.contacts?.name}</h2>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="size-3" />
                            <span>{selectedThread.contacts?.phone_number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getEstadoBadge(getEstado(selectedThread))}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId(null)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-4">
                      {allMessages.map((msg) => {
                        const isAgent = !msg.incoming;
                        return (
                          <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] rounded-lg p-4 ${
                              isAgent ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-900"
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                {isAgent ? (
                                  <><Bot className="size-4" /><span className="text-xs font-medium">Agente IA</span></>
                                ) : (
                                  <><User className="size-4" /><span className="text-xs font-medium text-slate-600">Cliente</span></>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap mb-2">{msg.message_text}</p>
                              <div className="flex items-center justify-end gap-2">
                                <span className={`text-xs ${isAgent ? "text-blue-100" : "text-slate-500"}`}>
                                  {msg.sent_at
                                    ? new Date(msg.sent_at).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
                                    : new Date(msg.created_at).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
                                  }
                                </span>
                                {isAgent && (
                                  <CheckCheck className={`size-4 ${msg.read ? "text-blue-200" : "text-blue-300"}`} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="size-4 text-slate-400" />
                      <span>
                        {selectedThread.last_interaction
                          ? `Última interacción: ${formatRelativeTime(selectedThread.last_interaction)}`
                          : "Sin interacciones"
                        }
                        {" "}• {allMessages.length} mensajes en el historial
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
