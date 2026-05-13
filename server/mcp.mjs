import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const mcpApp = express();
mcpApp.use(cors());
mcpApp.use(express.json());

// 1. Instanciar el Servidor MCP Globalmente
const mcpServer = new Server(
  { name: 'AiCobranzas-MCP', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// 2. Registrar Herramientas
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
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

// 3. Lógica
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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
        .from('debts')
        .select('id, concept, total_amount, balance_due, due_date')
        .eq('tenant_id', tenant_id)
        .eq('contact_id', contacts[0].id)
        .eq('status', 'pending')
        .is('deleted_at', null);

      if (debtsErr) throw new Error(debtsErr.message);

      if (!debts || debts.length === 0) {
        return { content: [{ type: 'text', text: `El cliente ${contacts[0].name} no tiene deudas pendientes.` }] };
      }

      const totalDeuda = debts.reduce((sum, d) => sum + Number(d.balance_due), 0);
      const resultado = {
        cliente: contacts[0].name,
        resumen: `Tiene ${debts.length} factura(s) pendiente(s). Deuda total: $${totalDeuda.toFixed(2)}`,
        facturas: debts.map(d => ({
          concepto: d.concept,
          total: Number(d.total_amount),
          saldo_pendiente: Number(d.balance_due),
          fecha_vencimiento: d.due_date,
        }))
      };

      return { content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
    }
  }
  throw new Error('Herramienta no encontrada');
});

// Endpoint de validación
mcpApp.get('/mcp/status', (req, res) => {
  res.json({
    status: 'online',
    protocol: 'mcp',
    transport: 'streamable_http',
    version: '1.0.0',
    tools: ['consultar_facturas_pendientes']
  });
});

// ==========================================
// Transporte ÚNICO: Streamable HTTP (Stateless)
// ==========================================
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless
});
mcpServer.connect(transport).catch(console.error);

mcpApp.use('/mcp', async (req, res) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[MCP Transport Error]:', error);
    if (!res.headersSent) {
      res.status(500).send('Transport error');
    }
  }
});

export default mcpApp;
