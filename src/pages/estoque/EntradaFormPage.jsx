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

const EntradaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
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
    itens: [{ id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }], // Inicializa com um item vazio
    cliente: '', // Campo único para busca,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // === CLIENTE AUTOCOMPLETE STATES ===
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [isClienteSelected, setIsClienteSelected] = useState(false);
  const dropdownRef = useRef(null);
  const documentNumberRef = useRef(null); // Ref para o campo Número do Documento

  // Focar no campo Número do Documento ao carregar (apenas para novas entradas)
  useEffect(() => {
    if (documentNumberRef.current && !isEditing) {
      documentNumberRef.current.focus();
    }
  }, [isEditing]);

  // Fetch all clients (SEM filtrar por contratos ativos)
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('razao_social', { ascending: true });

        if (error) throw error;

        setAllClients(data || []);
        setFilteredClients(data || []);
      } catch (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setAllClients([]);
        setFilteredClients([]);
      }
    };

    fetchClients();
  }, [toast]);

  // FILTRO: razao_social | nome_fantasia | cnpj (formatado)
  useEffect(() => {
    if (formData.cliente && formData.cliente.trim()) {
      const searchTerm = formData.cliente.toLowerCase();
      const filtered = allClients.filter(client =>
        client.razao_social.toLowerCase().includes(searchTerm) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm)) ||
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(allClients);
    }
  }, [formData.cliente, allClients]);

  // === Fetch movimentacao quando editar ===
  const fetchMovimentacao = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: movimentacaoData, error: movimentacaoError } = await supabase
        .from('entrada_saida')
        .select('*, cliente:clientes(id, razao_social, nome_fantasia, cnpj_cpf)')
        .eq('id', id)
        .single();

      if (movimentacaoError) throw movimentacaoError;

      const { data: itensData, error: itensError } = await supabase
        .from('itens_entrada_saida')
        .select('*, produto:produtos(nome, unidade, tipo, codigo)')
        .eq('entrada_saida_id', id);

      if (itensError) throw itensError;

      const clienteDisplay = movimentacaoData.cliente?.nome_fantasia 
        ? `${movimentacaoData.cliente.nome_fantasia} - ${movimentacaoData.cliente.razao_social}` 
        : movimentacaoData.cliente?.razao_social || '';

      setFormData({
        ...movimentacaoData,
        data: new Date(movimentacaoData.data),
        cliente_id: movimentacaoData.cliente?.id || null,
        cliente_nome: movimentacaoData.cliente?.razao_social || '',
        cliente_nome_fantasia: movimentacaoData.cliente?.nome_fantasia || '',
        cnpj_cpf: movimentacaoData.cliente?.cnpj_cpf || '',
        cliente: clienteDisplay, // Campo de busca
        itens: itensData.map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto.nome,
          unidade: item.produto.unidade,
          tipo: item.produto.tipo,
          codigo: item.produto.codigo,
          quantidade: String(item.quantidade).replace('.', ','),
        })),
      });
      setIsClienteSelected(!!movimentacaoData.cliente_id);
    } catch (error) {
      toast({ title: 'Erro ao carregar movimentação', description: error.message, variant: 'destructive' });
      navigate('/app/estoque/movimentacoes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchMovimentacao();
  }, [fetchMovimentacao]);

  // === Handlers ===
  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Mostrar dropdown quando começar a digitar no campo cliente
    if (name === 'cliente') {
      if (value.trim() !== '') {
        setShowClienteDropdown(true);
      } else {
        setShowClienteDropdown(false);
      }
      // Importante: sinaliza que o usuário está digitando (não é mais um cliente selecionado)
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
        ? `${coleta.cliente_nome_fantasia} - ${coleta.cliente_razao_social}` 
        : coleta.cliente_razao_social;

      setFormData((prev) => ({
        ...prev,
        coleta_id: coleta.id,
        cliente_id: coleta.cliente_id,
        document_number: coleta.numero_coleta?.toString().padStart(6, '0'),
        observacao: `Movimentação referente à coleta Nº ${coleta.numero_coleta?.toString().padStart(6, '0')} do cliente ${coleta.cliente_razao_social}.`,
        cliente_nome: coleta.cliente_razao_social,
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

  // === HANDLE CLIENT SELECT ===
  const handleClientSelect = (client) => {
    const clienteDisplay = client.nome_fantasia 
      ? `${client.nome_fantasia} - ${client.razao_social}` 
      : client.razao_social;

    setFormData(prev => ({
      ...prev,
      cliente_id: client.id,
      cliente_nome: client.razao_social,
      cliente_nome_fantasia: client.nome_fantasia || '',
      cnpj_cpf: client.cnpj_cpf || '',
      cliente: clienteDisplay,
    }));
    setShowClienteDropdown(false);
    // marca como selecionado — importante para o blur não limpar o valor
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

  // BLUR ajustado para esperar o clique no dropdown setar isClienteSelected(true)
  const handleBlur = () => {
    setTimeout(() => {
      // sempre fecha o dropdown
      setShowClienteDropdown(false);
      
      // Validar se o texto digitado corresponde a um cliente existente apenas se não houver seleção
      if (!isClienteSelected && formData.cliente.trim() !== '') {
        const isMatch = allClients.some(client => {
          const clientDisplayName = client.nome_fantasia 
            ? `${client.nome_fantasia} - ${client.razao_social}` 
            : client.razao_social;
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
    // A validação de itens vazios agora é mais permissiva para o item inicial
    if (formData.itens.length === 0 || (formData.itens.length === 1 && !formData.itens[0].produto_id && formData.itens[0].quantidade === '')) {
      toast({ title: 'Itens da movimentação', description: 'Adicione pelo menos um item válido à movimentação.', variant: 'destructive' });
      return false;
    }
    for (const item of formData.itens) {
      // Se o item não está completamente vazio, valide-o
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
      // Filtrar itens completamente vazios antes de enviar
      const itensToSave = formData.itens.filter(item => item.produto_id !== null || item.quantidade !== '');

      // Desestruturar e remover campos que não pertencem à tabela 'entrada_saida'
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

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
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
              <ArrowDownSquare className="w-8 h-8" />
              {isEditing ? 'Editar Entrada' : 'Nova Entrada'} de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <MovimentacaoFormFields
                formData={formData}
                handleChange={handleFormChange}
                handleSelectChange={handleSelectChange}
                handleColetaSelect={handleColetaSelect}
                isEditing={isEditing}
                type="entrada"
                documentNumberRef={documentNumberRef} // Passando a ref
              />

              {formData.origem === 'manual' && (
                <div className="space-y-2 relative" ref={dropdownRef}>
                  <Label htmlFor="cliente" className="text-white flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente *
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                    <Input
                      id="cliente"
                      value={formData.cliente} // Usar campo único igual ao modelo
                      onChange={(e) => handleFormChange('cliente', e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Digite para buscar cliente..."
                      className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl pr-10"
                      autoComplete="off"
                      required={formData.origem === 'manual'}
                      disabled={isEditing}
                    />
                    {formData.cliente && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" 
                        onClick={handleClearClient}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* DROPDOWN IDÊNTICO AO MODELO QUE FUNCIONA */}
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
                            onMouseDown={() => handleClientSelect(client)} // onMouseDown evita conflito com blur
                            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                          >
                            <div className="font-medium text-gray-900">
                              {client.nome_fantasia ? `${client.nome_fantasia} - ${client.razao_social}` : client.razao_social}
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-gray-500">
                          {formData.cliente ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Componente ItensMovimentacaoTable com altura ajustada */}
              <div> {/* Removido minHeight */}
                <ItensMovimentacaoTable
                  items={formData.itens}
                  onItemsChange={handleItemsChange}
                  type="entrada"
                  isEditing={isEditing}
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="observacao" className="text-lg flex items-center gap-2">
                  <Info className="w-4 h-4" /> Observação
                </Label>
                <Textarea
                  id="observacao"
                  name="observacao"
                  value={formData.observacao}
                  onChange={(e) => handleFormChange('observacao', e.target.value)}
                  placeholder="Detalhes adicionais sobre a movimentação..."
                  className="bg-white/5 border-white/20 rounded-xl"
                />
              </div>

              <div className="flex justify-between items-center pt-6">
                <Button type="button" onClick={() => navigate('/app/estoque/movimentacoes')} variant="outline" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                  {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default EntradaFormPage;