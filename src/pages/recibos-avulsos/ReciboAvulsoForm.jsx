import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, FileText } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import ClienteSearchableSelect from '@/components/clientes/ClienteSearchableSelect';
import { ReciboAvulsoViewDialog } from '@/components/recibos-avulsos/ReciboAvulsoViewDialog';
import { formatCurrency, parseCurrency, unmask, formatNumber } from '@/lib/utils';
import { logAction } from '@/lib/logger';
import { useProfile } from '@/contexts/ProfileContext';
import { useAutoSave } from '@/hooks/useAutoSave';

const INITIAL_FORM_DATA = {
  numero_recibo: '',
  tipo: 'cliente',
  pessoa_id: null,
  pessoa_nome: '',
  pessoa_cnpj_cpf: '',
  pessoa_endereco: '',
  pessoa_municipio: '',
  pessoa_estado: '',
  pessoa_telefone: '',
  pessoa_email: '',
  descricao: '',
  valor: '0,00',
  data_recibo: new Date(),
  observacoes: ''
};

const ReciboAvulsoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useProfile();
  const isEditing = Boolean(id);
  const pessoaInputRef = useRef(null); // ✅ Ref para o campo de pessoa

  const [rawFormData, setRawFormData, clearSavedData] = useAutoSave(
    isEditing ? `recibo_edit_${id}` : 'recibo_novo',
    INITIAL_FORM_DATA,
    !isEditing // Só carregar do storage se for novo recibo (para não atropelar dados reais da edição)
  );

  // ✅ Processamento resiliente da data e outros campos
  const formData = useMemo(() => {
    const data = { ...rawFormData };

    // Garantir que data_recibo seja um objeto Date
    if (typeof data.data_recibo === 'string') {
      const parsed = new Date(data.data_recibo);
      data.data_recibo = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else if (!data.data_recibo) {
      data.data_recibo = new Date();
    }

    return data;
  }, [rawFormData]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [savedRecibo, setSavedRecibo] = useState(null);
  const [empresa, setEmpresa] = useState(null);

  // ✅ Foco automático no campo de pessoa ao carregar (apenas se for novo recibo)
  useEffect(() => {
    if (!isEditing && !loading) {
      setTimeout(() => {
        pessoaInputRef.current?.focus();
      }, 300);
    }
  }, [isEditing, loading]);

  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);
  const [pessoaSearchTerm, setPessoaSearchTerm] = useState('');
  const [previousTipo, setPreviousTipo] = useState(formData.tipo);

  // Efeito para carregar o termo de busca se houver dados salvos no AutoSave
  useEffect(() => {
    if (!isEditing && formData.pessoa_nome && !pessoaSearchTerm) {
      setPessoaSearchTerm(formData.pessoa_nome);
    }
  }, [isEditing, formData.pessoa_nome, pessoaSearchTerm]);

  useEffect(() => {
    if (isEditing) {
      fetchRecibo();
    }
  }, [id, isEditing]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      try {
        const { data } = await supabase.from('empresa').select('*').single();
        if (data) setEmpresa(data);
      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
      }
    };
    fetchEmpresaData();
  }, []);

  // Limpar campos de pessoa quando o tipo mudar
  useEffect(() => {
    // Só limpar se o tipo realmente mudou (não na primeira renderização)
    if (previousTipo !== null && previousTipo !== formData.tipo) {
      setPessoaSelecionada(null);
      setPessoaSearchTerm('');
      setRawFormData(prev => ({
        ...prev,
        pessoa_id: null,
        pessoa_nome: '',
        pessoa_cnpj_cpf: '',
        pessoa_endereco: '',
        pessoa_municipio: '',
        pessoa_estado: '',
        pessoa_telefone: '',
        pessoa_email: ''
      }));
    }
    // Atualizar previousTipo apenas se mudou
    if (previousTipo !== formData.tipo) {
      setPreviousTipo(formData.tipo);
    }
  }, [formData.tipo, setRawFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecibo = async () => {
    try {
      const { data, error } = await supabase
        .from('recibos_avulso')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setRawFormData({
          numero_recibo: data.numero_recibo || '',
          tipo: data.tipo || 'cliente',
          pessoa_id: data.pessoa_id,
          pessoa_nome: data.pessoa_nome || '',
          pessoa_cnpj_cpf: data.pessoa_cnpj_cpf || '',
          pessoa_endereco: data.pessoa_endereco || '',
          pessoa_municipio: data.municipio || '', // Use 'municipio' from DB
          pessoa_estado: data.estado || '',       // Use 'estado' from DB
          pessoa_telefone: data.pessoa_telefone || '',
          pessoa_email: data.pessoa_email || '',
          descricao: data.descricao || '',
          valor: data.valor
            ? Number(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0,00',
          data_recibo: data.data_recibo ? new Date(data.data_recibo) : new Date(),
          observacoes: data.observacoes || ''
        });

        // Definir o termo de busca com o nome da pessoa
        if (data.tipo === 'coletor') {
          // Para coletores, sempre usar pessoa_nome (pois pessoa_id pode ser NULL)
          if (data.pessoa_nome) {
            setPessoaSearchTerm(data.pessoa_nome);
          }
        } else if (data.pessoa_id) {
          // Para clientes/fornecedores, tentar buscar o nome completo
          try {
            const { data: clienteData } = await supabase
              .from('clientes')
              .select('nome_fantasia, razao_social')
              .eq('id', data.pessoa_id)
              .single();
            if (clienteData) {
              const displayValue = clienteData.nome_fantasia && clienteData.razao_social
                ? `${clienteData.nome_fantasia} - ${clienteData.razao_social}`
                : clienteData.nome_fantasia || clienteData.razao_social || '';
              setPessoaSearchTerm(displayValue);
            } else {
              setPessoaSearchTerm(data.pessoa_nome || '');
            }
          } catch (err) {
            setPessoaSearchTerm(data.pessoa_nome || '');
          }
        } else {
          setPessoaSearchTerm(data.pessoa_nome || '');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar recibo:', error);
      toast({
        title: 'Erro ao carregar recibo',
        description: error.message,
        variant: 'destructive'
      });
      navigate('/app/financeiro/recibos');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setRawFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePessoaSelect = async (pessoa) => {
    if (pessoa && typeof pessoa === 'object' && pessoa.id) {
      // Se recebeu objeto completo (returnFullClientData=true)
      setPessoaSelecionada(pessoa);

      // Determinar o nome baseado no tipo
      let pessoaNome = '';
      if (formData.tipo === 'coletor') {
        // Para coletores, usar nome_fantasia ou razao_social (que contém full_name)
        pessoaNome = pessoa.nome_fantasia || pessoa.razao_social || '';
      } else {
        // Para clientes/fornecedores
        pessoaNome = pessoa.nome_fantasia && pessoa.razao_social
          ? `${pessoa.nome_fantasia} - ${pessoa.razao_social}`
          : pessoa.nome_fantasia || pessoa.razao_social || '';
      }

      // Determinar o valor de exibição para o campo de busca
      let displayValue = '';
      if (formData.tipo === 'coletor') {
        displayValue = pessoa.nome_fantasia || pessoa.razao_social || '';
      } else {
        displayValue = pessoa.nome_fantasia && pessoa.razao_social
          ? `${pessoa.nome_fantasia} - ${pessoa.razao_social}`
          : pessoa.nome_fantasia || pessoa.razao_social || '';
      }
      setPessoaSearchTerm(displayValue);

      setRawFormData(prev => ({
        ...prev,
        pessoa_id: pessoa.id,
        pessoa_nome: pessoaNome,
        pessoa_cnpj_cpf: pessoa.cnpj_cpf || '',
        pessoa_endereco: pessoa.endereco || '',
        pessoa_municipio: pessoa.municipio || '',
        pessoa_estado: pessoa.estado || '',
        pessoa_telefone: pessoa.telefone || '',
        pessoa_email: pessoa.email || ''
      }));
    } else if (pessoa && typeof pessoa === 'string') {
      // Se recebeu apenas ID, buscar dados completos
      try {
        let pessoaData = null;

        if (formData.tipo === 'coletor') {
          // Buscar da tabela profiles (incluindo CPF e telefone)
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email, municipio, estado, cpf, telefone')
            .eq('id', pessoa)
            .eq('role', 'coletor')
            .single();

          if (!profileError && profileData) {
            pessoaData = {
              id: profileData.id,
              nome_fantasia: profileData.full_name || '',
              razao_social: profileData.full_name || '',
              cnpj_cpf: profileData.cpf || null,
              endereco: null,
              municipio: profileData.municipio || null,
              estado: profileData.estado || null,
              telefone: profileData.telefone || null,
              email: profileData.email || null
            };
          }
        } else {
          // Buscar da tabela clientes
          const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', pessoa)
            .single();

          if (!clienteError && clienteData) {
            pessoaData = clienteData;
          }
        }

        if (pessoaData) {
          setPessoaSelecionada(pessoaData);

          let pessoaNome = '';
          if (formData.tipo === 'coletor') {
            pessoaNome = pessoaData.nome_fantasia || pessoaData.razao_social || '';
          } else {
            pessoaNome = pessoaData.nome_fantasia && pessoaData.razao_social
              ? `${pessoaData.nome_fantasia} - ${pessoaData.razao_social}`
              : pessoaData.nome_fantasia || pessoaData.razao_social || '';
          }

          // Determinar o valor de exibição para o campo de busca
          let displayValue = '';
          if (formData.tipo === 'coletor') {
            displayValue = pessoaData.nome_fantasia || pessoaData.razao_social || '';
          } else {
            displayValue = pessoaData.nome_fantasia && pessoaData.razao_social
              ? `${pessoaData.nome_fantasia} - ${pessoaData.razao_social}`
              : pessoaData.nome_fantasia || pessoaData.razao_social || '';
          }
          setPessoaSearchTerm(displayValue);

          setRawFormData(prev => ({
            ...prev,
            pessoa_id: pessoaData.id,
            pessoa_nome: pessoaNome,
            pessoa_cnpj_cpf: pessoaData.cnpj_cpf || '',
            pessoa_endereco: pessoaData.endereco || '',
            pessoa_municipio: pessoaData.municipio || '',
            pessoa_estado: pessoaData.estado || '',
            pessoa_telefone: pessoaData.telefone || '',
            pessoa_email: pessoaData.email || ''
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar dados da pessoa:', error);
      }
    } else {
      // Limpar seleção
      setPessoaSelecionada(null);
      setPessoaSearchTerm('');
      setRawFormData(prev => ({
        ...prev,
        pessoa_id: null,
        pessoa_nome: '',
        pessoa_cnpj_cpf: '',
        pessoa_endereco: '',
        pessoa_municipio: '',
        pessoa_estado: '',
        pessoa_telefone: '',
        pessoa_email: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validações
      // Para coletores, pessoa_id pode ser NULL, então validar pelo nome
      if (formData.tipo === 'coletor') {
        if (!formData.pessoa_nome || !formData.pessoa_nome.trim()) {
          toast({
            title: 'Campo obrigatório',
            description: 'É necessário selecionar um coletor.',
            variant: 'destructive'
          });
          setSaving(false);
          return;
        }
      } else {
        // Para clientes e fornecedores, validar pelo pessoa_id
        if (!formData.pessoa_id) {
          toast({
            title: 'Campo obrigatório',
            description: 'É necessário selecionar uma pessoa (cliente ou fornecedor).',
            variant: 'destructive'
          });
          setSaving(false);
          return;
        }
      }

      if (!formData.descricao.trim()) {
        toast({
          title: 'Campo obrigatório',
          description: 'A descrição é obrigatória.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }

      if (!formData.data_recibo) {
        toast({
          title: 'Campo obrigatório',
          description: 'A data do recibo é obrigatória.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }

      // Garantir que o valor seja parseado corretamente
      let valorNumerico = 0;
      try {
        if (formData.valor && formData.valor.trim() !== '') {
          // O valor já vem no formato correto do IMaskInput (ex: "100,00")
          valorNumerico = parseCurrency(formData.valor);
        } else if (isEditing) {
          // Se estiver editando e o valor estiver vazio, buscar do banco
          const { data: existingData } = await supabase
            .from('recibos_avulso')
            .select('valor')
            .eq('id', id)
            .single();
          valorNumerico = existingData?.valor || 0;
        } else {
          valorNumerico = 0;
        }
      } catch (error) {
        console.error('Erro ao parsear valor:', error);
        // Se houver erro e estiver editando, buscar valor original do banco
        if (isEditing) {
          try {
            const { data: existingData } = await supabase
              .from('recibos_avulso')
              .select('valor')
              .eq('id', id)
              .single();
            valorNumerico = existingData?.valor || 0;
          } catch (fetchError) {
            console.error('Erro ao buscar valor original:', fetchError);
            valorNumerico = 0;
          }
        } else {
          valorNumerico = 0;
        }
      }

      const reciboData = {
        tipo: formData.tipo,
        // Se for coletor, pessoa_id deve ser NULL pois coletores não estão na tabela clientes
        pessoa_id: formData.tipo === 'coletor' ? null : formData.pessoa_id,
        pessoa_nome: formData.pessoa_nome?.trim() || '',
        pessoa_cnpj_cpf: unmask(formData.pessoa_cnpj_cpf || ''),
        pessoa_endereco: formData.pessoa_endereco?.trim() || null,
        pessoa_municipio: formData.pessoa_municipio?.trim() || null,
        pessoa_estado: formData.pessoa_estado?.trim() || null,
        pessoa_telefone: unmask(formData.pessoa_telefone || ''),
        pessoa_email: formData.pessoa_email?.trim() || null,
        descricao: formData.descricao.trim(),
        valor: valorNumerico,
        data_recibo: (formData.data_recibo instanceof Date ? formData.data_recibo : new Date(formData.data_recibo)).toISOString().split('T')[0],
        observacoes: formData.observacoes?.trim() || null,
        user_id: profile?.id || profile?.userId
      };

      if (isEditing) {
        const { error } = await supabase
          .from('recibos_avulso')
          .update(reciboData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Recibo atualizado!',
          description: 'O recibo foi atualizado com sucesso.'
        });

        clearSavedData();
        await logAction('update_recibo_avulso', { recibo_id: id });
        navigate('/app/financeiro/recibos');
      } else {
        // Gerar número do recibo
        const { data: numeroData, error: numeroError } = await supabase
          .rpc('generate_recibo_avulso_numero');

        if (numeroError) throw numeroError;

        const { data, error } = await supabase
          .from('recibos_avulso')
          .insert({
            ...reciboData,
            numero_recibo: numeroData
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Recibo criado!',
          description: 'O recibo foi criado com sucesso.'
        });

        clearSavedData();
        await logAction('create_recibo_avulso', { recibo_id: data.id, numero_recibo: numeroData });

        // Em vez de navegar, abre o modal de visualização
        setSavedRecibo(data);
        setViewModalOpen(true);
      }
    } catch (error) {
      console.error('Erro ao salvar recibo:', error);
      toast({
        title: 'Erro ao salvar recibo',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Editar Recibo Avulso' : 'Novo Recibo Avulso'} - RJR Óleo</title>
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
              <FileText className="w-8 h-8" />
              {isEditing ? 'Editar Recibo Avulso' : 'Novo Recibo Avulso'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Nº Recibo */}
                <div className="md:col-span-2">
                  <Label htmlFor="numero_recibo" className="text-sm">Nº Recibo</Label>
                  <Input
                    id="numero_recibo"
                    value={formData.numero_recibo}
                    onChange={(e) => handleInputChange('numero_recibo', e.target.value)}
                    placeholder="Automático"
                    className="bg-white/5 border-white/20 rounded-xl h-9 text-xs"
                    disabled={!isEditing}
                  />
                </div>

                {/* Data do Recibo */}
                <div className="md:col-span-2">
                  <Label htmlFor="data_recibo" className="text-sm">Data <span className="text-red-500">*</span></Label>
                  <DateInput
                    date={formData.data_recibo}
                    setDate={(date) => handleInputChange('data_recibo', date || new Date())}
                    inputClassName="h-9 text-xs"
                  />
                </div>

                {/* Tipo */}
                <div className="md:col-span-2">
                  <Label htmlFor="tipo" className="text-sm">Tipo <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => handleInputChange('tipo', value)}
                    required
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl h-9 text-xs">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="coletor">Coletor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Seleção de Pessoa */}
                <div className="md:col-span-6">
                  <ClienteSearchableSelect
                    labelText={formData.tipo === 'cliente' ? 'Cliente' : formData.tipo === 'fornecedor' ? 'Fornecedor' : 'Coletor'}
                    value={formData.pessoa_id}
                    inputRef={pessoaInputRef} // ✅ Passando a ref
                    onChange={handlePessoaSelect}
                    returnFullClientData={true}
                    personType={formData.tipo}
                    searchTerm={pessoaSearchTerm}
                    onSearchTermChange={setPessoaSearchTerm}
                  />
                </div>

                {/* CNPJ/CPF */}
                <div className="md:col-span-2">
                  <Label htmlFor="pessoa_cnpj_cpf" className="text-sm">CNPJ/CPF</Label>
                  <IMaskInput
                    mask={[
                      { mask: '000.000.000-00', maxLength: 11 },
                      { mask: '00.000.000/0000-00' }
                    ]}
                    as={Input}
                    id="pessoa_cnpj_cpf"
                    value={formData.pessoa_cnpj_cpf}
                    onAccept={(value) => handleInputChange('pessoa_cnpj_cpf', value)}
                    placeholder="Digite o CNPJ ou CPF"
                    className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs"
                    disabled={!!formData.pessoa_id} // ✅ Bloqueia se selecionou alguém
                    inputMode="numeric"
                  />
                </div>

                {/* Telefone */}
                <div className="md:col-span-2">
                  <Label htmlFor="pessoa_telefone" className="text-sm">Telefone</Label>
                  <IMaskInput
                    mask={[
                      { mask: '(00) 0000-0000' },
                      { mask: '(00) 00000-0000' }
                    ]}
                    as={Input}
                    id="pessoa_telefone"
                    value={formData.pessoa_telefone}
                    onAccept={(value) => handleInputChange('pessoa_telefone', value)}
                    placeholder="(00) 00000-0000"
                    className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs"
                    disabled={!!formData.pessoa_id} // ✅ Bloqueia se selecionou alguém
                    inputMode="numeric"
                  />
                </div>

                {/* E-mail */}
                <div className="md:col-span-2">
                  <Label htmlFor="pessoa_email" className="text-sm">E-mail</Label>
                  <Input
                    id="pessoa_email"
                    type="email"
                    value={formData.pessoa_email}
                    onChange={(e) => handleInputChange('pessoa_email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className="bg-white/5 border-white/20 rounded-xl h-9 text-xs"
                    disabled={!!formData.pessoa_id} // ✅ Bloqueia se selecionou alguém
                  />
                </div>

                {/* Endereço */}
                <div className="md:col-span-3">
                  <Label htmlFor="pessoa_endereco" className="text-sm">Endereço</Label>
                  <Input
                    id="pessoa_endereco"
                    value={formData.pessoa_endereco}
                    onChange={(e) => handleInputChange('pessoa_endereco', e.target.value)}
                    placeholder="Endereço não informado"
                    className={`bg-white/5 border-white/20 rounded-xl h-9 text-xs ${formData.pessoa_id ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={!!formData.pessoa_id}
                  />
                </div>

                {/* Município */}
                <div className="md:col-span-2">
                  <Label htmlFor="pessoa_municipio" className="text-sm">Município</Label>
                  <Input
                    id="pessoa_municipio"
                    value={formData.pessoa_municipio}
                    onChange={(e) => handleInputChange('pessoa_municipio', e.target.value)}
                    placeholder="Cidade"
                    className={`bg-white/5 border-white/20 rounded-xl h-9 text-xs ${formData.pessoa_id ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={!!formData.pessoa_id}
                  />
                </div>

                {/* Estado */}
                <div className="md:col-span-1">
                  <Label htmlFor="pessoa_estado" className="text-sm">Estado</Label>
                  <Input
                    id="pessoa_estado"
                    value={formData.pessoa_estado}
                    onChange={(e) => handleInputChange('pessoa_estado', e.target.value)}
                    placeholder="UF"
                    className={`bg-white/5 border-white/20 rounded-xl h-9 text-xs ${formData.pessoa_id ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={!!formData.pessoa_id}
                  />
                </div>

                {/* Descrição */}
                <div className="md:col-span-6">
                  <Label htmlFor="descricao" className="text-sm">Descrição <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => handleInputChange('descricao', e.target.value)}
                    placeholder="Descrição do serviço / prestação..."
                    className="bg-white/5 border-white/20 rounded-xl min-h-[2.25rem] text-xs"
                    required
                  />
                </div>

                {/* Valor */}
                <div className="md:col-span-3">
                  <Label htmlFor="valor" className="text-sm">Valor (R$) <span className="text-red-500">*</span></Label>
                  <IMaskInput
                    mask="num"
                    blocks={{
                      num: {
                        mask: Number,
                        thousandsSeparator: '.',
                        radix: ',',
                        mapToRadix: ['.'],
                        scale: 2,
                        padFractionalZeros: true,
                        normalizeZeros: true,
                        signed: false,
                      },
                    }}
                    value={formData.valor}
                    lazy={false}
                    onAccept={(value) => handleInputChange('valor', value)}
                    placeholder="0,00"
                    className="w-full flex h-9 rounded-xl border border-white/20 bg-white/5 px-3 py-1 text-xs !text-right ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    inputMode="decimal"
                  />
                </div>

                {/* Observações */}
                <div className="md:col-span-6">
                  <Label htmlFor="observacoes" className="text-sm">Referente / Observação</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => handleInputChange('observacoes', e.target.value)}
                    placeholder="Informações adicionais..."
                    className="bg-white/5 border-white/20 rounded-xl min-h-[2.25rem] text-xs"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-between items-center pt-6">
                <Button
                  type="button"
                  onClick={() => navigate('/app/financeiro/recibos')}
                  variant="outline"
                  className="rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                {formData.descricao && !isEditing && (
                  <Button
                    type="button"
                    onClick={() => clearSavedData()}
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl text-xs"
                  >
                    Limpar Formulário
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? 'Lançando...' : isEditing ? 'Atualizar' : 'Lançar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {viewModalOpen && savedRecibo && (
        <ReciboAvulsoViewDialog
          recibo={savedRecibo}
          empresa={empresa}
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            navigate('/app/financeiro/recibos');
          }}
        />
      )}
    </>
  );
};

export default ReciboAvulsoForm;
