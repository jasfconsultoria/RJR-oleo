import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/components/ui/use-toast';
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronUp,
  ChevronDown,
  Users,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { formatCnpjCpf, cn } from '@/lib/utils';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import AdminConfirmationDialog from '@/components/financeiro/AdminConfirmationDialog';

// Constantes e configurações
const CONFIG = {
  PAGE_SIZE_DEFAULT: 25,
  DEBOUNCE_DELAY: 500,
  TABLE_COLUMNS: {
    nome: { label: 'Nome Fantasia / Razão Social', width: 'w-[20%]' },
    cnpj_cpf: { label: 'CNPJ/CPF', width: 'w-[15%]' },
    endereco: { label: 'Endereço', width: 'w-[25%]' },
    municipio: { label: 'Localização', width: 'w-[20%]' },
    contrato: { label: 'Contrato', width: 'w-[10%]' },
    acoes: { label: 'Ações', width: 'w-[10%]' }
  }
};

// Hook personalizado para gerenciar os labels baseados no tipo
const usePersonTypeLabels = (personType) => {
  return useMemo(() => {
    const types = {
      cliente: {
        listTitle: 'Clientes',
        pageVerb: 'Novo Cliente',
        singularNoun: 'cliente',
        singularArticle: 'o',
        basePath: 'clientes'
      },
      fornecedor: {
        listTitle: 'Fornecedores',
        pageVerb: 'Novo Fornecedor',
        singularNoun: 'fornecedor',
        singularArticle: 'o',
        basePath: 'fornecedores'
      },
      pessoa: {
        listTitle: 'Pessoas',
        pageVerb: 'Nova Pessoa',
        singularNoun: 'pessoa',
        singularArticle: 'a',
        basePath: 'clientes'
      }
    };

    return types[personType] || types.pessoa;
  }, [personType]);
};

// Hook para verificar se o cliente pode ser excluído
const useCanDeleteCliente = (clienteId) => {
  const [canDelete, setCanDelete] = useState(true);
  const [checking, setChecking] = useState(false);
  const [relatedEntities, setRelatedEntities] = useState([]);

  useEffect(() => {
    const checkRelatedEntities = async () => {
      if (!clienteId) return;

      setChecking(true);

      const checks = [
        { table: 'contratos', field: 'cliente_id', name: 'contratos' },
        { table: 'coletas', field: 'cliente_id', name: 'coletas' },
        { table: 'credito_debito', field: 'pessoa_id', name: 'créditos/débitos' },
        { table: 'entrada_saida', field: 'cliente_id', name: 'entradas/saídas' }
      ];

      const entitiesWithData = [];

      for (const check of checks) {
        const { data, error } = await supabase
          .from(check.table)
          .select('id')
          .eq(check.field, clienteId)
          .limit(1);

        if (!error && data && data.length > 0) {
          entitiesWithData.push(check.name);
        }
      }

      setRelatedEntities(entitiesWithData);
      setCanDelete(entitiesWithData.length === 0);
      setChecking(false);
    };

    checkRelatedEntities();
  }, [clienteId]);

  return { canDelete, checking, relatedEntities };
};

// Função auxiliar para verificar se o cliente pode ser excluído
const checkClienteDeletable = async (clienteId) => {
  const checks = [
    { table: 'contratos', field: 'cliente_id' },
    { table: 'coletas', field: 'cliente_id' },
    { table: 'credito_debito', field: 'pessoa_id' },
    { table: 'entrada_saida', field: 'cliente_id' }
  ];

  for (const check of checks) {
    const { data, error } = await supabase
      .from(check.table)
      .select('id')
      .eq(check.field, clienteId)
      .limit(1);

    if (!error && data && data.length > 0) {
      return { canDelete: false, reason: check.table };
    }
  }

  return { canDelete: true };
};

