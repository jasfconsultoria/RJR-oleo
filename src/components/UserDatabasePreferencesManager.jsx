import React, { useState, useEffect, useCallback } from 'react';
import { Users, Database, Save, Loader2, Search, CheckCircle2, XCircle, Filter, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { isSuperAdmin } from '@/lib/envUtils';
import { defaultClient, defaultSupabaseUrl, defaultSupabaseAnonKey, homologSupabaseUrl, homologSupabaseAnonKey } from '@/lib/getActiveEnvironment';
import { refreshSupabaseClient } from '@/lib/customSupabaseClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Constantes para fallback se o banco estiver indisponível
const DATABASES_FALLBACK = [
  {
    tipo: 'producao',
    nome: 'Produção',
    url: defaultSupabaseUrl,
    anon_key: defaultSupabaseAnonKey,
  },
  {
    tipo: 'homologacao',
    nome: 'Homologação',
    url: homologSupabaseUrl,
    anon_key: homologSupabaseAnonKey,
  }
];

const UserDatabasePreferencesManager = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const role = profile?.role;
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [preferences, setPreferences] = useState({}); // { userId: { tipo, nome, url, anon_key } }
  const [environments, setEnvironments] = useState(DATABASES_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedDatabase, setSelectedDatabase] = useState('homologacao');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');

  const isUserSuperAdmin = isSuperAdmin(role);

  const fetchUsersAndPreferences = useCallback(async () => {
    if (!isUserSuperAdmin) return;

    setLoading(true);
    try {
      // Buscar todos os usuários do banco de controle (Produção) via RPC para incluir emails
      const { data: usersData, error: usersError } = await defaultClient
        .rpc('get_all_users');

      if (usersError) throw usersError;

      // Buscar ambientes de banco para não usar url fixo
      const { data: dbEnvs, error: envsError } = await defaultClient
        .from('db_environments')
        .select('*');
        
      if (!envsError && dbEnvs) {
        const envsCombinados = DATABASES_FALLBACK.map(ambientePadrao => {
          const encontrado = dbEnvs.find(a => a.tipo === ambientePadrao.tipo);
          return encontrado || ambientePadrao;
        });

        const outrosAmbientes = dbEnvs.filter(
          a => !DATABASES_FALLBACK.some(ap => ap.tipo === a.tipo)
        );

        setEnvironments([...envsCombinados, ...outrosAmbientes]);
      }

      // Buscar todas as preferências
      const { data: allPreferences, error: prefsError } = await defaultClient
        .from('user_db_preferences')
        .select('user_id, url, anon_key, nome, tipo');

      if (prefsError) {
        console.warn('Erro ao buscar preferências:', prefsError);
      }

      const prefsMap = {};
      if (allPreferences) {
        allPreferences.forEach(pref => {
          prefsMap[pref.user_id] = {
            tipo: pref.tipo,
            nome: pref.nome,
            url: pref.url,
            anon_key: pref.anon_key,
          };
        });
      }

      setUsers(usersData || []);
      setPreferences(prefsMap);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: error.message || 'Não foi possível carregar os usuários',
      });
    } finally {
      setLoading(false);
    }
  }, [isUserSuperAdmin, toast]);

  useEffect(() => {
    fetchUsersAndPreferences();
  }, [fetchUsersAndPreferences]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    const valA = (a[sortColumn] || '').toLowerCase();
    const valB = (b[sortColumn] || '').toLowerCase();
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleToggleUser = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkSave = async () => {
    if (selectedUsers.size === 0) return;

    setBulkSaving(true);
    try {
      const dbConfig = environments.find(env => env.tipo === selectedDatabase);
      if (!dbConfig) throw new Error('Selecione um banco válido');
      
      const userIds = Array.from(selectedUsers);

      const promises = userIds.map(async (userId) => {
        const currentUser = users.find(u => u.id === userId);
        const preferenceData = {
          user_id: userId,
          url: dbConfig.url,
          anon_key: dbConfig.anon_key,
          nome: dbConfig.nome,
          tipo: dbConfig.tipo,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          updated_at: new Date().toISOString(),
        };

        const { error } = await defaultClient
          .from('user_db_preferences')
          .upsert(preferenceData, { onConflict: 'user_id' });

        if (error) throw error;
      });

      await Promise.all(promises);

      toast({
        title: 'Sucesso!',
        description: `Ambiente ${dbConfig.nome} aplicado para ${userIds.length} usuário(s).`,
      });

      // Forçar atualização do cliente global do Supabase caso o usuário logado tenha sido alterado
      await refreshSupabaseClient();

      setIsDialogOpen(false);
      setSelectedUsers(new Set());
      fetchUsersAndPreferences();
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } finally {
      setBulkSaving(false);
    }
  };

  if (!isUserSuperAdmin) return null;

  return (
    <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -transform -translate-y-1/2 h-4 w-4 text-emerald-300/50" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-emerald-300/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          disabled={selectedUsers.size === 0}
          onClick={() => setIsDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
        >
          <Database className="w-4 h-4 mr-2" />
          Alterar Banco ({selectedUsers.size})
        </Button>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="hover:bg-transparent border-white/10">
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                    } else {
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="border-white/30 data-[state=checked]:bg-emerald-600"
                />
              </TableHead>
              <TableHead className="text-emerald-300 font-bold cursor-pointer" onClick={() => handleSort('full_name')}>
                Nome {sortColumn === 'full_name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-emerald-300 font-bold">Email</TableHead>
              <TableHead className="text-emerald-300 font-bold">Role</TableHead>
              <TableHead className="text-emerald-300 font-bold text-right">Banco Atual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-emerald-300/50">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-white/5 border-white/5 text-white">
                  <TableCell>
                    <Checkbox 
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => handleToggleUser(user.id)}
                      className="border-white/30 data-[state=checked]:bg-emerald-600"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell className="text-emerald-300/70">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 capitalize">
                      {user.role?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={preferences[user.id]?.tipo === 'homologacao' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}>
                      {preferences[user.id]?.nome || 'Produção (padrão)'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-emerald-500/20 text-white">
          <DialogHeader>
            <DialogTitle>Alterar Ambiente de Banco de Dados</DialogTitle>
            <DialogDescription className="text-emerald-300/60">
              Selecione qual banco os {selectedUsers.size} usuários selecionados devem utilizar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Banco de Dados Destino</Label>
              <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                <SelectTrigger className="bg-black/40 border-white/10 text-white">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10 text-white">
                  {environments.map((env) => (
                    <SelectItem key={env.tipo} value={env.tipo}>{env.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-emerald-500/10 p-4 rounded-lg flex gap-3 border border-emerald-500/20">
              <Info className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300/80">
                Esta alteração fará com que o usuário acesse as tabelas transacionais (coletas, clientes, financeiro) no banco selecionado. Os dados de login permanecem centralizados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkSave} 
              disabled={bulkSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Aplicar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDatabasePreferencesManager;
