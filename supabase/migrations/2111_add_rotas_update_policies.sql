-- Adiciona políticas de UPDATE e DELETE para as tabelas rotas e rota_clientes
-- Com o DROP POLICY preventivo para evitar erros "already exists"

-- Políticas para rotas
DROP POLICY IF EXISTS "Permitir atualização para administradores, gerentes e super admins" ON public.rotas;
CREATE POLICY "Permitir atualização para administradores, gerentes e super admins" ON public.rotas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );

DROP POLICY IF EXISTS "Permitir atualização pelo próprio coletor" ON public.rotas;
CREATE POLICY "Permitir atualização pelo próprio coletor" ON public.rotas
    FOR UPDATE USING (
        coletor_id = auth.uid()
    );

DROP POLICY IF EXISTS "Permitir deleção para administradores, gerentes e super admins" ON public.rotas;
CREATE POLICY "Permitir deleção para administradores, gerentes e super admins" ON public.rotas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );


-- Políticas para rota_clientes
DROP POLICY IF EXISTS "Permitir atualização para administradores, gerentes e super admins" ON public.rota_clientes;
CREATE POLICY "Permitir atualização para administradores, gerentes e super admins" ON public.rota_clientes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );

DROP POLICY IF EXISTS "Permitir atualização pelo coletor da rota" ON public.rota_clientes;
CREATE POLICY "Permitir atualização pelo coletor da rota" ON public.rota_clientes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.rotas
            WHERE rotas.id = rota_clientes.rota_id
            AND rotas.coletor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Permitir deleção para administradores, gerentes e super admins" ON public.rota_clientes;
CREATE POLICY "Permitir deleção para administradores, gerentes e super admins" ON public.rota_clientes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );
