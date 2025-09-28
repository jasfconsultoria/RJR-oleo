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
import { formatCnpjCpf, escapePostgrestLikePattern } from '@/lib/utils';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';

// Constantes e configurações
const CONFIG = {
  PAGE_SIZE_DEFAULT: 25,
  DEBOUNCE_DELAY: 500,
  TABLE_COLUMNS: {
    nome: { label: 'Razão Social / Nome Fantasia', width: '25%' },
    cnpj_cpf: { label: 'CNPJ/CPF', width: '18%' },
    municipio: { label: 'Localização', width: '32%' },
    contrato: { label: 'Contrato', width: '15%' },
    acoes: { label: 'Ações', width: '10%' }
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
        basePath: 'clientes' // fallback
      }
    };
    
    return types[personType] || types.pessoa;
  }, [personType]);
};

// Hook para gerenciar o estado da lista
const useClientesList = (personType, profile) => {
  const [state, setState] = useState({
    clientes: [],
    allContratos: [],
    loading: true,
    searchTerm: '',
    sortConfig: { key: 'nome', direction: 'asc' },
    currentPage: 1,
    totalCount: 0,
    empresa: null
  });

  const debouncedSearchTerm = useDebounce(state.searchTerm, CONFIG.DEBOUNCE_DELAY);
  const { toast } = useToast();
  const labels = usePersonTypeLabels(personType);

  // Fetch dados da empresa
  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase
        .from('empresa')
        .select('items_per_page')
        .single();

      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ 
          title: "Erro ao buscar configurações da empresa.", 
          variant: "destructive" 
        });
      }

      setState(prev => ({
        ...prev,
        empresa: data || { items_per_page: CONFIG.PAGE_SIZE_DEFAULT }
      }));
    };

    fetchEmpresaData();
  }, [toast]);

  // Fetch todos os contratos
  useEffect(() => {
    const fetchAllContratos = async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, cliente_id, numero_contrato, status');

      if (error) {
        toast({ 
          title: 'Erro ao buscar contratos', 
          variant: 'destructive' 
        });
      } else {
        setState(prev => ({ ...prev, allContratos: data || [] }));
      }
    };

    fetchAllContratos();
  }, [toast]);

  // Fetch clientes com paginação e filtros
  const fetchClientes = useCallback(async () => {
    if (!profile || !state.empresa) return;

    setState(prev => ({ ...prev, loading: true }));
    
    const from = (state.currentPage - 1) * state.empresa.items_per_page;
    const to = from + state.empresa.items_per_page - 1;

    let query = supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado', { 
        count: 'exact' 
      });

    // Aplicar filtro de busca
    if (debouncedSearchTerm) {
      const escapedSearchTerm = escapePostgrestLikePattern(debouncedSearchTerm);
      query = query.or(
        `nome.ilike.%${escapedSearchTerm}%,` +
        `nome_fantasia.ilike.%${escapedSearchTerm}%,` +
        `cnpj_cpf.ilike.%${escapedSearchTerm}%,` +
        `municipio.ilike.%${escapedSearchTerm}%,` +
        `estado.ilike.%${escapedSearchTerm}%`
      );
    }

    // Aplicar ordenação
    query = query.order(state.sortConfig.key, { 
      ascending: state.sortConfig.direction === 'asc' 
    }).range(from, to);

    const { data: clientesData, error: clientesError, count } = await query;

    if (clientesError) {
      toast({
        title: 'Erro ao carregar clientes',
        description: clientesError.message,
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, clientes: [] }));
    } else {
      setState(prev => ({ 
        ...prev, 
        clientes: clientesData || [], 
        totalCount: count || 0 
      }));
    }

    setState(prev => ({ ...prev, loading: false }));
  }, [profile, state.currentPage, state.empresa, debouncedSearchTerm, state.sortConfig, toast]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Resetar página quando search term ou page size mudar
  useEffect(() => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchTerm, state.empresa?.items_per_page]);

  // Actions
  const handleDelete = async (cliente) => {
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
        client_name: cliente.nome 
      });
    } else {
      toast({
        title: `${labels.singularNoun} excluído!`,
        description: `O ${labels.singularNoun} foi removido com sucesso.`,
      });
      await logAction('delete_client_success', { 
        client_id: cliente.id, 
        client_name: cliente.nome 
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
    pageSize: state.empresa?.items_per_page || CONFIG.PAGE_SIZE_DEFAULT
  };
};

// Componente para o cabeçalho da tabela
const TableHeaderSortable = ({ columnKey, label, sortConfig, onSort }) => {
  const getSortIcon = () => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 ml-1" /> 
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  return (
    <th 
      onClick={() => onSort(columnKey)} 
      className="cursor-pointer text-white p-2 text-left"
      style={{ width: CONFIG.TABLE_COLUMNS[columnKey]?.width }}
    >
      <div className="flex items-center">
        {label} {getSortIcon()}
      </div>
    </th>
  );
};

// Componente para mostrar status do contrato
const ContractStatus = ({ clienteId, allContratos }) => {
  if (allContratos.length === 0) {
    return <span className="text-gray-400">Carregando...</span>;
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

  return <span className="text-yellow-500">Contrato Inativo/Vencido</span>;
};

// Componente para ações da linha
const RowActions = ({ 
  cliente, 
  personType, 
  labels, 
  onDelete, 
  onViewContracts 
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-start items-center gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        title="Ver Contratos" 
        onClick={() => navigate(`/app/cadastro/contratos?clienteId=${cliente.id}`)}

//        onClick={() => onViewContracts(cliente.id)}
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
      />
    </div>
  );
};

// Componente para diálogo de exclusão
const DeleteDialog = ({ cliente, labels, onDelete }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="icon" title={`Excluir ${labels.singularNoun}`}>
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
            onClick={() => onDelete(cliente)} 
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
          >
            Excluir
          </Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

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
    totalCount,
    empresa,
    handleDelete,
    requestSort,
    updateSearchTerm,
    setCurrentPage,
    pageSize
  } = useClientesList(personType, profile);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleViewContracts = (clienteId) => {
    navigate(`/app/cadastro/contratos`, { 
      state: { clienteId } 
    });
  };

  if (profileLoading || !empresa) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
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
            </h1>
            <p className="text-emerald-200/80 mt-1">
              Visualize e gerencie {labels.listTitle.toLowerCase()} cadastradas.
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
              placeholder={`Buscar por nome, CNPJ/CPF, município ou estado d${labels.singularArticle} ${labels.singularNoun}...`}
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
                  <TableRow className="hover:bg-white/10 border-b border-white/20 text-xs">
                    <TableHeaderSortable
                      columnKey="nome"
                      label="Razão Social / Nome Fantasia"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                    />
                    <TableHeaderSortable
                      columnKey="cnpj_cpf"
                      label="CNPJ/CPF"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                    />
                    <TableHeaderSortable
                      columnKey="municipio"
                      label="Localização"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                    />
                    <th className="text-left text-white p-2" style={{ width: '15%' }}>
                      Contrato
                    </th>
                    <th className="text-left text-white p-2" style={{ width: '10%' }}>
                      Ações
                    </th>
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
                          data-label="Razão Social / Nome Fantasia" 
                          className="font-medium p-2 truncate min-w-0"
                        >
                          {cliente.nome_fantasia 
                            ? `${cliente.nome} - ${cliente.nome_fantasia}` 
                            : cliente.nome
                          }
                        </TableCell>
                        <TableCell data-label="CNPJ/CPF" className="p-2">
                          {formatCnpjCpf(cliente.cnpj_cpf)}
                        </TableCell>
                        <TableCell data-label="Localização" className="p-2">
                          {cliente.municipio}, {cliente.estado}
                        </TableCell>
                        <TableCell data-label="Contrato" className="p-2">
                          <ContractStatus 
                            clienteId={cliente.id} 
                            allContratos={allContratos} 
                          />
                        </TableCell>
                        <TableCell className="p-2 actions-cell text-left">
                          <RowActions
                            cliente={cliente}
                            personType={personType}
                            labels={labels}
                            onDelete={handleDelete}
                            onViewContracts={handleViewContracts}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-white/70">
                        Nenhum{labels.singularArticle === 'a' ? 'a' : ''} {labels.singularNoun} encontrado{labels.singularArticle === 'a' ? 'a' : ''}.
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