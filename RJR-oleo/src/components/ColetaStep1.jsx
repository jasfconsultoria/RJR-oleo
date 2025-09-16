import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, MapPin, Calculator, Package, Info, AtSign, Phone, ArrowLeft } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { estados, getMunicipios } from '@/lib/location';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useIMask } from 'react-imask';
import { formatCnpjCpf, unmask, formatToISODate } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

const tiposColeta = [
  { id: 'Troca', nome: 'Troca' },
  { id: 'Compra', nome: 'Compra' },
];

export function ColetaStep1({ data, onNext, onUpdate, profile }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(data);
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
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
    setFormData(prev => ({ ...prev, tipo_coleta: value }));
  };

  useEffect(() => {
    setFormData(data);
    if (data.estado) {
      setMunicipios(getMunicipios(data.estado).map(m => ({ value: m, label: m })));
    }
    setCnpjCpfValue(data.cnpj_cpf || '');
    setTelefoneValue(data.telefone || '');
    setIsClienteSelected(!!data.cliente_id);
  }, [data, setCnpjCpfValue, setTelefoneValue]);

  useEffect(() => {
    const fetchClientesComContratoAtivo = async () => {
      const { data: activeContracts, error: contractsError } = await supabase
        .from('contratos')
        .select('cliente_id, tipo_coleta, valor_coleta, fator_troca')
        .eq('status', 'Ativo');

      if (contractsError) {
        toast({ title: "Erro ao buscar contratos ativos", description: contractsError.message, variant: "destructive" });
        return;
      }

      if (!activeContracts || activeContracts.length === 0) {
        setClientes([]);
        setFilteredClientes([]);
        return;
      }

      const clienteIds = activeContracts.map(c => c.cliente_id).filter(id => id != null);

      if (clienteIds.length === 0) {
        setClientes([]);
        setFilteredClientes([]);
        return;
      }

      const { data: fetchedClientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .in('id', clienteIds);

      if (clientesError) {
        toast({ title: "Erro ao buscar clientes", description: clientesError.message, variant: "destructive" });
      } else {
        const clientesComContrato = (fetchedClientes || []).map(cliente => {
            const contrato = activeContracts.find(c => c.cliente_id === cliente.id);
            return { ...cliente, contratos: contrato ? [contrato] : [] };
        });
        setClientes(clientesComContrato);
        setFilteredClientes(clientesComContrato);
      }
    };
    fetchClientesComContratoAtivo();
  }, [toast]);

  useEffect(() => {
    if (formData.cliente) {
      const filtered = clientes.filter(cliente =>
        cliente.nome.toLowerCase().includes(formData.cliente.toLowerCase())
      );
      setFilteredClientes(filtered);
    } else {
      setFilteredClientes(clientes);
    }
  }, [formData.cliente, clientes]);

  const handleClienteSelect = (cliente) => {
    const activeContract = cliente.contratos?.[0];
    
    const newFormData = {
      ...formData,
      cliente_id: cliente.id,
      cliente: cliente.nome,
      cnpj_cpf: cliente.cnpj_cpf,
      endereco: cliente.endereco,
      email: cliente.email,
      municipio: cliente.municipio,
      estado: cliente.estado,
      telefone: cliente.telefone,
      tipo_coleta: activeContract?.tipo_coleta || formData.tipo_coleta,
      fator: activeContract?.tipo_coleta === 'Troca' ? activeContract.fator_troca : formData.fator,
      valor_compra: activeContract?.tipo_coleta === 'Compra' ? String(activeContract.valor_coleta || '').replace('.', ',') : formData.valor_compra,
    };
    setFormData(newFormData);
    if (cliente.estado) {
      setMunicipios(getMunicipios(cliente.estado).map(m => ({ value: m, label: m })));
    }
    setCnpjCpfValue(cliente.cnpj_cpf || '');
    setTelefoneValue(cliente.telefone || '');
    setShowClienteDropdown(false);
    setIsClienteSelected(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.cliente.trim() || !unmask(formData.cnpj_cpf) || !unmask(formData.telefone) || !formData.data_coleta || !formData.tipo_coleta || !formData.municipio || !formData.estado) {
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
        <div className="space-y-2">
          <Label htmlFor="data_coleta" className="text-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Data da Coleta *
          </Label>
          <DatePicker
            date={formData.data_coleta ? new Date(formData.data_coleta + 'T00:00:00') : null}
            setDate={(date) => handleInputChange('data_coleta', formatToISODate(date))}
            className="w-full"
            disabled={profile?.role !== 'admin'}
          />
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
              {filteredClientes.length > 0 ? filteredClientes.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => handleClienteSelect(cliente)}
                  className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">{cliente.nome}</div>
                  <div className="text-sm text-gray-600">{formatCnpjCpf(cliente.cnpj_cpf)} - {cliente.municipio}/{cliente.estado}</div>
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
                  placeholder="Ex: 6 (para 1L de óleo novo a cada 6L usado)"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl" required
                />
              </div>
            ) : (
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