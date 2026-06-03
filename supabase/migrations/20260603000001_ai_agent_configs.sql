CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  system_prompt text NOT NULL DEFAULT 'usa las tools dependiendo del contexto',
  mcp_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id)
);

-- RLS policies
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant ai configs" 
  ON public.ai_agent_configs FOR SELECT 
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant ai configs" 
  ON public.ai_agent_configs FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant ai configs" 
  ON public.ai_agent_configs FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
