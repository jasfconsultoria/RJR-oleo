import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, ArrowUpSquare, Loader2, Info, User, Search, X } from 'lucide-react';
import { logAction } from '@/lib/logger';
import MovimentacaoFormFields from '@/components/estoque/MovimentacaoFormFields';
import ItensMovimentacaoTable from '@/components/estoque/ItensMovimentacaoTable';
import { parseCurrency, formatCnpjCpf } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const SaidaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    data: new Date(),
    tipo: 'saida',
    origem: 'manual',
    document_number: '',
    cliente_id: null,
    cliente_nome: '', // Usado para o valor do input e nome de exibição
    cliente_nome_fantasia: '',
    cnpj_cpf: '',
    coleta_id: null,
    observacao: '',
    itens: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [isClienteSelected, setIsClienteSelected] = useState(false); // Indica se um cliente foi *selecionado* do dropdown
  const clientInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch all clients
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado')
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setAllClients([]);
      } else {
        setAllClients(data || []);
      }
    };
    fetchClients();
  }, [toast]);

  // Filter clients based on search term (formData.cliente_nome)
  useEffect(() => {
    if (formData.cliente_nome && formData.cliente_nome.trim()) {
      const searchTerm = formData.cliente_nome.toLowerCase();
      const filtered = allClients.filter(client =>
        client.nome.toLowerCase().includes(searchTerm) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm)) ||
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(allClients);
    }
  }, [formData.cliente_nome, allClients]);

  const fetchMovimentacao = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
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

      setFormData({
        ...movimentacaoData,
        data: new Date(movimentacaoData.data),
        cliente_id: movimentacaoData.cliente?.id || null,
        cliente_nome: movimentacaoData.cliente?.nome_fantasia ? `${movimentacaoData.cliente.nome} - ${movimentacaoData.cliente.nome_fantasia}` : movimentacaoData.cliente?.nome || '', // Set full display name
        cliente_nome_fantasia: movimentacaoData.cliente?.nome_fantasia || '',
        cnpj_cpf: movimentacaoData.cliente?.cnpj_cpf || '',
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

  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'origem' && value !== 'coleta') {
      setFormData((prev) => ({ ...prev, coleta_id: null, cliente_id: null, cliente_nome: '', cliente_nome_fantasia: '', cnpj_cpf: '' }));
      setIsClienteSelected(false);
    }
  };

  const handleColetaSelect = (coleta) => {
    if (coleta) {
      setFormData((prev) => ({
        ...prev,
        coleta_id: coleta.id,
        cliente_id: coleta.cliente_id,
        document_number: coleta.numero_coleta?.toString().padStart(6, '0'),
        observacao: `Movimentação referente à coleta Nº ${coleta.numero_coleta?.toString().padStart(6, '0')} do cliente ${coleta.cliente_nome}.`,
        cliente_nome: coleta.cliente_nome_fantasia ? `${coleta.cliente_nome} - ${coleta.cliente_nome_fantasia}` : coleta.cliente_nome,
        cliente_nome_fantasia: coleta.cliente_nome_fantasia,
        cnpj_cpf: coleta.cliente_cnpj_cpf,
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
      }));
      setIsClienteSelected(false);
    }
  };

  const handleItemsChange = (newItems) => {
    setFormData((prev) => ({ ...prev, itens: newItems }));
  };

  const handleClientSearchChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, cliente_nome: value })); // Atualiza formData.cliente_nome diretamente
    if (isClienteSelected && value !== (formData.cliente_nome_fantasia ? `${formData.cliente_nome} - ${formData.cliente_nome_fantasia}` : formData.cliente_nome)) {
      // Se um cliente estava selecionado e o input muda, deseleciona
      setIsClienteSelected(false);
      setFormData(prev => ({ ...prev, cliente_id: null, cliente_nome_fantasia: '', cnpj_cpf: '' }));
    }
    setShowClienteDropdown(true);
  };

  const handleClientSelectFromDropdown = (client) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: client.id,
      cliente_nome: client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome, // Define o nome completo para exibição
      cliente_nome_fantasia: client.nome_fantasia,
      cnpj_cpf: client.cnpj_cpf,
    }));
    setIsClienteSelected(true);
    setShowClienteDropdown(false);
  };

  const handleClearClient = () => {
    setFormData(prev => ({
      ...prev,
      cliente_id: null,
      cliente_nome: '',
      cliente_nome_fantasia: '',
      cnpj_cpf: '',
    }));
    setIsClienteSelected(false);
    setShowClienteDropdown(false);
  };

  const handleFocus = () => {
    setShowClienteDropdown(true);
  };

  const handleBlur = (e) => {
    setTimeout(() => {
      if (dropdownRef.current && !dropdownRef.current.contains(document.activeElement)) {
        setShowClienteDropdown(false);
        // Se nenhum cliente foi selecionado E o valor atual do input não corresponde a um cliente selecionado
        if (!isClienteSelected && formData.cliente_nome) {
          const isMatch = allClients.some(client =>
            (client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome) === formData.cliente_nome
          );
          if (!isMatch) {
            // Se não for uma correspondência, limpa o input e os dados do cliente selecionado
            setFormData(prev => ({ ...prev, cliente_id: null, cliente_nome: '', cliente_nome_fantasia: '', cnpj_cpf: '' }));
          }
        }
      }
    }, 200);
  };

  const validateForm = async () => {
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
    if (formData.itens.length === 0) {
      toast({ title: 'Itens da movimentação', description: 'Adicione pelo menos um item à movimentação.', variant: 'destructive' });
      return false;
    }
    
    const { data: productBalances, error: balanceError } = await supabase.from('v_saldo_produtos').select('*');
    if (balanceError) {
      toast({ title: 'Erro ao verificar saldo', description: balanceError.message, variant: 'destructive' });
      return false;
    }
    const balancesMap = productBalances.reduce((acc, p) => {
      acc[p.produto_id] = p.saldo_atual;
      return acc;
    }, {});

    for (const item of formData.itens) {
      if (!item.produto_id || parseCurrency(item.quantidade) <= 0) {
        toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: produto e quantidade são obrigatórios e a quantidade deve ser maior que zero.', variant: 'destructive' });
        return false;
      }
      // Stock validation for exits
      if (formData.tipo === 'saida' && !isEditing) { // Only validate stock for new exits
        const currentBalance = balancesMap[item.produto_id] || 0;
        if (parseCurrency(item.quantidade) > currentBalance) {
          toast({ title: 'Saldo insuficiente', description: `Saldo insuficiente para o produto ${item.produto_nome}. Disponível: ${currentBalance} ${item.unidade}.`, variant: 'destructive' });
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!await validateForm()) return;

    setSaving(true);
    try {
      const { itens, ...movimentacaoHeader } = formData;
      movimentacaoHeader.user_id = user?.id;

      let savedMovimentacao;
      if (isEditing) {
        const { data, error } = await supabase
          .from('entrada_saida')
          .update(movimentacaoHeader)
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
          .insert(movimentacaoHeader)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;
      }

      const itensToInsert = itens.map(item => ({
        entrada_saida_id: savedMovimentacao.id,
        produto_id: item.produto_id,
        quantidade: parseCurrency(item.quantidade),
      }));

      const { error: itensInsertError } = await supabase
        .from('itens_entrada_saida')
        .insert(itensToInsert);
      if (itensInsertError) throw itensInsertError;

      await logAction(isEditing ? 'update_stock_exit' : 'create_stock_exit', {
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
      await logAction(isEditing ? 'update_stock_exit_failed' : 'create_stock_exit_failed', {
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
        <title>{isEditing ? 'Editar Saída' : 'Nova Saída'} de Estoque - RJR Óleo</title>
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
              <ArrowUpSquare className="w-8 h-8" />
              {isEditing ? 'Editar Saída' : 'Nova Saída'} de Estoque
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
                type="saida"
              />

              {formData.origem === 'manual' && (
                <div className="space-y-2 relative" ref={dropdownRef}>
                  <Label htmlFor="cliente_nome" className="text-white flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente *
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                    <Input
                      id="cliente_nome"
                      value={formData.cliente_nome} // Usar formData.cliente_nome diretamente
                      onChange={handleClientSearchChange}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Digite para buscar ou adicionar cliente..."
                      className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl pr-10"
                      autoComplete="off"
                      required={formData.origem === 'manual'}
                      disabled={isEditing}
                      ref={clientInputRef}
                    />
                    {formData.cliente_nome && (
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" onClick={handleClearClient}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {showClienteDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1"
                    >
                      {filteredClients.length > 0 ? filteredClients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => handleClientSelectFromDropdown(client)}
                          className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome}</div>
                          <div className="text-sm text-gray-600">{formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}</div>
                        </div>
                      )) : (
                        <div className="p-3 text-center text-gray-500">Nenhum cliente encontrado.</div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              <ItensMovimentacaoTable
                items={formData.itens}
                onItemsChange={handleItemsChange}
                type="saida"
                isEditing={isEditing}
              />

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

export default SaidaFormPage;