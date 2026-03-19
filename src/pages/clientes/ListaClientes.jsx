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
  FileText,
  Truck,
  MapPin,
  Filter
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { formatCnpjCpf, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocationData } from '@/hooks/useLocationData';
import AdminConfirmationDialog from '@/components/financeiro/AdminConfirmationDialog';
import ClientesFilters from '@/components/clientes/ClientesFilters';

// Constantes e configurações
const CONFIG = {
  PAGE_SIZE_DEFAULT: 25,
  DEBOUNCE_DELAY: 500,
  TABLE_COLUMNS: {
    nome: { label: 'Nome Fantasia / Razão Social', width: 'w-[15%]' },
    cnpj_cpf: { label: 'CNPJ/CPF', width: 'w-[10%]' },
    endereco: { label: 'Endereço', width: 'w-[20%]' },
    localizacao: { label: 'Localização', width: 'w-[10%]' },
    inteligencia: { label: 'Inteligência de Coleta', width: 'w-[15%]' },
    contrato: { label: 'Contrato', width: 'w-[10%]' },
    acoes: { label: 'Ações', width: 'w-[12%]' }
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
    allClientes: [], // Todos os clientes do banco (respeitando o RLS/Role) sem paginação
    allContratos: [],
    loading: true,
    searchTerm: '',
    sortConfig: { key: 'razao_social', direction: 'asc' },
    currentPage: 1,
    totalCount: 0,
    filterEstado: 'todos',
    filterMunicipio: 'todos',
    empresa: { items_per_page: CONFIG.PAGE_SIZE_DEFAULT },
    isConfirmDialogOpen: false,
    selectedForDeletion: null,
    municipioMap: {} // Novo campo para mapeamento de códigos
  });

  const { estados, fetchMunicipiosByCodes } = useLocationData();
  const { toast } = useToast();
  const labels = usePersonTypeLabels(personType);
  const debouncedSearchTerm = useDebounce(state.searchTerm, 500);

  // Fetch dados da empresa
  useEffect(() => {
    const fetchEmpresaData = async () => {
      const userRole = profile?.role;
      const canAccessEmpresa = ['super_admin', 'administrador', 'gerente'].includes(userRole);

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
        .select('id, nome_fantasia, razao_social, cnpj_cpf, endereco, municipio, estado, user_id, media_dias_coleta, data_ultima_coleta, proxima_coleta_prevista, latitude, longitude, recipientes_saldo', {
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
      } else if (['super_admin', 'administrador', 'gerente'].includes(profile.role)) {
        clientesFiltrados = allClientes;
        totalFiltrado = count || 0;
        console.log('👑 Admin/Super Admin vendo todos os clientes:', totalFiltrado);
      }

      // Armazenar os clientes brutos para os filtros geográficos (allClientes)
      const rawClients = [...clientesFiltrados];

      // Aplicar busca se houver termo
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        clientesFiltrados = clientesFiltrados.filter(cliente => {
          const municipioNome = (!isNaN(cliente.municipio) && state.municipioMap[cliente.municipio]) 
            ? state.municipioMap[cliente.municipio] 
            : cliente.municipio;

          return (
            cliente.nome_fantasia?.toLowerCase()?.includes(term) ||
            cliente.razao_social?.toLowerCase()?.includes(term) ||
            cliente.cnpj_cpf?.includes(term) ||
            municipioNome?.toLowerCase()?.includes(term) ||
            cliente.estado?.toLowerCase()?.includes(term)
          );
        });
        totalFiltrado = clientesFiltrados.length;
      }

      // Filtros Geográficos
      if (state.filterEstado !== 'todos') {
        clientesFiltrados = clientesFiltrados.filter(c => c.estado === state.filterEstado);
      }
      if (state.filterMunicipio !== 'todos') {
        clientesFiltrados = clientesFiltrados.filter(c => c.municipio === state.filterMunicipio);
      }
      totalFiltrado = clientesFiltrados.length;

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

      // Resolver nomes de municípios para novos códigos
      const codesToResolve = [...new Set(rawClients.map(c => c.municipio).filter(c => c && !isNaN(c)))];
      if (codesToResolve.length > 0) {
        const mapping = await fetchMunicipiosByCodes(codesToResolve);
        setState(prev => ({ ...prev, municipioMap: { ...prev.municipioMap, ...mapping } }));
      }

      setState(prev => ({
        ...prev,
        allClientes: rawClients,
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
      setState(prev => ({ ...prev, clientes: [], allClientes: [], loading: false }));
    }
  }, [profile, state.currentPage, state.empresa, debouncedSearchTerm, state.sortConfig, state.filterEstado, state.filterMunicipio, toast]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Resetar página quando search term ou page size mudar
  useEffect(() => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, state.empresa?.items_per_page, state.filterEstado, state.filterMunicipio]);

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

  const setFilterEstado = (estado) => {
    setState(prev => ({ ...prev, filterEstado: estado, filterMunicipio: 'todos' }));
  };

  const setFilterMunicipio = (municipio) => {
    setState(prev => ({ ...prev, filterMunicipio: municipio }));
  };

  return {
    ...state,
    labels,
    debouncedSearchTerm,
    handleDelete,
    requestSort,
    updateSearchTerm,
    setCurrentPage,
    setFilterEstado,
    setFilterMunicipio,
    handleInitiateDelete,
    handleConfirmedDelete,
    setIsConfirmDialogOpen: (open) => setState(prev => ({ ...prev, isConfirmDialogOpen: open })),
    pageSize: state.empresa?.items_per_page || CONFIG.PAGE_SIZE_DEFAULT,
    municipioMap: state.municipioMap
  };
};

// Hook para extrair estados e municípios únicos
const useGeoFilters = (allClientes, filterEstado, municipioMap) => {
  const estados = useMemo(() => {
    return [...new Set(allClientes.map(c => c.estado).filter(Boolean))].sort();
  }, [allClientes]);

  const municipios = useMemo(() => {
    let filtered = allClientes;
    if (filterEstado !== 'todos') {
      filtered = filtered.filter(c => c.estado === filterEstado);
    }

    // Extrair municípios únicos. 
    // Se for um código, tenta resolver o nome.
    const uniqueVals = [...new Set(filtered.map(c => c.municipio).filter(Boolean))];

    return uniqueVals.map(val => {
      if (!isNaN(val) && municipioMap[val]) {
        return { value: val, label: municipioMap[val] };
      }
      return { value: val, label: val };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [allClientes, filterEstado, municipioMap]);

  return { estados, municipios };
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
        title="Ver Coletas"
        onClick={() => navigate(`/app/coletas?clienteId=${cliente.id}`)}
      >
        <Truck className="h-4 w-4 text-emerald-400" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        title={cliente.latitude && cliente.longitude ? "Abrir GPS" : "Sem coordenadas cadastradas"}
        disabled={!cliente.latitude || !cliente.longitude}
        onClick={() => {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${cliente.latitude},${cliente.longitude}`;
          window.open(url, '_blank');
        }}
        className={!cliente.latitude || !cliente.longitude ? "opacity-30" : ""}
      >
        <MapPin className="h-4 w-4 text-blue-400" />
      </Button>

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
    pageSize,
    allClientes,
    filterEstado,
    filterMunicipio,
    setFilterEstado,
    setFilterMunicipio,
    municipioMap
  } = useClientesList(personType, profile);

  const { estados, municipios } = useGeoFilters(allClientes, filterEstado, municipioMap);

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
              {['administrador', 'gerente', 'super_admin'].includes(profile?.role) && (
                <span className="text-sm text-blue-300 bg-blue-800/30 px-2 py-1 rounded-lg">
                  Todos os {labels.listTitle}
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
            state={{ clearForm: true }}
            className='w-full sm:w-auto'
          >
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              {labels.pageVerb}
            </Button>
          </Link>
        </motion.div>

        {/* Search and Filters Bar */}
        <ClientesFilters
          searchTerm={searchTerm}
          updateSearchTerm={updateSearchTerm}
          filterEstado={filterEstado}
          setFilterEstado={setFilterEstado}
          filterMunicipio={filterMunicipio}
          setFilterMunicipio={setFilterMunicipio}
          estados={estados}
          municipios={municipios}
          labels={labels}
        />

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
                      className={CONFIG.TABLE_COLUMNS.localizacao.width}
                    />
                    <TableHead className={cn("text-emerald-300 whitespace-nowrap text-center", CONFIG.TABLE_COLUMNS.inteligencia.width)}>
                      Coleta (Última / Média / Próxima)
                    </TableHead>
                    <TableHeaderSortable
                      columnKey="recipientes_saldo"
                      label="Recipientes"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className="w-[10%]"
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
                          {!isNaN(cliente.municipio) && municipioMap[cliente.municipio]
                            ? municipioMap[cliente.municipio]
                            : cliente.municipio}, {cliente.estado}
                        </TableCell>
                        <TableCell data-label="Inteligência">
                          <div className="flex flex-row items-center justify-center gap-2 whitespace-nowrap">
                            {cliente.data_ultima_coleta ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-white/70 border border-white/10" title="Última Coleta">
                                {format(new Date(cliente.data_ultima_coleta), 'dd/MM/yyyy')}
                              </span>
                            ) : (
                              <span className="text-white/30 text-[10px]">Sem histórico</span>
                            )}
                            <span className="text-[10px] text-white/50">{cliente.media_dias_coleta || '?'}d</span>
                            {cliente.proxima_coleta_prevista && (
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                new Date(cliente.proxima_coleta_prevista) < new Date() ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                              )} title="Próxima Coleta">
                                {format(new Date(cliente.proxima_coleta_prevista), 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-label="Recipientes" className="text-center font-semibold text-emerald-400">
                          {cliente.recipientes_saldo || 0}
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