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
          name: 'obtener_resumen_cliente',
          description: 'Obtiene un resumen general de la deuda del cliente (total adeudado, cantidad de facturas pendientes).',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'El ID del workspace (empresa)' },
              phone_number: { type: 'string', description: 'El teléfono del cliente' }
            },
            required: ['tenant_id', 'phone_number'],
          },
        },
        {
          name: 'listar_facturas_cliente',
          description: 'Lista todas las facturas/deudas específicas de un cliente.',
          inputSchema: {
            type: 'object',
            properties: {
              tenant_id: { type: 'string', description: 'El ID del workspace (empresa)' },
              phone_number: { type: 'string', description: 'El teléfono del cliente' },
              status: { type: 'string', description: 'Estado de la factura (Pending, Paid). Por defecto es Pending.', enum: ['Pending', 'Paid'] }
            },
            required: ['tenant_id', 'phone_number'],
          },
        },
        {
          name: 'ver_detalle_factura',
          description: 'Obtiene los detalles específicos de una factura mediante su ID.',
          inputSchema: {
            type: 'object',
            properties: {
              invoice_id: { type: 'string', description: 'El ID único de la factura (debt_details id)' }
            },
            required: ['invoice_id'],
          },
        },
        {
          name: 'buscar_tenants_por_telefono',
          description: 'Busca todas las empresas (tenants) a las que está asociado un número de teléfono de cliente.',
          inputSchema: {
            type: 'object',
            properties: {
              phone_number: { type: 'string', description: 'El teléfono del cliente a buscar' }
            },
            required: ['phone_number'],
          },
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    
    // Función auxiliar para buscar cliente
    const getContact = async (tenant_id, phone_number) => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('tenant_id', tenant_id)
        .eq('phone_number', phone_number)
        .is('deleted_at', null)
        .limit(1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return null;
      return data[0];
    };

    // 1. OBTENER RESUMEN
    if (request.params.name === 'obtener_resumen_cliente') {
      const { tenant_id, phone_number } = request.params.arguments;
      try {
        const contact = await getContact(tenant_id, phone_number);
        if (!contact) return { content: [{ type: 'text', text: `No se encontró cliente con el teléfono ${phone_number}.` }], isError: true };

        const { data: debts, error: debtsErr } = await supabase
          .from('debts')
          .select('total_pending, debt_pending_count, debt_status')
          .eq('tenant_id', tenant_id)
          .eq('contact_id', contact.id)
          .is('deleted_at', null)
          .limit(1);

        if (debtsErr) throw new Error(debtsErr.message);
        if (!debts || debts.length === 0) {
          return { content: [{ type: 'text', text: `El cliente ${contact.name} no tiene registros de deuda globales.` }] };
        }

        const summary = {
          cliente: contact.name,
          estado_general: debts[0].debt_status,
          cantidad_facturas_pendientes: debts[0].debt_pending_count,
          total_adeudado: debts[0].total_pending
        };

        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
      }
    }

    // 2. LISTAR FACTURAS
    if (request.params.name === 'listar_facturas_cliente') {
      const { tenant_id, phone_number, status = 'Pending' } = request.params.arguments;
      try {
        const contact = await getContact(tenant_id, phone_number);
        if (!contact) return { content: [{ type: 'text', text: `No se encontró cliente con el teléfono ${phone_number}.` }], isError: true };

        const { data: debtDetails, error: debtErr } = await supabase
          .from('debt_details')
          .select('id, debt_description, total, expiration_date, debt_status')
          .eq('contact_id', contact.id)
          .eq('debt_status', status)
          .is('deleted_at', null);

        if (debtErr) throw new Error(debtErr.message);
        if (!debtDetails || debtDetails.length === 0) {
          return { content: [{ type: 'text', text: `El cliente ${contact.name} no tiene facturas en estado ${status}.` }] };
        }

        const list = debtDetails.map(d => ({
          id_factura: d.id,
          concepto: d.debt_description || 'Sin concepto',
          monto: Number(d.total),
          estado: d.debt_status,
          fecha_vencimiento: d.expiration_date
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ cliente: contact.name, facturas: list }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
      }
    }

    // 3. VER DETALLE DE FACTURA
    if (request.params.name === 'ver_detalle_factura') {
      const { invoice_id } = request.params.arguments;
      try {
        const { data: detail, error } = await supabase
          .from('debt_details')
          .select('*')
          .eq('id', invoice_id)
          .is('deleted_at', null)
          .limit(1);

        if (error) throw new Error(error.message);
        if (!detail || detail.length === 0) {
          return { content: [{ type: 'text', text: `No se encontró la factura con ID ${invoice_id}.` }], isError: true };
        }

        return { content: [{ type: 'text', text: JSON.stringify(detail[0], null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
      }
    }

    // 4. BUSCAR TENANTS POR TELÉFONO
    if (request.params.name === 'buscar_tenants_por_telefono') {
      const { phone_number } = request.params.arguments;
      try {
        const { data: contacts, error: contactErr } = await supabase
          .from('contacts')
          .select('tenant_id')
          .eq('phone_number', phone_number)
          .is('deleted_at', null);

        if (contactErr) throw new Error(contactErr.message);
        if (!contacts || contacts.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ asociado: false, tenants: [] }) }] };
        }

        const tenantIds = [...new Set(contacts.map(c => c.tenant_id).filter(Boolean))];
        if (tenantIds.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ asociado: false, tenants: [] }) }] };
        }

        const { data: tenants, error: tenantErr } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds)
          .is('deleted_at', null);

        if (tenantErr) throw new Error(tenantErr.message);

        const list = (tenants || []).map(t => ({
          tenant_id: t.id,
          nombre: t.name
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ asociado: true, tenants: list }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error interno: ${err.message}` }], isError: true };
      }
    }

    throw new Error(`Herramienta no encontrada: ${request.params.name}`);
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
    tools: [
      'obtener_resumen_cliente',
      'listar_facturas_cliente',
      'ver_detalle_factura',
      'buscar_tenants_por_telefono'
    ]
  });
});

// Endpoint directo HTTP REST para buscar tenants sin requerir protocolo MCP completo
mcpApp.get('/mcp/tenants-by-phone', async (req, res) => {
  const { phone_number } = req.query;
  if (!phone_number) {
    return res.status(400).json({ error: 'Falta el parámetro phone_number en la query' });
  }

  try {
    const { data: contacts, error: contactErr } = await supabase
      .from('contacts')
      .select('tenant_id')
      .eq('phone_number', phone_number)
      .is('deleted_at', null);

    if (contactErr) throw new Error(contactErr.message);
    if (!contacts || contacts.length === 0) {
      return res.json({ asociado: false, tenants: [] });
    }

    const tenantIds = [...new Set(contacts.map(c => c.tenant_id).filter(Boolean))];
    if (tenantIds.length === 0) {
      return res.json({ asociado: false, tenants: [] });
    }

    const { data: tenants, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds)
      .is('deleted_at', null);

    if (tenantErr) throw new Error(tenantErr.message);

    const list = (tenants || []).map(t => ({
      tenant_id: t.id,
      nombre: t.name
    }));

    return res.json({ asociado: true, tenants: list });
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
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
