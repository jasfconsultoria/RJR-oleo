import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, MapPin, Calculator, Package, Info, AtSign, Phone, ArrowLeft, Clock } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { estados, getMunicipios } from '@/lib/location';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useIMask } from 'react-imask';
import { formatCnpjCpf, unmask, formatToISODate, parseCurrency } from '@/lib/utils'; // Importar parseCurrency
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
  const [formData, setFormData] = useState(data);
  const [allClients, setAllClients] = useState([]); // All clients from DB
  const [filteredClients, setFilteredClients] = useState([]); // Clients filtered by search term
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [municipios, setMunicipios] = useState([]);
  const [isClienteSelected, setIsClienteSelected] = useState(false);

  const { ref: cnpjCpfRef, setValue: setCnpjCpfValue } = useIMask({
    mask: [
      { mask: '000.000.000-00', maxLength: 11 },
      { mask: '00.000.000/0000-00' }
    ],
  });

  const { ref: telefoneRef, setValue: setTelefoneValue } = useIMask({
    mask: '(00) 00000-0000',
  });

  // Fetch all clients with active contracts
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*, contratos(status, tipo_coleta, valor_coleta, fator_troca, data_fim)') // Select contracts to filter active ones
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setAllClients([]);
      } else {
        // Filter clients with at least one active contract
        const activeClients = (data || []).filter(client => 
          client.contratos && client.contratos.some(contract => contract.status === 'Ativo')
        );
        setAllClients(activeClients);
      }
    };
    fetchClients();
  }, [toast]);

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEstadoChange = (value) => {
    setFormData(prev => ({ ...prev, estado: value, municipio: '' }));
    setMunicipios(getMunicipios(value).map(m => ({ value: m, label: m })));
  };

  const handleMunicipioChange = (value) => {
    setFormData(prev => ({ ...prev, municipio: value }));
  };

  const handleTipoColetaChange = (value) => {
    setFormData(prev => {
      let newValorCompra = prev.valor_compra;
      let newFator = prev.fator;

      if (value === 'Compra') {
        // If changing to 'Compra', set a default value if it's currently 0 or empty
        if (parseCurrency(newValorCompra) === 0 || !newValorCompra) {
          newValorCompra = '1,20';
        }
        newFator = '6'; // Default factor for 'Compra' (can be adjusted by user later if needed)
      } else if (value === 'Troca') {
        newValorCompra = '0,00'; // No purchase value for 'Troca'
        newFator = '6'; // Default factor for 'Troca'
      } else if (value === 'Doação') {
        newValorCompra = '0,00'; // No purchase value for 'Doação'
        newFator = '6'; // Default factor for 'Doação'
      }

      return {
        ...prev,
        tipo_coleta: value,
        valor_compra: newValorCompra,
        fator: newFator,
      };
    });
  };

  useEffect(() => {
    // `data.data_coleta` já é um objeto Date válido vindo de ColetaForm
    setFormData(prev => ({ ...data }));
    if (data.estado) {
      setMunicipios(getMunicipios(data.estado).map(m => ({ value: m, label: m })));
    }
    setCnpjCpfValue(data.cnpj_cpf || '');
    setTelefoneValue(data.telefone || '');
    setIsClienteSelected(!!data.cliente_id);
  }, [data, setCnpjCpfValue, setTelefoneValue, empresaTimezone]);

  useEffect(() => {
    if (formData.cliente) {
      const filtered = allClients.filter(client =>
        client.nome.toLowerCase().includes(formData.cliente.toLowerCase()) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(formData.cliente.toLowerCase())) // Filter by nome_fantasia
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(allClients);
    }
  }, [formData.cliente, allClients]);

  const handleClienteSelect = (client) => {
    // Encontrar o contrato ativo mais recente
    const activeContracts = client.contratos?.filter(contract => contract.status === 'Ativo');
    const latestActiveContract = activeContracts?.sort((a, b) => new Date(b.data_fim) - new Date(a.data_fim))[0];
    
    let newTipoColeta = formData.tipo_coleta;
    let newFator = formData.fator;
    let newValorCompra = formData.valor_compra;

    if (latestActiveContract) {
      newTipoColeta = latestActiveContract.tipo_coleta;
      if (newTipoColeta === 'Troca') {
        newFator = String(latestActiveContract.fator_troca || '6');
        newValorCompra = '0,00'; // Reset valor_compra for Troca
      } else if (newTipoColeta === 'Compra') {
        newValorCompra = String(latestActiveContract.valor_coleta || '0,00').replace('.', ','); // Formatar para vírgula
        newFator = '6'; // Reset fator for Compra
      } else if (newTipoColeta === 'Doação') {
        newValorCompra = '0,00'; // Valor da compra é 0 para Doação
        newFator = '6'; // Reset fator for Doação
      }
    } else {
      // Se não houver contrato ativo, resetar para valores padrão
      newTipoColeta = 'Troca';
      newFator = '6';
      newValorCompra = '0,00'; // This is the potential culprit!
    }

    const newFormData = {
      ...formData,
      cliente_id: client.id,
      cliente: client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome, // Concatenate name
      cnpj_cpf: client.cnpj_cpf,
      endereco: client.endereco,
      email: client.email,
      municipio: client.municipio,
      estado: client.estado,
      telefone: client.telefone,
      tipo_coleta: newTipoColeta,
      fator: newFator,
      valor_compra: newValorCompra,
    };
    setFormData(newFormData);
    if (client.estado) {
      setMunicipios(getMunicipios(client.estado).map(m => ({ value: m, label: m })));
    }
    setCnpjCpfValue(client.cnpj_cpf || '');
    setTelefoneValue(client.telefone || '');
    setShowClienteDropdown(false);
    setIsClienteSelected(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.cliente.trim() || !unmask(formData.cnpj_cpf) || !unmask(formData.telefone) || !formData.data_coleta || !formData.hora_coleta || !formData.tipo_coleta || !formData.municipio || !formData.estado) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos com asterisco (*).",
        variant: "destructive"
      });
      return;
    }

    onUpdate(formData);
    
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
              date={formData.data_coleta}
              setDate={(date) => handleInputChange('data_coleta', date || null)}
              className="w-full"
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
              value={formData.hora_coleta}
              onChange={(e) => handleInputChange('hora_coleta', e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="space-y-2 relative">
          <Label htmlFor="cliente" className="text-white flex items-center gap-2">
            <User className="w-4 h-4" />
            Cliente (com contrato ativo) *
          </Label>
          <Input
            id="cliente"
            value={formData.cliente}
            onChange={(e) => handleInputChange('cliente', e.target.value)}
            onFocus={() => setShowClienteDropdown(true)}
            onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
            placeholder="Digite para buscar..."
            className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
            autoComplete="off"
            required
          />
          
          {showClienteDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1"
            >
              {filteredClients.length > 0 ? filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleClienteSelect(client)}
                  className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">{client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome}</div>
                  <div className="text-sm text-gray-600">{formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}</div>
                </div>
              )) : (
                <div className="p-3 text-center text-gray-500">Nenhum cliente com contrato ativo encontrado.</div>
              )}
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <Label htmlFor="cnpj_cpf" className="text-white flex items-center gap-2">
               <Info className="w-4 h-4" />
              CNPJ/CPF *
            </Label>
            <Input
              id="cnpj_cpf"
              ref={cnpjCpfRef}
              value={formData.cnpj_cpf}
              placeholder="Digite o CNPJ ou CPF"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/60 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl"
              required
              disabled={isClienteSelected}
            />
          </div>
          <div className="space-y-2">
              <Label htmlFor="telefone" className="text-white flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefone *
              </Label>
              <Input
                id="telefone"
                ref={telefoneRef}
                value={formData.telefone}
                placeholder="(99) 99999-9999"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
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
            value={formData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@cliente.com"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco" className="text-white flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço da Coleta
          </Label>
          <Input
            id="endereco"
            value={formData.endereco || ''}
            onChange={(e) => handleInputChange('endereco', e.target.value)}
            placeholder="Digite o endereço completo"
            className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-white">Estado *</Label>
                <Select value={formData.estado || ''} onValueChange={handleEstadoChange} required disabled={isClienteSelected}>
                    <SelectTrigger className="w-full bg-white/5 border-white/20 text-white disabled:opacity-70 disabled:cursor-not-allowed rounded-xl">
                        <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700">
                        {estados.map(estado => <SelectItem key={estado.value} value={estado.value}>{estado.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="municipio" className="text-white">Município *</Label>
                <SearchableSelect
                  options={municipios}
                  value={formData.municipio || ''}
                  onChange={handleMunicipioChange}
                  placeholder="Selecione o município"
                  disabled={!formData.estado || isClienteSelected}
                  required
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label htmlFor="tipo_coleta" className="text-white">
                Tipo de Coleta *
              </Label>
              <Select value={formData.tipo_coleta} onValueChange={handleTipoColetaChange} required>
                <SelectTrigger className="w-full bg-white/5 border-white/20 text-white rounded-xl">
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
    
            {formData.tipo_coleta === 'Troca' ? (
              <div className="space-y-2">
                <Label htmlFor="fator" className="text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Fator de Troca *
                </Label>
                <Input
                  id="fator" type="number" step="1" min="1"
                  value={formData.fator} onChange={(e) => handleInputChange('fator', e.target.value)}
                  placeholder="Ex: 6 (para 1 unidade de óleo novo a cada 6kg usado)"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl" required
                />
              </div>
            ) : formData.tipo_coleta === 'Compra' ? (
              <div className="space-y-2">
                <Label htmlFor="valor_compra" className="text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Valor da Compra (R$ por Kg) *
                </Label>
                <Input
                  id="valor_compra" type="text"
                  value={formData.valor_compra} onChange={(e) => handleInputChange('valor_compra', e.target.value)}
                  placeholder="Ex: 1,20"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl" required
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
                  value={formData.doacao_info || ''}
                  onChange={(e) => handleInputChange('doacao_info', e.target.value)}
                  placeholder="Detalhes da doação (opcional)"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
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