// Hook para gerenciar o estado da lista - SOLUÇÃO 100% FUNCIONAL
const useClientesList = (personType, profile) => {
  const [state, setState] = useState({
    clientes: [],
    allContratos: [],
    loading: true,
    searchTerm: '',
    sortConfig: { key: 'razao_social', direction: 'asc' },
    currentPage: 1,
    totalCount: 0,
    empresa: { items_per_page: CONFIG.PAGE_SIZE_DEFAULT },
    isConfirmDialogOpen: false,
    selectedForDeletion: null
  });

  const debouncedSearchTerm = useDebounce(state.searchTerm, CONFIG.DEBOUNCE_DELAY);
  const { toast } = useToast();
  const labels = usePersonTypeLabels(personType);

  // Fetch dados da empresa
  useEffect(() => {
    const fetchEmpresaData = async () => {
      const userRole = profile?.role;
      const canAccessEmpresa = ['administrador', 'gerente'].includes(userRole);

      if (!canAccessEmpresa) {
        setState(prev => ({
          ...prev,
          empresa: { items_per_page: CONFIG.PAGE_SIZE_DEFAULT }
        }));
        return;
      }

      const { data, error } = await supabase
        .from('empresa')
        .select('items_per_page')
        .single();

      if (error) {
        console.warn("Aviso: Usuário não tem acesso aos dados da empresa. Usando configuração padrão.");
        if (userRole !== 'coletor') {
          toast({
            title: "Erro ao buscar configurações da empresa.",
            variant: "destructive"
          });
        }

        setState(prev => ({
          ...prev,
          empresa: { items_per_page: CONFIG.PAGE_SIZE_DEFAULT }
        }));
      } else {
        setState(prev => ({
          ...prev,
          empresa: data || { items_per_page: CONFIG.PAGE_SIZE_DEFAULT }
        }));
      }
    };

    if (profile) {
      fetchEmpresaData();
    }
  }, [profile, toast]);

  // Fetch todos os contratos
  useEffect(() => {
    const fetchAllContratos = async () => {
      let query = supabase
        .from('contratos')
        .select('id, cliente_id, numero_contrato, status');

      // ✅ CORREÇÃO: Usar profile.id (que agora vem da stored procedure)
      if (profile?.role === 'coletor' && profile?.id) {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar contratos:', error);
        toast({
          title: 'Erro ao buscar contratos',
          variant: 'destructive'
        });
      } else {
        console.log('Contratos carregados:', data?.length || 0);
        setState(prev => ({ ...prev, allContratos: data || [] }));
      }
    };

    if (profile) {
      fetchAllContratos();
    }
  }, [toast, profile]);

  // ✅ SOLUÇÃO 100% FUNCIONAL: Buscar todos e filtrar no frontend
  const fetchClientes = useCallback(async () => {
    if (!profile) return;

    console.log('🎯 Buscando clientes para:', {
      role: profile.role,
      userId: profile.id, // ✅ AGORA VEM CORRETO DA STORED PROCEDURE
      email: profile.email
    });

    setState(prev => ({ ...prev, loading: true }));

    try {
      // Buscar TODOS os clientes do banco
      const { data: allClientes, error, count } = await supabase
        .from('clientes')
        .select('id, nome_fantasia, razao_social, cnpj_cpf, endereco, municipio, estado, user_id', {
          count: 'exact'
        });

      if (error) throw error;

      console.log('📦 Total de clientes no banco:', allClientes?.length);

      // ✅ FILTRAGEM NO FRONTEND - 100% GARANTIDO
      let clientesFiltrados = [];
      let totalFiltrado = 0;

      if (profile.role === 'coletor' && profile.id) {
        clientesFiltrados = allClientes.filter(cliente =>
          cliente.user_id === profile.id // ✅ USA profile.id CORRETO
        );
        totalFiltrado = clientesFiltrados.length;
        console.log('🎯 Meus clientes após filtro:', clientesFiltrados.length);
      } else if (profile.role === 'administrador' || profile.role === 'gerente') {
        clientesFiltrados = allClientes;
        totalFiltrado = count || 0;
        console.log('👑 Administrador vendo todos os clientes:', totalFiltrado);
      }

      // Aplicar busca se houver termo
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        clientesFiltrados = clientesFiltrados.filter(cliente =>
        (cliente.nome_fantasia?.toLowerCase().includes(term) ||
          cliente.razao_social?.toLowerCase().includes(term) ||
          cliente.cnpj_cpf?.includes(term) ||
          cliente.municipio?.toLowerCase().includes(term) ||
          cliente.estado?.toLowerCase().includes(term))
        );
        totalFiltrado = clientesFiltrados.length;
      }

      // Aplicar ordenação
      clientesFiltrados.sort((a, b) => {
        const aValue = a[state.sortConfig.key] || '';
        const bValue = b[state.sortConfig.key] || '';

        if (state.sortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });

      // Aplicar paginação
      const startIndex = (state.currentPage - 1) * state.empresa.items_per_page;
      const endIndex = startIndex + state.empresa.items_per_page;
      const clientesPaginados = clientesFiltrados.slice(startIndex, endIndex);

      setState(prev => ({
        ...prev,
        clientes: clientesPaginados,
        totalCount: totalFiltrado,
        loading: false
      }));

    } catch (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      toast({
        title: 'Erro ao carregar clientes',
        description: error.message,
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, clientes: [], loading: false }));
    }
  }, [profile, state.currentPage, state.empresa, debouncedSearchTerm, state.sortConfig, toast]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Resetar página quando search term ou page size mudar
  useEffect(() => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, state.empresa?.items_per_page]);

  // Actions
  const handleInitiateDelete = (cliente) => {
    const userRole = profile?.role;
    const canDelete = ['administrador', 'gerente'].includes(userRole);

    if (!canDelete) {
      toast({
        title: 'Permissão negada',
        description: 'Seu perfil não tem permissão para excluir clientes.',
        variant: 'destructive',
      });
      return;
    }

    setState(prev => ({
      ...prev,
      selectedForDeletion: cliente,
      isConfirmDialogOpen: true
    }));
  };

  const handleConfirmedDelete = async (secondAdmin) => {
    const cliente = state.selectedForDeletion;
    if (!cliente) return;

    try {
      const { canDelete: canDeleteByRelations } = await checkClienteDeletable(cliente.id);

      if (!canDeleteByRelations) {
        toast({
          title: 'Não é possível excluir',
          description: `Este ${labels.singularNoun} possui vínculos com contratos, coletas ou outros registros.`,
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente.id);

      if (error) {
        toast({
          title: 'Erro ao excluir',
          description: "Não foi possível excluir o cliente. Verifique se ele possui coletas, contratos ou certificados vinculados.",
          variant: 'destructive',
        });
        await logAction('delete_client_failed', {
          error: error.message,
          client_id: cliente.id,
          client_name: cliente.razao_social,
          requested_by: profile?.id,
          attempted_by_second_admin: secondAdmin.id
        });
      } else {
        toast({
          title: `${labels.singularNoun} excluído!`,
          description: `O ${labels.singularNoun} foi removido com sucesso.`,
        });
        await logAction('delete_client_success', {
          client_id: cliente.id,
          client_name: cliente.razao_social,
          requested_by: profile?.id,
          authorized_by: secondAdmin.id,
          authorized_by_name: secondAdmin.name
        });
        fetchClientes();
      }
    } catch (err) {
      console.error('Erro na exclusão:', err);
    } finally {
      setState(prev => ({
        ...prev,
        isConfirmDialogOpen: false,
        selectedForDeletion: null
      }));
    }
  };

  const handleDelete = async (cliente) => {
    const userRole = profile?.role;
    const canDelete = ['administrador', 'gerente'].includes(userRole);

    if (!canDelete) {
      toast({
        title: 'Permissão negada',
        description: 'Seu perfil não tem permissão para excluir clientes.',
        variant: 'destructive',
      });
      return;
    }

    const { canDelete: canDeleteByRelations } = await checkClienteDeletable(cliente.id);

    if (!canDeleteByRelations) {
      toast({
        title: 'Não é possível excluir',
        description: `Este ${labels.singularNoun} possui vínculos com contratos, coletas ou outros registros.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', cliente.id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: "Não foi possível excluir o cliente. Verifique se ele possui coletas, contratos ou certificados vinculados.",
        variant: 'destructive',
      });
      await logAction('delete_client_failed', {
        error: error.message,
        client_id: cliente.id,
        client_name: cliente.razao_social
      });
    } else {
      toast({
        title: `${labels.singularNoun} excluído!`,
        description: `O ${labels.singularNoun} foi removido com sucesso.`,
      });
      await logAction('delete_client_success', {
        client_id: cliente.id,
        client_name: cliente.razao_social
      });
      fetchClientes();
    }
  };

  const requestSort = (key) => {
    const direction = state.sortConfig.key === key && state.sortConfig.direction === 'asc'
      ? 'desc'
      : 'asc';

    setState(prev => ({
      ...prev,
      sortConfig: { key, direction },
      currentPage: 1
    }));
  };

  const updateSearchTerm = (term) => {
    setState(prev => ({ ...prev, searchTerm: term }));
  };

  const setCurrentPage = (page) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  return {
    ...state,
    labels,
    debouncedSearchTerm,
    handleDelete,
    requestSort,
    updateSearchTerm,
    setCurrentPage,
    handleInitiateDelete,
    handleConfirmedDelete,
    setIsConfirmDialogOpen: (open) => setState(prev => ({ ...prev, isConfirmDialogOpen: open })),
    pageSize: state.empresa?.items_per_page || CONFIG.PAGE_SIZE_DEFAULT
  };
};

// Componente para o cabeçalho da tabela
const TableHeaderSortable = ({ columnKey, label, sortConfig, onSort, className }) => {
  const getSortIcon = () => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  return (
    <TableHead
      onClick={() => onSort(columnKey)}
      className={cn("cursor-pointer text-emerald-300", className)}
    >
      <div className="flex items-center">
        {label} {getSortIcon()}
      </div>
    </TableHead>
  );
};

// Componente para mostrar status do contrato
const ContractStatus = ({ clienteId, allContratos }) => {
  if (!allContratos || allContratos.length === 0) {
    return <span className="text-gray-400">Sem Contratos</span>;
  }

  const contratosDoCliente = allContratos.filter(c => c.cliente_id === clienteId);

  if (contratosDoCliente.length === 0) {
    return <span className="text-gray-400">Sem Contrato</span>;
  }

  const activeContract = contratosDoCliente.find(c => c.status === 'Ativo');

  if (activeContract) {
    return (
      <span className="text-emerald-400 font-semibold">
        {activeContract.numero_contrato}
      </span>
    );
  }

  const anyContract = contratosDoCliente[0];
  return (
    <span className="text-yellow-500" title={`Status: ${anyContract.status || 'Não definido'}`}>
      {anyContract.numero_contrato}
    </span>
  );
};

// Componente para diálogo de exclusão
const DeleteDialog = ({ cliente, labels, onDelete, disabled, relatedEntities, userRole }) => {
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    onDelete(cliente);
    setOpen(false);
  };

  const canDeleteByRole = ['administrador', 'gerente'].includes(userRole);
  const isDisabled = disabled || !canDeleteByRole;

  const getTooltipText = () => {
    if (!canDeleteByRole) {
      return 'Seu perfil não tem permissão para excluir clientes';
    }
    if (disabled) {
      return `Não é possível excluir - Existem ${relatedEntities.join(', ')} vinculados`;
    }
    return `Excluir ${labels.singularNoun}`;
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={getTooltipText()}
          disabled={isDisabled}
          className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
          <AlertDialogDescription className="text-emerald-300">
            Esta ação não pode ser desfeita. Isso excluirá permanentemente {labels.singularArticle} {labels.singularNoun}.
            Certifique-se de que não há coletas, contratos ou certificados vinculados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" className="rounded-xl">Cancelar</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              Excluir
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Componente para ações da linha
const RowActions = ({
  cliente,
  personType,
  labels,
  onDelete,
  onViewContracts,
  userRole
}) => {
  const navigate = useNavigate();
  const { canDelete, checking, relatedEntities } = useCanDeleteCliente(cliente.id);

  if (checking) {
    return (
      <div className="flex justify-end items-center gap-1">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex justify-end items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Ver Contratos"
        onClick={() => navigate(`/app/cadastro/contratos?clienteId=${cliente.id}`)}
      >
        <FileText className="h-4 w-4 text-cyan-400" />
      </Button>

      <Link to={`/app/cadastro/${personType === 'fornecedor' ? 'fornecedores' : 'clientes'}/editar/${cliente.id}`}>
        <Button variant="ghost" size="icon" title={`Editar ${labels.singularNoun}`}>
          <Edit className="h-4 w-4 text-yellow-400" />
        </Button>
      </Link>

      <DeleteDialog
        cliente={cliente}
        labels={labels}
        onDelete={onDelete}
        disabled={!canDelete}
        relatedEntities={relatedEntities}
        userRole={userRole}
      />
    </div>
  );
};

// Componente principal
const ListaClientes = ({ personType = 'pessoa' }) => {
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const labels = usePersonTypeLabels(personType);

  const {
    clientes,
    allContratos,
    loading,
    searchTerm,
    sortConfig,
    currentPage,
    handleDelete,
    handleInitiateDelete,
    handleConfirmedDelete,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    selectedForDeletion,
    requestSort,
    updateSearchTerm,
    setCurrentPage,
    totalCount,
    empresa,
    pageSize
  } = useClientesList(personType, profile);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleViewContracts = (clienteId) => {
    navigate(`/app/cadastro/contratos`, {
      state: { clienteId }
    });
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const documentInfo = selectedForDeletion
    ? `${selectedForDeletion.nome_fantasia || selectedForDeletion.razao_social} (${formatCnpjCpf(selectedForDeletion.cnpj_cpf)})`
    : '';

  return (
    <>
      <AdminConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmedDelete}
        currentUserId={profile?.id}
        documentInfo={documentInfo}
      />
      <Helmet>
        <title>Lista de {labels.listTitle} - Sistema RJR Óleo</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Users className="w-8 h-8 text-emerald-400" />
              Lista de {labels.listTitle}
              {profile?.role === 'coletor' && (
                <span className="text-sm text-emerald-300 bg-emerald-800/30 px-2 py-1 rounded-lg">
                  Meus Clientes
                </span>
              )}
              {(profile?.role === 'administrador' || profile?.role === 'gerente') && (
                <span className="text-sm text-blue-300 bg-blue-800/30 px-2 py-1 rounded-lg">
                  Todos os Clientes
                </span>
              )}
            </h1>
            <p className="text-emerald-200/80 mt-1">
              {profile?.role === 'coletor'
                ? `Visualize e gerencie seus clientes cadastrados.`
                : `Visualize e gerencie ${labels.listTitle.toLowerCase()} cadastradas.`
              }
            </p>
          </div>

          <Link
            to={personType === 'fornecedor' ? '/app/cadastro/fornecedores/novo' : '/app/cadastro/clientes/novo'}
            className='w-full sm:w-auto'
          >
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              {labels.pageVerb}
            </Button>
          </Link>
        </motion.div>

        {/* Search Bar */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              type="search"
              placeholder={`Buscar por nome fantasia, razão social, CNPJ/CPF, município ou estado d${labels.singularArticle} ${labels.singularNoun}...`}
              value={searchTerm}
              onChange={(e) => updateSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
            />
          </div>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl"
        >
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="border-white/20 hover:bg-transparent">
                    <TableHeaderSortable
                      columnKey="razao_social"
                      label="Nome Fantasia / Razão Social"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className={CONFIG.TABLE_COLUMNS.nome.width}
                    />
                    <TableHeaderSortable
                      columnKey="cnpj_cpf"
                      label="CPF/CNPJ/Outro"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className={CONFIG.TABLE_COLUMNS.cnpj_cpf.width}
                    />
                    <TableHeaderSortable
                      columnKey="endereco"
                      label="Endereço"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className={CONFIG.TABLE_COLUMNS.endereco.width}
                    />
                    <TableHeaderSortable
                      columnKey="municipio"
                      label="Localização"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className={CONFIG.TABLE_COLUMNS.municipio.width}
                    />
                    <TableHead className={cn("text-emerald-300", CONFIG.TABLE_COLUMNS.contrato.width)}>
                      Contrato
                    </TableHead>
                    <TableHead className={cn("text-emerald-300 text-right", CONFIG.TABLE_COLUMNS.acoes.width)}>
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.length > 0 ? (
                    clientes.map((cliente) => (
                      <TableRow
                        key={cliente.id}
                        className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm"
                      >
                        <TableCell
                          data-label="Nome Fantasia / Razão Social"
                          className="font-medium min-w-0"
                        >
                          {cliente.nome_fantasia && cliente.razao_social
                            ? `${cliente.nome_fantasia} - ${cliente.razao_social}`
                            : cliente.nome_fantasia || cliente.razao_social || 'Nome não informado'
                          }
                        </TableCell>
                        <TableCell data-label="CNPJ/CPF">
                          {formatCnpjCpf(cliente.cnpj_cpf)}
                        </TableCell>
                        <TableCell data-label="Endereço" className="max-w-[200px] truncate" title={cliente.endereco}>
                          {cliente.endereco || '-'}
                        </TableCell>
                        <TableCell data-label="Localização">
                          {cliente.municipio}, {cliente.estado}
                        </TableCell>
                        <TableCell data-label="Contrato">
                          <ContractStatus
                            clienteId={cliente.id}
                            allContratos={allContratos}
                          />
                        </TableCell>
                        <TableCell className="actions-cell text-right">
                          <RowActions
                            cliente={cliente}
                            personType={personType}
                            labels={labels}
                            onDelete={handleInitiateDelete}
                            onViewContracts={handleViewContracts}
                            userRole={profile?.role}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-white/70">
                        {profile?.role === 'coletor'
                          ? `Nenhum${labels.singularArticle === 'a' ? 'a' : ''} ${labels.singularNoun} cadastrado${labels.singularArticle === 'a' ? 'a' : ''} por você. Clique em "${labels.pageVerb}" para cadastrar seu primeiro${labels.singularArticle === 'a' ? 'a' : ''} ${labels.singularNoun}.`
                          : `Nenhum${labels.singularArticle === 'a' ? 'a' : ''} ${labels.singularNoun} encontrado${labels.singularArticle === 'a' ? 'a' : ''}.`
                        }
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </motion.div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>
    </>
  );
};

export default ListaClientes;