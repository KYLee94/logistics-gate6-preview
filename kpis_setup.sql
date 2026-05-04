-- IGIS Workspace KPIs Table Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.iota_workspace_kpis;

CREATE TABLE public.iota_workspace_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR NOT NULL UNIQUE,
    progress_percent NUMERIC DEFAULT 0,
    budget_variance NUMERIC DEFAULT 0,
    schedule_slippage_days INTEGER DEFAULT 0,
    covenant_status VARCHAR DEFAULT '정상',
    covenant_ltv NUMERIC DEFAULT 0,
    covenant_dscr NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.iota_workspace_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_workspace_kpis FOR SELECT USING (true);
CREATE POLICY "Allow public update access" ON public.iota_workspace_kpis FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert access" ON public.iota_workspace_kpis FOR INSERT WITH CHECK (true);

-- Insert Dummy Data for IOTA_SEOUL
INSERT INTO public.iota_workspace_kpis (
    project_id, 
    progress_percent, 
    budget_variance, 
    schedule_slippage_days, 
    covenant_status, 
    covenant_ltv, 
    covenant_dscr
) VALUES (
    'IOTA_SEOUL',
    18.0,
    1.2,
    7,
    '정상',
    45.5,
    1.25
);
