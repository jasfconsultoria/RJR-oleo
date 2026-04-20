import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Users,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MENU_STRUCTURE } from '@/config/menuConfig';
import { useMenuPermissions } from '@/contexts/MenuPermissionsContext';
import { cn } from '@/lib/utils';

const ROLES = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'administrador', label: 'Administrador' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'coletor', label: 'Coletor' },
];

const ActionToggle = ({ label, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{label}</p>
      {description && <p className="text-[10px] text-white/40 uppercase tracking-wider">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

const ResourceCard = ({ item, permissions, onToggle, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const resourcePerms = permissions[item.key] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
  
  const handleToggle = (field) => {
    onToggle(item.key, field, !resourcePerms[field]);
  };

  const hasSubItems = item.subItems && item.subItems.length > 0;

  return (
    <Card className={cn(
      "mb-4 overflow-hidden bg-white/5 backdrop-blur-md border-white/10",
      depth > 0 && "bg-transparent border-t-0 border-l border-white/20 ml-6 rounded-none shadow-none"
    )}>
      <CardHeader className="flex flex-row items-center justify-between py-4 px-6 space-y-0">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <item.icon className="w-5 h-5 text-blue-400" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-white">{item.label}</CardTitle>
            <p className="text-xs text-white/40">
              Recurso: <span className="font-mono">{item.key}</span>
              {hasSubItems && ` • ${item.subItems.length} sub-menus`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Acesso ao Menu</span>
            <Switch 
              checked={resourcePerms.can_view} 
              onCheckedChange={() => handleToggle('can_view')}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
          {hasSubItems && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-white/40 hover:text-white">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="px-6 pb-6 pt-0">
              {/* Action Toggles Row */}
              {item.hasActions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <ActionToggle 
                    label="Criar" 
                    description="Criar novos registros" 
                    checked={resourcePerms.can_create}
                    onChange={() => handleToggle('can_create')}
                    disabled={!resourcePerms.can_view}
                  />
                  <ActionToggle 
                    label="Editar" 
                    description="Editar registros existentes" 
                    checked={resourcePerms.can_edit}
                    onChange={() => handleToggle('can_edit')}
                    disabled={!resourcePerms.can_view}
                  />
                  <ActionToggle 
                    label="Excluir" 
                    description="Excluir registros" 
                    checked={resourcePerms.can_delete}
                    onChange={() => handleToggle('can_delete')}
                    disabled={!resourcePerms.can_view}
                  />
                </div>
              )}

              {/* Submenus Section */}
              {hasSubItems && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between mb-4 mt-8">
                     <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-2">Configuração de Sub-menus</p>
                     <div className="h-[1px] flex-1 bg-white/10 ml-4"></div>
                  </div>
                  {item.subItems.map(sub => (
                    <ResourceCard 
                      key={sub.key} 
                      item={sub} 
                      permissions={permissions} 
                      onToggle={onToggle} 
                      depth={depth + 1}
                    />
                  ))}
                </div>
              )}

              {/* Bulk Action */}
              <div className="flex justify-end mt-4">
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-white/30 hover:text-white/60 text-[10px] uppercase font-bold"
                  onClick={() => {
                    onToggle(item.key, 'bulk', false);
                  }}
                >
                  Desmarcar Todas
                </Button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const PermissionsPage = () => {
  const [selectedRole, setSelectedRole] = useState('administrador');
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { refreshPermissions } = useMenuPermissions();

  const fetchRolePermissions = useCallback(async (role) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_menu_permissions')
        .select('*')
        .eq('role', role);

      if (error) {
        toast({ title: 'Erro ao buscar permissões', description: error.message, variant: 'destructive' });
      } else {
        const permsMap = {};
        data?.forEach(p => {
          permsMap[p.menu_key] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete
          };
        });
        setPermissions(permsMap);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRolePermissions(selectedRole);
  }, [selectedRole, fetchRolePermissions]);

  const handleToggle = (menuKey, field, value) => {
    // Menus protegidos (segurança básica)
    if (['dashboard', 'sobre', 'versoes'].includes(menuKey) && field === 'can_view') return;
    if (menuKey === 'configuracoes_permissoes' && selectedRole === 'super_admin') return;

    setPermissions(prev => {
      const current = prev[menuKey] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
      
      if (field === 'bulk') {
        return {
          ...prev,
          [menuKey]: { can_view: false, can_create: false, can_edit: false, can_delete: false }
        };
      }

      return {
        ...prev,
        [menuKey]: { ...current, [field]: value }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upsertData = Object.entries(permissions).map(([key, perms]) => ({
        role: selectedRole,
        menu_key: key,
        ...perms
      }));

      const { error } = await supabase
        .from('role_menu_permissions')
        .upsert(upsertData, { onConflict: 'role, menu_key' });

      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Permissões salvas!', description: `Configurações para ${selectedRole} atualizadas.` });
        refreshPermissions();
      }
    } catch (err) {
      toast({ title: 'Erro inesperado', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Permissões por Perfil - RJR Óleo</title>
      </Helmet>
      
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Permissões por Perfil</h1>
              <p className="text-sm text-white/40">Configure as permissões de acesso para cada perfil do sistema</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Alterações
          </Button>
        </div>

        {/* Role Selector Card */}
        <Card className="bg-white/5 border-white/10 overflow-hidden backdrop-blur-md">
          <CardHeader className="border-b border-white/5 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="space-y-1">
                 <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Perfil a Configurar</p>
                 <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-full md:w-[300px] bg-black/20 border-white/10 text-white font-medium h-12 rounded-xl">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    {ROLES.map(role => (
                      <SelectItem key={role.id} value={role.id} className="hover:bg-blue-500/20 focus:bg-blue-500/20">{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                 </Select>
               </div>
               <div className="flex items-center gap-3">
                  <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5 h-10 rounded-xl gap-2">
                    <ShieldCheck className="w-4 h-4" /> Gerenciar Perfis
                  </Button>
                  <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5 h-10 rounded-xl gap-2">
                    <RefreshCw className="w-4 h-4" /> Permissões Padrão
                  </Button>
               </div>
            </div>
          </CardHeader>
        </Card>

        {/* Warning Banner */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-blue-400">Controle de Menus e Permissões</p>
            <p className="text-xs text-blue-200/60 leading-relaxed">
              Configure quais menus este perfil pode visualizar e as permissões de ações para cada recurso. Menus desmarcados não aparecerão na sidebar para usuários deste perfil.
            </p>
          </div>
        </div>

        {/* Resources List */}
        <div className="space-y-2">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-blue-200/40 font-medium">Carregando estrutura de permissões...</p>
             </div>
          ) : (
            MENU_STRUCTURE.map(item => (
              <ResourceCard 
                key={item.key} 
                item={item} 
                permissions={permissions} 
                onToggle={handleToggle} 
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default PermissionsPage;
