import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';

const MenuPermissionsContext = createContext({
  permissions: {},
  loading: true,
  canView: () => true,
  refreshPermissions: () => {}
});

export const MenuPermissionsProvider = ({ children }) => {
  const { profile, loading: profileLoading } = useProfile();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!profile?.role) {
      console.log('⏳ MenuPermissionsContext: Aguardando papel do usuário...');
      setLoading(false);
      return;
    }

    console.log(`🔍 MenuPermissionsContext: Buscando permissões para o papel: ${profile.role}`);
    try {
      const { data, error } = await supabase
        .from('role_menu_permissions')
        .select('menu_key, can_view')
        .eq('role', profile.role);

      if (error) {
        console.error('❌ MenuPermissionsContext: Erro ao buscar permissões:', error);
      } else if (data) {
        console.log(`✅ MenuPermissionsContext: ${data.length} permissões carregadas.`);
        const permsMap = data.reduce((acc, curr) => {
          acc[curr.menu_key] = curr.can_view;
          return acc;
        }, {});
        setPermissions(permsMap);
      }
    } catch (err) {
      console.error('Unexpected error fetching menu permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => {
    if (!profileLoading) {
      fetchPermissions();
    }
  }, [profile?.role, profileLoading, fetchPermissions]);

  const canView = useCallback((menuKey) => {
    // Menus protegidos por padrão (sempre visíveis para Admin/Super Admin se não houver registro)
    const protectedMenus = ['dashboard', 'sobre', 'versoes'];
    if (protectedMenus.includes(menuKey)) return true;
    
    // Se for Super Admin, tem acesso a quase tudo, exceto se explicitamente bloqueado
    // (Mas seguiremos o que está na tabela prioritariamente)
    
    if (loading && !profileLoading) return true; // Falback enquanto carrega
    
    return permissions[menuKey] !== false;
  }, [permissions, loading, profileLoading]);

  return (
    <MenuPermissionsContext.Provider value={{ permissions, loading: loading || profileLoading, canView, refreshPermissions: fetchPermissions }}>
      {children}
    </MenuPermissionsContext.Provider>
  );
};

export const useMenuPermissions = () => useContext(MenuPermissionsContext);
