import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';

export default function AIAgentConfig() {
  const { currentTenant } = useTenant();
  const [config, setConfig] = useState({
    system_prompt: 'usa las tools dependiendo del contexto',
    mcp_url: 'https://ribentek-cobranza.vercel.app/mcp/sse',
    is_active: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) {
      fetchConfig();
    }
  }, [currentTenant?.id]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          system_prompt: data.system_prompt || '',
          mcp_url: data.mcp_url || '',
          is_active: data.is_active
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { error: upsertError } = await supabase
        .from('ai_agent_configs')
        .upsert({
          tenant_id: currentTenant!.id,
          system_prompt: config.system_prompt,
          mcp_url: config.mcp_url,
          is_active: config.is_active,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Cargando configuración...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuración del Agente IA</h1>
        <p className="text-gray-600">
          Personaliza el comportamiento de tu asistente virtual automatizado para WhatsApp.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              Configuración guardada exitosamente.
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Activar Agente IA</h3>
              <p className="text-sm text-gray-500 mt-1">Si está activado, el agente responderá automáticamente a los mensajes entrantes.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.is_active}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0066FF]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066FF]"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt del Sistema (System Prompt)
              </label>
              <p className="text-xs text-gray-500 mb-2">Instrucciones base que el agente debe seguir siempre.</p>
              <textarea
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] outline-none transition-colors"
                value={config.system_prompt}
                onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                placeholder="Ej. Eres un asistente de cobranzas amigable. Usa las tools dependiendo del contexto..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Servidor MCP
              </label>
              <p className="text-xs text-gray-500 mb-2">Endpoint de Server-Sent Events (SSE) para conectar las herramientas.</p>
              <input
                type="url"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] outline-none transition-colors"
                value={config.mcp_url}
                onChange={(e) => setConfig({ ...config, mcp_url: e.target.value })}
                placeholder="https://ribentek-cobranza.vercel.app/mcp/sse"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#0066FF] text-white text-sm font-medium rounded-lg hover:bg-[#0052CC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
