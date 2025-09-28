import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, ArrowDownSquare, Loader2, Info, User, Search, X } from 'lucide-react';
import { logAction } from '@/lib/logger';
import MovimentacaoFormFields from '@/components/estoque/MovimentacaoFormFields';
import ItensMovimentacaoTable from '@/components/estoque/ItensMovimentacaoTable';
import { parseCurrency, formatCnpjCpf } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAutoSave2 } from '@/hooks/useAutoSave2';

const EntradaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);
  const { user } = useAuth();

  console.log('🎯 EntradaFormPage - isEditing:', isEditing, 'id:', id);

  // ✅ AUTO-SAVE: Chave única
  const autoSaveKey = `entradaForm_${id || 'new'}`;

  const getEmptyFormData = () => ({
    data: new Date(),
    tipo: 'entrada',
    origem: 'manual',
    document_number: '',
    cliente_id: null,
    cliente_nome: '',
    cliente_nome_fantasia: '',
    cnpj_cpf: '',
    coleta_id: null,
    observacao: '',
    itens: [{ id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }],
    cliente: '',
  });

  // ✅ AUTO-SAVE: Usar o novo hook
  const [formData, setFormData, clearSavedData] = useAutoSave2(
    autoSaveKey,
    getEmptyFormData()
  );

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // === CLIENTE AUTOCOMPLETE STATES ===
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [isClienteSelected, setIsClienteSelected] = useState(false);
  const dropdownRef = useRef(null);
  const documentNumberRef = useRef(null);

  // ✅ CORREÇÃO: Verificar auto-save de forma mais precisa
  useEffect(() => {
    const checkAutoSave = () => {
      try {
        const saved = localStorage.getItem(autoSaveKey);
        if (saved && saved !== 'null' && saved !== 'undefined' && saved !== '{}') {
          const parsed = JSON.parse(saved);
          // Verificar se há dados realmente válidos
          const hasRealData = 
            parsed.document_number !== '' || 
            parsed.cliente_id !== null || 
            parsed.observacao !== '' || 
            (parsed.itens && parsed.itens.some(item => 
              item.produto_id !== null || item.quantidade !== ''
            ));
          
          setHasAutoSaveData(hasRealData);
          console.log('📋 Verificação auto-save:', { hasRealData, saved: parsed });
        } else {
          setHasAutoSaveData(false);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar auto-save:', error);
        setHasAutoSaveData(false);
      }
    };

    // Verificar imediatamente e depois a cada mudança
    checkAutoSave();
    
    // Também verificar quando o formData mudar
    const handleStorageChange = () => {
      checkAutoSave();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [autoSaveKey, formData]);

  // ✅ CORREÇÃO: Inicialização segura
  useEffect(() => {
    if (!initialized) {
      console.log('🚀 Inicializando formulário...');
      setInitialized(true);
      
      // Para novas entradas, focar no campo após um breve delay
      if (!isEditing && documentNumberRef.current) {
        setTimeout(() => {
          documentNumberRef.current?.focus();
          console.log('🎯 Foco no campo documento');
        }, 300);
      }
    }
  }, [isEditing, initialized]);

  // Fetch all clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        console.log('🔍 Buscando clientes...');
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('nome', { ascending: true });

        if (error) throw error;

        console.log('✅ Clientes carregados:', data?.length);
        setAllClients(data || []);
        setFilteredClients(data || []);
      } catch (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setAllClients([]);
        setFilteredClients([]);
      }
    };

    fetchClients();
  }, [toast]);

  // FILTRO: nome | nome_fantasia | cnpj (formatado)
  useEffect(() => {
    if (formData.cliente && formData.cliente.trim()) {
      const searchTerm = formData.cliente.toLowerCase();
      const filtered = allClients.filter(client =>
        client.nome.toLowerCase().includes(searchTerm) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm)) ||
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(allClients);
    }
  }, [formData.cliente, allClients]);

  // ✅ CORREÇÃO: Fetch apenas para edição
  const fetchMovimentacao = useCallback(async () => {
    if (!isEditing) {
      console.log('📝 Nova entrada - usando auto-save se disponível');
      setLoading(false);
      return;
    }

    console.log('🔍 Buscando dados da movimentação...');
    setLoading(true);
    try {
      const { data: movimentacaoData, error: movimentacaoError } = await supabase
        .from('entrada_saida')
        .select('*, cliente:clientes(id, nome, nome_fantasia, cnpj_cpf)')
        .eq('id', id)
        .single();

      if (movimentacaoError) throw movimentacaoError;

      const { data: itensData, error: itensError } = await supabase
        .from('itens_entrada_saida')
        .select('*, produto:produtos(nome, unidade, tipo, codigo)')
        .eq('entrada_saida_id', id);

      if (itensError) throw itensError;

      const clienteDisplay = movimentacaoData.cliente?.nome_fantasia 
        ? `${movimentacaoData.cliente.nome} - ${movimentacaoData.cliente.nome_fantasia}` 
        : movimentacaoData.cliente?.nome || '';

      const fetchedData = {
        ...movimentacaoData,
        data: new Date(movimentacaoData.data),
        cliente_id: movimentacaoData.cliente?.id || null,
        cliente_nome: movimentacaoData.cliente?.nome || '',
        cliente_nome_fantasia: movimentacaoData.cliente?.nome_fantasia || '',
        cnpj_cpf: movimentacaoData.cliente?.cnpj_cpf || '',
        cliente: clienteDisplay,
        itens: itensData.map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto.nome,
          unidade: item.produto.unidade,
          tipo: item.produto.tipo,
          codigo: item.produto.codigo,
          quantidade: String(item.quantidade).replace('.', ','),
        })),
      };

      console.log('✅ Dados do banco carregados:', fetchedData);
      
      // ✅ IMPORTANTE: Para edição, SEMPRE usar dados do banco
      setFormData(fetchedData);
      setIsClienteSelected(!!movimentacaoData.cliente_id);
    } catch (error) {
      console.error("❌ Error fetching movimentacao data:", error);
      toast({ 
        title: 'Erro ao carregar movimentação', 
        description: error.message, 
        variant: 'destructive' 
      });
      navigate('/app/estoque/movimentacoes');
    } finally {
      setLoading(false);
      console.log('✅ Fetch finalizado');
    }
  }, [id, isEditing, navigate, toast, setFormData]);

  // ✅ CORREÇÃO: Fetch condicional mais seguro
  useEffect(() => {
    if (isEditing && initialized) {
      console.log('🔄 Iniciando fetch para edição...');
      fetchMovimentacao();
    }
  }, [isEditing, fetchMovimentacao, initialized]);

  // === Handlers ===
  const handleFormChange = (name, value) => {
    console.log('🔄 Alterando campo:', name, 'para:', value);
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === 'cliente') {
      if (value.trim() !== '') {
        setShowClienteDropdown(true);
      } else {
        setShowClienteDropdown(false);
      }
      setIsClienteSelected(false);
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'origem' && value !== 'coleta') {
      setFormData((prev) => ({ 
        ...prev, 
        coleta_id: null, 
        cliente_id: null, 
        cliente_nome: '', 
        cliente_nome_fantasia: '', 
        cnpj_cpf: '',
        cliente: '' 
      }));
      setIsClienteSelected(false);
    }
  };

  const handleColetaSelect = (coleta) => {
    if (coleta) {
      const clienteDisplay = coleta.cliente_nome_fantasia 
        ? `${coleta.cliente_nome} - ${coleta.cliente_nome_fantasia}` 
        : coleta.cliente_nome;

      setFormData((prev) => ({
        ...prev,
        coleta_id: coleta.id,
        cliente_id: coleta.cliente_id,
        document_number: coleta.numero_coleta?.toString().padStart(6, '0'),
        observacao: `Movimentação referente à coleta Nº ${coleta.numero_coleta?.toString().padStart(6, '0')} do cliente ${coleta.cliente_nome}.`,
        cliente_nome: coleta.cliente_nome,
        cliente_nome_fantasia: coleta.cliente_nome_fantasia,
        cnpj_cpf: coleta.cliente_cnpj_cpf,
        cliente: clienteDisplay,
      }));
      setIsClienteSelected(true);
    } else {
      setFormData((prev) => ({
        ...prev,
        coleta_id: null,
        cliente_id: null,
        document_number: '',
        observacao: '',
        cliente_nome: '',
        cliente_nome_fantasia: '',
        cnpj_cpf: '',
        cliente: '',
      }));
      setIsClienteSelected(false);
    }
  };

  const handleClientSelect = (client) => {
    const clienteDisplay = client.nome_fantasia 
      ? `${client.nome} - ${client.nome_fantasia}` 
      : client.nome;

    setFormData(prev => ({
      ...prev,
      cliente_id: client.id,
      cliente_nome: client.nome,
      cliente_nome_fantasia: client.nome_fantasia || '',
      cnpj_cpf: client.cnpj_cpf || '',
      cliente: clienteDisplay,
    }));
    setShowClienteDropdown(false);
    setIsClienteSelected(true);
  };

  const handleClearClient = () => {
    setFormData(prev => ({
      ...prev,
      cliente_id: null,
      cliente_nome: '',
      cliente_nome_fantasia: '',
      cnpj_cpf: '',
      cliente: '',
    }));
    setIsClienteSelected(false);
    setShowClienteDropdown(false);
  };

  const handleFocus = () => {
    setShowClienteDropdown(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowClienteDropdown(false);
      
      if (!isClienteSelected && formData.cliente.trim() !== '') {
        const isMatch = allClients.some(client => {
          const clientDisplayName = client.nome_fantasia 
            ? `${client.nome} - ${client.nome_fantasia}` 
            : client.nome;
          return clientDisplayName === formData.cliente;
        });
        
        if (!isMatch) {
          setFormData(prev => ({ 
            ...prev, 
            cliente_id: null, 
            cliente_nome: '', 
            cliente_nome_fantasia: '', 
            cnpj_cpf: '',
            cliente: '' 
          }));
          setIsClienteSelected(false);
        }
      }
    }, 200);
  };

  const handleItemsChange = (newItems) => {
    setFormData((prev) => ({ ...prev, itens: newItems }));
  };

  const validateForm = () => {
    if (!formData.data || !formData.tipo || !formData.origem) {
      toast({ title: 'Campos obrigatórios', description: 'Data, Tipo e Origem são obrigatórios.', variant: 'destructive' });
      return false;
    }
    if (formData.origem === 'manual' && !formData.cliente_id) {
      toast({ title: 'Campo obrigatório', description: 'O campo Cliente é obrigatório para origem manual.', variant: 'destructive' });
      return false;
    }
    if (formData.origem === 'coleta' && !formData.coleta_id) {
      toast({ title: 'Campo obrigatório', description: 'Selecione uma Coleta para origem de coleta.', variant: 'destructive' });
      return false;
    }
    if (formData.itens.length === 0 || (formData.itens.length === 1 && !formData.itens[0].produto_id && formData.itens[0].quantidade === '')) {
      toast({ title: 'Itens da movimentação', description: 'Adicione pelo menos um item válido à movimentação.', variant: 'destructive' });
      return false;
    }
    for (const item of formData.itens) {
      if (item.produto_id || item.quantidade !== '') {
        if (!item.produto_id) {
          toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: selecione um produto para cada linha preenchida.', variant: 'destructive' });
          return false;
        }
        if (parseCurrency(item.quantidade) <= 0) {
          toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: a quantidade deve ser maior que zero para linhas preenchidas.', variant: 'destructive' });
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const itensToSave = formData.itens.filter(item => item.produto_id !== null || item.quantidade !== '');

      const { 
        itens, 
        cliente, 
        cliente_nome, 
        cliente_nome_fantasia, 
        cnpj_cpf, 
        ...movimentacaoHeaderToSave 
      } = formData; 
      
      movimentacaoHeaderToSave.user_id = user?.id;

      let savedMovimentacao;
      if (isEditing) {
        const { data, error } = await supabase
          .from('entrada_saida')
          .update(movimentacaoHeaderToSave)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;

        const { error: deleteError } = await supabase.from('itens_entrada_saida').delete().eq('entrada_saida_id', id);
        if (deleteError) throw deleteError;

      } else {
        const { data, error } = await supabase
          .from('entrada_saida')
          .insert(movimentacaoHeaderToSave)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;
      }

      const itensToInsert = itensToSave.map(item => ({
        entrada_saida_id: savedMovimentacao.id,
        produto_id: item.produto_id,
        quantidade: parseCurrency(item.quantidade),
      }));

      const { error: itensInsertError } = await supabase
        .from('itens_entrada_saida')
        .insert(itensToInsert);
      if (itensInsertError) throw itensInsertError;

      await logAction(isEditing ? 'update_stock_entry' : 'create_stock_entry', {
        movimentacao_id: savedMovimentacao.id,
        tipo: savedMovimentacao.tipo,
        origem: savedMovimentacao.origem,
        document_number: savedMovimentacao.document_number,
        coleta_id: savedMovimentacao.coleta_id,
      });

      // ✅ AUTO-SAVE: Limpar após salvar com sucesso
      clearSavedData();
      setHasAutoSaveData(false);
      
      toast({ title: `Movimentação de ${formData.tipo} ${isEditing ? 'atualizada' : 'registrada'} com sucesso!` });
      navigate('/app/estoque/movimentacoes');

    } catch (error) {
      toast({ title: `Erro ao salvar movimentação de ${formData.tipo}`, description: error.message, variant: 'destructive' });
      await logAction(isEditing ? 'update_stock_entry_failed' : 'create_stock_entry_failed', {
        error: error.message,
        tipo: formData.tipo,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/app/estoque/movimentacoes');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-2">Carregando dados...</span>
      </div>
    );
  }

  console.log('🎨 Renderizando formulário - hasAutoSaveData:', hasAutoSaveData);

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Editar Entrada' : 'Nova Entrada'} de Estoque - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-4"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-emerald-300">
              <ArrowDownSquare className="w-5 h-5" />
              {isEditing ? 'Editar Entrada' : 'Nova Entrada'} de Estoque
              {/* ✅ INDICADOR DE AUTO-SAVE - APENAS PARA NOVAS ENTRADAS */}
              {hasAutoSaveData && !isEditing && (
                <span className="text-xs text-yellow-400 ml-2">(Alterações não salvas)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <MovimentacaoFormFields
                formData={formData}
                handleChange={handleFormChange}
                handleSelectChange={handleSelectChange}
                handleColetaSelect={handleColetaSelect}
                isEditing={isEditing}
                type="entrada"
                documentNumberRef={documentNumberRef}
              />

              {formData.origem === 'manual' && (
                <div className="space-y-2 relative" ref={dropdownRef}>
                  <Label htmlFor="cliente" className="text-xs flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Cliente <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
                    <Input
                      id="cliente"
                      value={formData.cliente}
                      onChange={(e) => handleFormChange('cliente', e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Digite para buscar cliente..."
                      className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl h-8 text-xs pr-10"
                      autoComplete="off"
                      required={formData.origem === 'manual'}
                      disabled={isEditing}
                    />
                    {formData.cliente && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-white/70 hover:text-white rounded-full" 
                        onClick={handleClearClient}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {showClienteDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1 border border-gray-200"
                    >
                      {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                          <div
                            key={client.id}
                            onMouseDown={() => handleClientSelect(client)}
                            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                          >
                            <div className="font-medium text-gray-900 text-sm">
                              {client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome}
                            </div>
                            <div className="text-xs text-gray-600">
                              {formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-gray-500 text-sm">
                          {formData.cliente ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              <div>
                <ItensMovimentacaoTable
                  items={formData.itens}
                  onItemsChange={handleItemsChange}
                  type="entrada"
                  isEditing={isEditing}
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="observacao" className="text-xs flex items-center gap-1">
                  <Info className="w-3 h-3" /> Observação
                </Label>
                <Textarea
                  id="observacao"
                  name="observacao"
                  value={formData.observacao}
                  onChange={(e) => handleFormChange('observacao', e.target.value)}
                  placeholder="Detalhes adicionais sobre a movimentação..."
                  className="bg-white/5 border-white/20 rounded-xl text-xs min-h-[60px]"
                />
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button 
                  type="button" 
                  onClick={handleBack} 
                  variant="outline" 
                  className="rounded-xl h-8 px-2 text-xs"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Voltar
                </Button>
                
                <div className="flex gap-2">
                  {/* ✅ BOTÃO DESCARTAR ALTERAÇÕES - APENAS PARA NOVAS ENTRADAS */}
                  {hasAutoSaveData && !isEditing && (
                    <Button 
                      type="button"
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja descartar todas as alterações não salvas?')) {
                          clearSavedData();
                          setFormData(getEmptyFormData());
                          setHasAutoSaveData(false);
                        }
                      }}
                      variant="outline"
                      className="rounded-xl h-8 px-2 text-xs text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
                    >
                      Descartar Alterações
                    </Button>
                  )}
                  
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-8 px-2 text-xs"
                  >
                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default EntradaFormPage;