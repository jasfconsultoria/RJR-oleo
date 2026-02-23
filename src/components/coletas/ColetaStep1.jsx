import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, MapPin, Calculator, Package, Info, AtSign, Phone, ArrowLeft, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocationData } from '@/hooks/useLocationData';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { IMaskInput } from 'react-imask';
import { formatCnpjCpf, unmask, formatToISODate, parseCurrency, cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { format, isValid, parseISO } from 'date-fns';
import { formatInTimeZone, utcToZonedTime, toDate } from 'date-fns-tz';

const tiposColeta = [
  { id: 'Troca', nome: 'Troca' },
  { id: 'Compra', nome: 'Compra' },
  { id: 'Doação', nome: 'Doação' },
];

export function ColetaStep1({ data, onNext, onUpdate, profile, empresaTimezone }) {
  const navigate = useNavigate();
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [municipios, setMunicipios] = useState([]);
  const [isClienteSelected, setIsClienteSelected] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  // Buscar estados e municípios do banco de dados
  const { estados, fetchMunicipios } = useLocationData();

  useEffect(() => {
    const fetchClients = async () => {
      console.log('🎯 BUSCANDO CLIENTES COM CONTRATO ATIVO');
      setLoadingClients(true);

      try {
        // ✅ BUSCAR CLIENTES USANDO RPC FUNCTION QUE IGNORA RLS
        const { data: clientsData, error } = await supabase
          .rpc('get_clientes_com_contratos_ativos');

        if (error) {
          console.error('❌ ERRO ao buscar clientes via RPC:', error);

          // ✅ FALLBACK: BUSCAR DIRETAMENTE DA TABELA CLIENTES
          console.log('🔄 Tentando busca direta como fallback...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('clientes')
            .select(`
              *,
              contratos(
                status, 
                tipo_coleta, 
                valor_coleta, 
                fator_troca, 
                data_fim
              )
            `)
            .order('razao_social', { ascending: true });

          if (fallbackError) {
            console.error('❌ ERRO no fallback:', fallbackError);
            toast({
              title: 'Erro ao buscar clientes',
              description: 'Não foi possível carregar a lista de clientes',
              variant: 'destructive'
            });
            setAllClients([]);
            setFilteredClients([]);
          } else {
            // ✅ FILTRAR APENAS CLIENTES COM CONTRATO ATIVO NO FALLBACK
            const activeClients = (fallbackData || []).filter(client =>
              client.contratos && client.contratos.some(contract => contract.status === 'Ativo')
            );

            console.log(`✅ Clientes ativos (fallback): ${activeClients.length}`);
            setAllClients(activeClients);
            setFilteredClients(activeClients);
          }
        } else {
          console.log(`✅ Clientes ativos via RPC: ${clientsData?.length}`);
          setAllClients(clientsData || []);
          setFilteredClients(clientsData || []);
        }
      } catch (err) {
        console.error('❌ Erro inesperado:', err);
        toast({
          title: 'Erro ao buscar clientes',
          description: 'Erro inesperado no carregamento',
          variant: 'destructive'
        });
        setAllClients([]);
        setFilteredClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const loadMunicipios = async () => {
      if (data.estado) {
        const municipiosList = await fetchMunicipios(data.estado);
        setMunicipios(municipiosList.map(m => ({ value: m, label: m })));
      } else {
        setMunicipios([]);
      }
    };
    loadMunicipios();
    setIsClienteSelected(!!data.cliente_id);
  }, [data.estado, data.cliente_id, fetchMunicipios]);

  const handleInputChange = (name, value) => {
    onUpdate({ [name]: value });
  };

  const handleEstadoChange = async (value) => {
    onUpdate({ estado: value, municipio: '' });
    const municipiosList = await fetchMunicipios(value);
    setMunicipios(municipiosList.map(m => ({ value: m, label: m })));
  };

  const handleMunicipioChange = (value) => {
    onUpdate({ municipio: value });
  };

  const handleTipoColetaChange = (value) => {
    let newValorCompra = data.valor_compra;
    let newFator = data.fator;

    if (value === 'Compra') {
      if (parseCurrency(newValorCompra) === 0 || !newValorCompra) {
        newValorCompra = '1,20';
      }
      newFator = '6';
    } else if (value === 'Troca') {
      newValorCompra = '0,00';
      newFator = '6';
    } else if (value === 'Doação') {
      newValorCompra = '0,00';
      newFator = '6';
    }

    onUpdate({
      tipo_coleta: value,
      valor_compra: newValorCompra,
      fator: newFator,
    });
  };

  useEffect(() => {
    if (data.cliente && data.cliente.trim() !== '') {
      const searchTerm = data.cliente.toLowerCase();
      const filtered = allClients.filter(client =>
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm)) ||
        (client.razao_social && client.razao_social.toLowerCase().includes(searchTerm))
      );
      console.log(`🔍 Filtrados ${filtered.length} clientes para: "${data.cliente}"`);
      setFilteredClients(filtered);
    } else {
      console.log(`📋 Mostrando todos os ${allClients.length} clientes ativos`);
      setFilteredClients(allClients);
    }
  }, [data.cliente, allClients]);

  const handleClienteSelect = (client) => {
    console.log('👤 Cliente selecionado:', client.nome_fantasia || client.razao_social);

    // ✅ TRATAR CONTRATOS VINDO DA RPC (JSONB) OU DA QUERY NORMAL (ARRAY)
    let activeContracts = [];
    if (Array.isArray(client.contratos)) {
      activeContracts = client.contratos.filter(contract => contract.status === 'Ativo');
    } else if (client.contratos && typeof client.contratos === 'object') {
      // Se contratos veio como objeto único da RPC
      activeContracts = [client.contratos].filter(contract => contract.status === 'Ativo');
    }

    const latestActiveContract = activeContracts?.sort((a, b) => new Date(b.data_fim) - new Date(a.data_fim))[0];

    let newTipoColeta = data.tipo_coleta;
    let newFator = data.fator;
    let newValorCompra = data.valor_compra;

    if (latestActiveContract) {
      newTipoColeta = latestActiveContract.tipo_coleta;
      if (newTipoColeta === 'Troca') {
        newFator = String(latestActiveContract.fator_troca || '6');
        newValorCompra = '0,00';
      } else if (newTipoColeta === 'Compra') {
        newValorCompra = String(latestActiveContract.valor_coleta || '0,00').replace('.', ',');
        newFator = '6';
      } else if (newTipoColeta === 'Doação') {
        newValorCompra = '0,00';
        newFator = '6';
      }
    } else {
      newTipoColeta = 'Troca';
      newFator = '6';
      newValorCompra = '0,00';
    }

    onUpdate({
      cliente_id: client.id,
      cliente: client.nome_fantasia && client.razao_social
        ? `${client.nome_fantasia} - ${client.razao_social}`
        : client.nome_fantasia || client.razao_social,
      cnpj_cpf: client.cnpj_cpf,
      endereco: client.endereco,
      email: client.email,
      municipio: client.municipio,
      estado: client.estado,
      telefone: client.telefone,
      tipo_coleta: newTipoColeta,
      fator: newFator,
      valor_compra: newValorCompra,
    });
    if (client.estado) {
      setMunicipios(getMunicipios(client.estado).map(m => ({ value: m, label: m })));
    }
    setShowClienteDropdown(false);
    setIsClienteSelected(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!data.cliente.trim() || !unmask(data.cnpj_cpf) || !unmask(data.telefone) || !data.data_coleta || !data.hora_coleta || !data.tipo_coleta || !data.municipio || !data.estado) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos com asterisco (*).",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Dados salvos!",
      description: "Cadastro da coleta realizado com sucesso."
    });

    setTimeout(() => {
      onNext();
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Package className="w-6 h-6 text-emerald-400" />
          Etapa 1: Cadastro da Coleta
        </h2>
        <p className="text-emerald-200 text-sm md:text-base">Preencha os dados básicos da coleta de óleo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="data_coleta" className="text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data da Coleta *
            </Label>
            <DatePicker
              date={data.data_coleta}
              setDate={(date) => handleInputChange('data_coleta', date || null)}
              className="w-full bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl"
              disabled={profile?.role !== 'administrador'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hora_coleta" className="text-white flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Hora da Coleta *
            </Label>
            <Input
              id="hora_coleta"
              type="time"
              value={data.hora_coleta}
              onChange={(e) => handleInputChange('hora_coleta', e.target.value)}
              className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
              required
            />
          </div>
        </div>

        <div className="space-y-2 relative">
          <Label htmlFor="cliente" className="text-white flex items-center gap-2">
            <User className="w-4 h-4" />
            Cliente (com contrato ativo) *
            {loadingClients && (
              <span className="text-yellow-400 text-xs ml-2">Carregando...</span>
            )}
          </Label>
          <Textarea
            id="cliente"
            value={data.cliente}
            onChange={(e) => handleInputChange('cliente', e.target.value)}
            onFocus={() => !loadingClients && setShowClienteDropdown(true)}
            onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
            placeholder={loadingClients ? "Carregando clientes..." : "Digite para buscar..."}
            rows={(data.cliente_id && data.cliente) ? 4 : 1}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl font-bold transition-all duration-300 resize-none overflow-hidden",
              (data.cliente_id && data.cliente)
                ? "text-3xl min-h-[150px] py-4"
                : "!min-h-0 h-[60px] text-2xl py-3"
            )}
            autoComplete="off"
            required
            disabled={loadingClients}
          />

          {showClienteDropdown && !loadingClients && filteredClients.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-50 w-full bg-white rounded-lg shadow-xl max-h-80 overflow-y-auto mt-2"
            >
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onMouseDown={() => handleClienteSelect(client)}
                  className="p-4 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-bold text-gray-900 text-2xl mb-1">
                    {client.nome_fantasia && client.razao_social
                      ? `${client.nome_fantasia} - ${client.razao_social}`
                      : client.nome_fantasia || client.razao_social}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {showClienteDropdown && !loadingClients && filteredClients.length === 0 && data.cliente && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-10 w-full bg-white rounded-lg shadow-lg mt-1"
            >
              <div className="p-3 text-center text-gray-500">
                Nenhum cliente com contrato ativo encontrado para "{data.cliente}"
              </div>
            </motion.div>
          )}

          {showClienteDropdown && !loadingClients && filteredClients.length === 0 && !data.cliente && allClients.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-10 w-full bg-white rounded-lg shadow-lg mt-1"
            >
              <div className="p-3 text-center text-gray-500">
                Nenhum cliente com contrato ativo encontrado
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="cnpj_cpf" className="text-white flex items-center gap-2">
              <Info className="w-4 h-4" />
              CNPJ/CPF *
            </Label>
            <IMaskInput
              mask={[
                { mask: '000.000.000-00', maxLength: 11 },
                { mask: '00.000.000/0000-00' }
              ]}
              as={Input}
              id="cnpj_cpf"
              name="cnpj_cpf"
              value={data.cnpj_cpf}
              onAccept={(value) => handleInputChange('cnpj_cpf', value)}
              placeholder="Digite o CNPJ ou CPF"
              className="bg-white/10 border border-white/50 text-white placeholder:text-white/60 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl h-10 text-base px-3 py-2"
              required
              disabled={isClienteSelected}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-white flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefone *
            </Label>
            <IMaskInput
              mask={'(00) 00000-0000'}
              as={Input}
              id="telefone"
              name="telefone"
              value={data.telefone}
              onAccept={(value) => handleInputChange('telefone', value)}
              placeholder="(99) 99999-9999"
              className="bg-white/10 border border-white/50 text-white placeholder:text-white/60 rounded-xl h-10 text-base px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white flex items-center gap-2">
            <AtSign className="w-4 h-4" />
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            value={data.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@cliente.com"
            className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco" className="text-white flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço da Coleta
          </Label>
          <Input
            id="endereco"
            value={data.endereco || ''}
            onChange={(e) => handleInputChange('endereco', e.target.value)}
            placeholder="Digite o endereço completo"
            className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="estado" className="text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 opacity-0" />
              Estado *
            </Label>
            <Select value={data.estado || ''} onValueChange={handleEstadoChange} required disabled={true}>
              <SelectTrigger className="w-full bg-white/10 border-white/30 text-white disabled:opacity-70 disabled:cursor-not-allowed rounded-xl h-10 text-base">
                <SelectValue placeholder="Estado da Coleta" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {estados.map(estado => <SelectItem key={estado.value} value={estado.value}>{estado.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="municipio" className="text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 opacity-0" />
              Município *
            </Label>
            <SearchableSelect
              options={municipios}
              value={data.municipio || ''}
              onChange={handleMunicipioChange}
              placeholder="Município da Coleta"
              disabled={true}
              required
              inputClassName="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="tipo_coleta" className="text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 opacity-0" />
              Tipo de Coleta *
            </Label>
            <Select value={data.tipo_coleta} onValueChange={handleTipoColetaChange} required>
              <SelectTrigger className="w-full bg-white/10 border-white/30 text-white rounded-xl h-10 text-base">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {tiposColeta.map((tipo) => (
                  <SelectItem key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.tipo_coleta === 'Troca' ? (
            <div className="space-y-2">
              <Label htmlFor="fator" className="text-white flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Fator de Troca *
              </Label>
              <Input
                id="fator" type="number" step="1" min="1"
                value={data.fator} onChange={(e) => handleInputChange('fator', e.target.value)}
                placeholder="Ex: 6 (para 1 unidade de óleo novo a cada 6kg usado)"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base" required
              />
            </div>
          ) : data.tipo_coleta === 'Compra' ? (
            <div className="space-y-2">
              <Label htmlFor="valor_compra" className="text-white flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Valor da Compra (R$ por Kg) *
              </Label>
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
                as={Input}
                id="valor_compra"
                type="text"
                value={data.valor_compra}
                lazy={false}
                onAccept={(value) => handleInputChange('valor_compra', value)}
                placeholder="Ex: 1,20"
                className="bg-white/10 border border-white/50 text-white placeholder:text-white/60 rounded-xl h-10 text-base px-3 py-2 !text-right" required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="doacao_info" className="text-white flex items-center gap-2">
                <Info className="w-4 h-4" />
                Informações da Doação
              </Label>
              <Input
                id="doacao_info" type="text"
                value={data.doacao_info || ''}
                onChange={(e) => handleInputChange('doacao_info', e.target.value)}
                placeholder="Detalhes da doação (opcional)"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6">
          <Button
            type="button"
            onClick={() => navigate('/app/coletas')}
            variant="outline"
            className="rounded-xl"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
          >
            Próximo →
          </Button>
        </div>
      </form>
    </motion.div>
  );
}