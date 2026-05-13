import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const mcpApp = express();
mcpApp.use(cors());
mcpApp.use(express.json());

// Función constructora para aislar el estado de cada conexión
function createMcpServer() {
  const server = new Server(
    { name: 'AiCobranzas-MCP', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'consultar_facturas_pendientes',
          description: 'Consulta las facturas/deudas en estado pendiente de un usuario/cliente utilizando su teléfono.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'El ID del workspace (empresa)' },
              phone_number: { type: 'string', description: 'El teléfono del cliente' }
            },
            required: ['tenant_id', 'phone_number'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'consultar_facturas_pendientes') {
      const { tenant_id, phone_number } = request.params.arguments;
      try {
        const { data: contacts, error: contactErr } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('tenant_id', tenant_id)
          .eq('phone_number', phone_number)
          .is('deleted_at', null);

        if (contactErr) throw new Error(contactErr.message);
        if (!contacts || contacts.length === 0) {
          return { content: [{ type: 'text', text: `No se encontró cliente con el teléfono ${phone_number}.` }], isError: true };
        }

        const { data: debts, error: debtsErr } = await supabase
          .from('debt_details')
          .select('id, debt_description, total, expiration_date')
          .eq('contact_id', contacts[0].id)
          .eq('debt_status', 'Pending')
          .is('deleted_at', null);

        if (debtsErr) throw new Error(debtsErr.message);

        if (!debts || debts.length === 0) {
          return { content: [{ type: 'text', text: `El cliente ${contacts[0].name} no tiene deudas pendientes.` }] };
        }

        const totalDeuda = debts.reduce((sum, d) => sum + Number(d.total), 0);
        const resultado = {
          cliente: contacts[0].name,
          resumen: `Tiene ${debts.length} factura(s) pendiente(s). Deuda total: $${totalDeuda.toFixed(2)}`,
          facturas: debts.map(d => ({
            concepto: d.debt_description,
            total: Number(d.total),
            saldo_pendiente: Number(d.total),
            fecha_vencimiento: d.expiration_date,
          }))
        };

        return { content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
      }
    }
    throw new Error('Herramienta no encontrada');
  });

  return server;
}

// Endpoint de validación rápida para el navegador
mcpApp.get('/mcp/status', (req, res) => {
  res.json({
    status: 'online',
    protocol: 'mcp',
    transport: 'sse',
    version: '1.0.0',
    tools: ['consultar_facturas_pendientes']
  });
});

// ==========================================
// Transporte SSE (Requerido por n8n, Claude Desktop, etc)
// ==========================================
const activeSessions = new Map();

mcpApp.get('/mcp/sse', async (req, res) => {
  console.log('[MCP] Nueva conexión SSE inicializada');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const transport = new SSEServerTransport('/mcp/messages', res);
  const server = createMcpServer();
  
  await server.connect(transport);
  
  if (transport.sessionId) {
    activeSessions.set(transport.sessionId, transport);
    
    res.on('close', () => {
      console.log(`[MCP] Conexión SSE cerrada: ${transport.sessionId}`);
      activeSessions.delete(transport.sessionId);
    });
  }
});

mcpApp.post('/mcp/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId) {
    return res.status(400).send('Falta sessionId en la URL');
  }

  const transport = activeSessions.get(sessionId);
  if (!transport) {
    return res.status(404).send('Sesión no encontrada o ya expiró');
  }

  await transport.handlePostMessage(req, res, req.body);
});

export default mcpApp;
