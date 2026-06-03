import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventSource } from 'eventsource';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Required for SSEClientTransport in Node.js
global.EventSource = EventSource;

/**
 * Ejecuta la lógica del agente de OpenAI conectándose a un servidor MCP
 * para obtener y ejecutar las tools disponibles.
 * 
 * @param {string} tenantId - UUID of the tenant
 * @param {Array} history - Array de objetos { role: 'user'|'assistant', content: string }
 * @returns {Promise<string|null>} La respuesta final del agente, o null si está desactivado
 */
export async function runAgentLogic(tenantId, history) {
  // Fetch tenant config
  const { data: config } = await supabaseAdmin
    .from('ai_agent_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (config && config.is_active === false) {
    console.log(`[Agent] Disabled for tenant ${tenantId}`);
    return null; // disabled
  }

  const systemPrompt = config?.system_prompt || "Usa las tools dependiendo del contexto";
  const mcpUrl = config?.mcp_url || process.env.MCP_SERVER_URL || 'https://ribentek-cobranza.vercel.app/mcp/sse';

  let transport = null;
  let mcpClient = null;
  let tools = [];

  try {
    // 1. Connect to MCP Server
    transport = new SSEClientTransport(new URL(mcpUrl));
    mcpClient = new Client({ name: 'ribentek-agent', version: '1.0.0' }, { capabilities: {} });
    
    await mcpClient.connect(transport);
    
    const toolsRes = await mcpClient.listTools();
    tools = (toolsRes?.tools || []).map(t => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }
    }));
  } catch (error) {
    console.error('[Agent] Failed to connect to MCP or list tools:', error.message);
    // Continue without tools if MCP fails, or throw? For now we just log and have no tools.
  }

  // 2. Initialize OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  console.log(`[Agent] Running OpenAI with ${tools.length} tools`);

  // 3. Execution loop
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Consider gpt-4o-mini for speed and cost
      messages,
      tools: tools.length > 0 ? tools : undefined,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      console.log(`[Agent] Tool calls requested:`, msg.tool_calls.map(tc => tc.function.name));
      
      for (const tc of msg.tool_calls) {
        if (tc.type === 'function') {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch(e) {
            console.error('[Agent] JSON parse error in tool args:', e);
          }

          let contentStr = '';
          try {
            const toolResult = await mcpClient.callTool({
              name: tc.function.name,
              arguments: args
            });
            if (toolResult.content) {
               contentStr = toolResult.content.map(c => c.text || JSON.stringify(c)).join('\n');
            } else {
               contentStr = "Success (no output)";
            }
          } catch (err) {
             console.error(`[Agent] Error executing tool ${tc.function.name}:`, err.message);
             contentStr = "Error: " + err.message;
          }

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: contentStr
          });
        }
      }
    } else {
      // No more tool calls, we have our final text
      break;
    }
  }

  // Cleanup transport if possible
  if (transport && typeof transport.close === 'function') {
      try { transport.close(); } catch(e) {}
  }

  return messages[messages.length - 1].content;
}
