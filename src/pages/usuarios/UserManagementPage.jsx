import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, ShieldCheck, UserCog, Search, KeyRound } from 'lucide-react';
import { UserPermissionsModal } from '@/components/usuarios/UserPermissionsModal';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCnpjCpf } from '@/lib/utils';

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPermsDialogOpen, setIsPermsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const pageSize = useMemo(() => empresa?.items_per_page || 10, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 10 });
    };
    fetchEmpresaData();
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_users');
    
    if (error) {
      toast({ title: 'Erro ao buscar usuários', description: error.message, variant: 'destructive' });
      setUsers([]);
    } else {
      const sorted = data.sort((a, b) => {
        if (a.role === 'administrador' && b.role !== 'administrador') return -1;
        if (a.role !== 'administrador' && b.role === 'administrador') return 1;
        if (!a.full_name || !b.full_name) return 0;
        return a.full_name.localeCompare(b.full_name);
      });
      setUsers(sorted);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (empresa) {
      fetchUsers();
    }
  }, [fetchUsers, empresa]);

  // Recarregar usuários quando a página recebe foco ou quando voltamos para ela
  useEffect(() => {
    const handleFocus = () => {
      if (empresa) {
        console.log('🔄 Página recebeu foco, recarregando usuários...');
        fetchUsers();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchUsers, empresa]);

  // Recarregar quando a localização muda (útil quando voltamos da página de edição)
  useEffect(() => {
    if (empresa && location.pathname === '/app/usuarios') {
      console.log('🔄 Página de usuários montada, recarregando dados...');
      fetchUsers();
    }
  }, [location.pathname, fetchUsers, empresa]);

  const filteredUsers = useMemo(() => {
    if (!debouncedSearchTerm) return users;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return users.filter(user =>
      (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.cpf && user.cpf.replace(/\D/g, '').includes(debouncedSearchTerm.replace(/\D/g, ''))) ||
      (user.telefone && user.telefone.replace(/\D/g, '').includes(debouncedSearchTerm.replace(/\D/g, '')))
    );
  }, [users, debouncedSearchTerm]);

  useEffect(() => {
    setTotalCount(filteredUsers.length);
  }, [filteredUsers]);

  const paginatedUsers = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize;
    return filteredUsers.slice(from, to);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  // Função para formatar telefone
  const formatTelefone = (telefone) => {
    if (!telefone) return '-';
    const cleaned = telefone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      // Telefone fixo: (00) 0000-0000
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11) {
      // Celular: (00) 00000-0000
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  };

  const handleOpenPermsDialog = (user) => {
    setSelectedUser(user);
    setIsPermsDialogOpen(true);
  };

  const handleOpenPasswordDialog = (user) => {
    setSelectedUser(user);
    setIsPasswordDialogOpen(true);
  };

  const handleDeleteUser = async (userId, userEmail, userRole) => {
    if (userRole === 'administrador') {
      toast({
        title: 'Ação não permitida',
        description: 'Não é possível excluir um usuário administrador.',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
    });

    if (error) {
      toast({ title: 'Erro ao excluir usuário', description: error.message, variant: 'destructive' });
      await logAction('delete_user_failed', { error: error.message, deleted_user_email: userEmail });
    } else {
      toast({ title: 'Usuário excluído com sucesso!' });
      await logAction('delete_user_success', { deleted_user_email: userEmail });
      fetchUsers();
    }
  };

  if (!empresa) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Lista de Usuários - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <UserCog className="w-8 h-8 text-emerald-400" /> Lista de Usuários
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie usuários cadastrados.</p>
          </div>
          <Button onClick={() => navigate('/app/usuarios/novo')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                type="search"
                placeholder="Buscar por nome, email, CPF ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
                />
            </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-lg">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-white/10 border-b-white/20 text-xs">
                  <th className="p-2 text-left text-white">Nome</th>
                  <th className="p-2 text-left text-white">Email</th>
                  <th className="p-2 text-left text-white">CPF</th>
                  <th className="p-2 text-left text-white">Telefone</th>
                  <th className="p-2 text-left text-white">Perfil</th>
                  <th className="p-2 text-left text-white">Status</th>
                  <th className="p-2 text-center text-white">Ações</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-400" /></TableCell></TableRow>
                ) : paginatedUsers.map(user => (
                  <TableRow key={user.id} className="border-b-0 md:border-b border-white/10 text-white/90">
                    <TableCell data-label="Nome">{user.full_name || 'N/A'}</TableCell>
                    <TableCell data-label="Email">{user.email}</TableCell>
                    <TableCell data-label="CPF">{user.cpf ? formatCnpjCpf(user.cpf) : '-'}</TableCell>
                    <TableCell data-label="Telefone">{formatTelefone(user.telefone)}</TableCell>
                    <TableCell data-label="Perfil">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'administrador' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
                          {user.role}
                      </span>
                    </TableCell>
                    <TableCell data-label="Status">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center space-x-1 actions-cell">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPasswordDialog(user)} title="Alterar Senha">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenPermsDialog(user)} disabled={user.role === 'administrador'} title="Permissões">
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/app/usuarios/editar/${user.id}`)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300" title="Excluir" disabled={user.id === currentUser.id || user.role === 'administrador'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription className="text-emerald-300">
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário {user.full_name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel asChild>
                              <Button variant="outline" className="border-white/50 text-white hover:bg-white/20">Cancelar</Button>
                            </AlertDialogCancel>
                            <AlertDialogAction asChild>
                              <Button onClick={() => handleDeleteUser(user.id, user.email, user.role)} className="bg-red-600 hover:bg-red-700 text-white">Excluir</Button>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                 { !loading && paginatedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
        <Pagination
          className="mt-6"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>
      {selectedUser && (
        <Dialog open={isPermsDialogOpen} onOpenChange={setIsPermsDialogOpen}>
          <UserPermissionsModal 
            user={selectedUser} 
            onSave={() => setIsPermsDialogOpen(false)} 
            onCancel={() => setIsPermsDialogOpen(false)}
          />
        </Dialog>
      )}
      {selectedUser && (
        <ChangePasswordDialog
          user={selectedUser}
          isOpen={isPasswordDialogOpen}
          setIsOpen={setIsPasswordDialogOpen}
        />
      )}
    </>
  );
};

export default UserManagementPage;