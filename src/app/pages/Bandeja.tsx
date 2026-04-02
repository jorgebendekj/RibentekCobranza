import { useState } from "react";
import {
  Search,
  MessageSquare,
  Phone,
  Clock,
  Bot,
  User,
  CheckCheck,
  X,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

type Message = {
  id: string;
  text: string;
  sender: "cliente" | "agente";
  timestamp: string;
  status?: "sent" | "delivered" | "read";
};

type Conversation = {
  id: string;
  clienteId: string;
  cliente: string;
  telefono: string;
  ultimoMensaje: string;
  ultimaInteraccion: string;
  timestampFull: Date;
  mensajesNoLeidos: number;
  estado: "activo" | "resuelto" | "pendiente";
  mensajes: Message[];
};

export function Bandeja() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Datos mock de conversaciones
  const conversaciones: Conversation[] = [
    {
      id: "conv-001",
      clienteId: "C001",
      cliente: "Roberto Silva",
      telefono: "+591 7654 3210",
      ultimoMensaje: "Perfecto, realizaré el pago mañana por la mañana. Gracias.",
      ultimaInteraccion: "Hace 5 min",
      timestampFull: new Date(Date.now() - 5 * 60 * 1000),
      mensajesNoLeidos: 0,
      estado: "pendiente",
      mensajes: [
        {
          id: "msg-001",
          text: "Hola Roberto, soy el asistente virtual de Ribentek. Te contacto para recordarte que tienes una factura pendiente de Bs. 18,500 con vencimiento el 15 de marzo.",
          sender: "agente",
          timestamp: "10:30",
          status: "read",
        },
        {
          id: "msg-002",
          text: "Hola, sí ya lo sé. ¿Puedo pagar en cuotas?",
          sender: "cliente",
          timestamp: "10:32",
        },
        {
          id: "msg-003",
          text: "Entiendo tu consulta. Actualmente tenemos opciones de pago fraccionado. ¿Te gustaría que te envíe las opciones disponibles?",
          sender: "agente",
          timestamp: "10:33",
          status: "read",
        },
        {
          id: "msg-004",
          text: "Sí por favor",
          sender: "cliente",
          timestamp: "10:34",
        },
        {
          id: "msg-005",
          text: "Tenemos dos opciones:\n• 2 cuotas de Bs. 9,250 cada una\n• 3 cuotas de Bs. 6,167 cada una\n\n¿Cuál opción prefieres?",
          sender: "agente",
          timestamp: "10:34",
          status: "read",
        },
        {
          id: "msg-006",
          text: "Perfecto, realizaré el pago mañana por la mañana. Gracias.",
          sender: "cliente",
          timestamp: "10:45",
        },
      ],
    },
    {
      id: "conv-002",
      clienteId: "C002",
      cliente: "María González",
      telefono: "+591 7123 4567",
      ultimoMensaje: "Muchas gracias por confirmar el pago.",
      ultimaInteraccion: "Hace 1 hora",
      timestampFull: new Date(Date.now() - 60 * 60 * 1000),
      mensajesNoLeidos: 0,
      estado: "resuelto",
      mensajes: [
        {
          id: "msg-201",
          text: "Hola María, te contacto desde Ribentek para confirmar que recibimos tu pago de Bs. 25,800. ¡Gracias!",
          sender: "agente",
          timestamp: "09:15",
          status: "read",
        },
        {
          id: "msg-202",
          text: "Excelente, gracias por confirmar",
          sender: "cliente",
          timestamp: "09:17",
        },
        {
          id: "msg-203",
          text: "De nada María. Tu recibo será enviado por email en las próximas 24 horas. ¿Hay algo más en lo que pueda ayudarte?",
          sender: "agente",
          timestamp: "09:17",
          status: "read",
        },
        {
          id: "msg-204",
          text: "No, todo perfecto",
          sender: "cliente",
          timestamp: "09:18",
        },
        {
          id: "msg-205",
          text: "Muchas gracias por confirmar el pago.",
          sender: "agente",
          timestamp: "09:18",
          status: "read",
        },
      ],
    },
    {
      id: "conv-003",
      clienteId: "C003",
      cliente: "Carlos Mendoza",
      telefono: "+591 7234 5678",
      ultimoMensaje: "Entiendo tu situación. ¿Cuándo podrías realizar el pago?",
      ultimaInteraccion: "Hace 3 horas",
      timestampFull: new Date(Date.now() - 3 * 60 * 60 * 1000),
      mensajesNoLeidos: 1,
      estado: "activo",
      mensajes: [
        {
          id: "msg-301",
          text: "Hola Carlos, te recuerdo que tienes tres facturas pendientes por un total de Bs. 30,350. La más antigua lleva 75 días de vencimiento.",
          sender: "agente",
          timestamp: "07:30",
          status: "read",
        },
        {
          id: "msg-302",
          text: "Lo sé, pero he tenido problemas económicos este mes",
          sender: "cliente",
          timestamp: "07:45",
        },
        {
          id: "msg-303",
          text: "Entiendo tu situación. ¿Cuándo podrías realizar el pago?",
          sender: "agente",
          timestamp: "07:46",
          status: "delivered",
        },
      ],
    },
    {
      id: "conv-004",
      clienteId: "C004",
      cliente: "Ana Rodríguez",
      telefono: "+591 7345 6789",
      ultimoMensaje: "Ok, ¿me puedes enviar la factura detallada?",
      ultimaInteraccion: "Ayer",
      timestampFull: new Date(Date.now() - 24 * 60 * 60 * 1000),
      mensajesNoLeidos: 1,
      estado: "activo",
      mensajes: [
        {
          id: "msg-401",
          text: "Hola Ana, te contacto para recordarte que tienes un saldo pendiente de Bs. 16,050 correspondiente a la factura de capacitación.",
          sender: "agente",
          timestamp: "14:20",
          status: "read",
        },
        {
          id: "msg-402",
          text: "Ok, ¿me puedes enviar la factura detallada?",
          sender: "cliente",
          timestamp: "14:25",
        },
      ],
    },
    {
      id: "conv-005",
      clienteId: "C005",
      cliente: "Luis Fernández",
      telefono: "+591 7567 8901",
      ultimoMensaje: "Hola, te contacto para recordarte sobre tu factura vencida...",
      ultimaInteraccion: "Hace 2 días",
      timestampFull: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      mensajesNoLeidos: 0,
      estado: "pendiente",
      mensajes: [
        {
          id: "msg-501",
          text: "Hola Luis, te contacto para recordarte sobre tu factura vencida de Bs. 18,700 por servicios de implementación.",
          sender: "agente",
          timestamp: "10:00",
          status: "read",
        },
      ],
    },
    {
      id: "conv-006",
      clienteId: "C006",
      cliente: "Patricia Vargas",
      telefono: "+591 7456 7890",
      ultimoMensaje: "¡Excelente! Gracias por tu pago puntual.",
      ultimaInteraccion: "Hace 3 días",
      timestampFull: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      mensajesNoLeidos: 0,
      estado: "resuelto",
      mensajes: [
        {
          id: "msg-601",
          text: "Hola Patricia, confirmamos que recibimos tu pago de Bs. 9,400. Todo está al día.",
          sender: "agente",
          timestamp: "11:30",
          status: "read",
        },
        {
          id: "msg-602",
          text: "Perfecto, gracias",
          sender: "cliente",
          timestamp: "11:35",
        },
        {
          id: "msg-603",
          text: "¡Excelente! Gracias por tu pago puntual.",
          sender: "agente",
          timestamp: "11:36",
          status: "read",
        },
      ],
    },
  ];

  // Filtrar conversaciones
  const filteredConversaciones = conversaciones.filter((conv) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      conv.cliente.toLowerCase().includes(searchLower) ||
      conv.telefono.includes(searchTerm) ||
      conv.clienteId.toLowerCase().includes(searchLower)
    );
  });

  // Ordenar por más recientes primero
  const sortedConversaciones = [...filteredConversaciones].sort(
    (a, b) => b.timestampFull.getTime() - a.timestampFull.getTime()
  );

  const selectedConv = conversaciones.find((c) => c.id === selectedConversation);

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      activo: { className: "bg-blue-50 text-blue-700 border-blue-200", label: "Activo" },
      resuelto: { className: "bg-green-50 text-green-700 border-green-200", label: "Resuelto" },
      pendiente: { className: "bg-orange-50 text-orange-700 border-orange-200", label: "Pendiente" },
    };
    const config = variants[estado] || variants.pendiente;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-3xl text-slate-900">Bandeja de Conversaciones</h1>
        <p className="text-slate-600 mt-2">
          Monitorea las interacciones entre clientes y el agente de IA
        </p>
      </div>

      {/* Chat Container */}
      <Card className="h-[calc(100vh-220px)]">
        <CardContent className="p-0 h-full">
          <div className="flex h-full">
            {/* Lista de conversaciones - Sidebar */}
            <div className="w-96 border-r border-slate-200 flex flex-col">
              {/* Search */}
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

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {sortedConversaciones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                    <MessageSquare className="size-12 mb-3 text-slate-300" />
                    <p className="font-medium">No se encontraron conversaciones</p>
                    <p className="text-sm mt-1">Intenta con otro término de búsqueda</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sortedConversaciones.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                          selectedConversation === conv.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-slate-200 size-12 rounded-full flex items-center justify-center shrink-0">
                            <User className="size-6 text-slate-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-medium text-slate-900 truncate">
                                {conv.cliente}
                              </h3>
                              <span className="text-xs text-slate-500 shrink-0">
                                {conv.ultimaInteraccion}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="size-3 text-slate-400" />
                              <p className="text-xs text-slate-600">{conv.telefono}</p>
                            </div>
                            <p className="text-sm text-slate-600 truncate mb-2">
                              {conv.ultimoMensaje}
                            </p>
                            <div className="flex items-center justify-between">
                              {getEstadoBadge(conv.estado)}
                              {conv.mensajesNoLeidos > 0 && (
                                <Badge className="bg-blue-600 text-white">
                                  {conv.mensajesNoLeidos}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel de detalle de conversación */}
            <div className="flex-1 flex flex-col">
              {!selectedConv ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageSquare className="size-20 mb-4 text-slate-300" />
                  <h2 className="text-xl font-medium mb-2">
                    Selecciona una conversación
                  </h2>
                  <p className="text-sm">
                    Elige una conversación de la lista para ver el historial completo
                  </p>
                </div>
              ) : (
                <>
                  {/* Conversation Header */}
                  <div className="border-b border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-300 size-12 rounded-full flex items-center justify-center">
                          <User className="size-6 text-slate-600" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-lg text-slate-900">
                            {selectedConv.cliente}
                          </h2>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="size-3" />
                            <span>{selectedConv.telefono}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">ID: {selectedConv.clienteId}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getEstadoBadge(selectedConv.estado)}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-4">
                      {selectedConv.mensajes.map((mensaje, index) => {
                        const isAgente = mensaje.sender === "agente";
                        return (
                          <div
                            key={mensaje.id}
                            className={`flex ${isAgente ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-4 ${
                                isAgente
                                  ? "bg-blue-600 text-white"
                                  : "bg-white border border-slate-200 text-slate-900"
                              }`}
                            >
                              {/* Sender badge */}
                              <div className="flex items-center gap-2 mb-2">
                                {isAgente ? (
                                  <>
                                    <Bot className="size-4" />
                                    <span className="text-xs font-medium">Agente IA</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="size-4" />
                                    <span className="text-xs font-medium text-slate-600">
                                      Cliente
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Message text */}
                              <p className="text-sm whitespace-pre-wrap mb-2">{mensaje.text}</p>

                              {/* Timestamp and status */}
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={`text-xs ${
                                    isAgente ? "text-blue-100" : "text-slate-500"
                                  }`}
                                >
                                  {mensaje.timestamp}
                                </span>
                                {isAgente && mensaje.status && (
                                  <CheckCheck
                                    className={`size-4 ${
                                      mensaje.status === "read"
                                        ? "text-blue-200"
                                        : "text-blue-300"
                                    }`}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info Footer */}
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="size-4 text-slate-400" />
                      <span>
                        Última interacción: {selectedConv.ultimaInteraccion} •{" "}
                        {selectedConv.mensajes.length} mensajes en el historial
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
