import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // NOVO: Importar o Input
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, FileText, Search } from 'lucide-react';
import { logAction } from '@/lib/logger';
import { CertificadoViewDialog } from '@/components/certificados/CertificadoViewDialog';
import { formatCnpjCpf } from '@/lib/utils'; // NOVO: Para formatar o CNPJ/CPF na lista

const getTodayDate = () => new Date();
const getFirstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const CertificadoPage = () => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState(getFirstDayOfMonth());
  const [periodoFim, setPeriodoFim] = useState(getTodayDate());
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCertificado, setGeneratedCertificado] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  
  // NOVO: Estados para controlar a busca e o dropdown
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // ALTERADO: Busca clientes com contratos ativos
        const { data: clientData, error: clientError } = await supabase
          .from('clientes')
          .select('*, contratos(status)')
          .order('nome', { ascending: true });

        if (clientError) throw clientError;

        // Filtra para manter apenas clientes com pelo menos um contrato ativo
        const activeClients = (clientData || []).filter(client =>
          client.contratos && client.contratos.some(contract => contract.status === 'Ativo')
        );
        setClients(activeClients);

        const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('*').single();
        if (empresaError) throw empresaError;
        setEmpresa(empresaData);

      } catch (error) {
        toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  // NOVO: Função para selecionar o cliente
  const handleClientSelect = (client) => {
    setSelectedClientId(client.id);
    // Exibe o nome do cliente no campo de busca para feedback visual
    setSearchTerm(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome);
    setShowDropdown(false); // Esconde o dropdown após a seleção
  };
  
  // NOVO: Filtra os clientes com base no termo de busca
  const filteredClients = searchTerm
    ? clients.filter(client =>
        (client.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.cnpj_cpf && client.cnpj_cpf.includes(searchTerm))
      )
    : clients;


  const handleGenerate = async () => {
    if (!selectedClientId || !periodoInicio || !periodoFim) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, selecione um cliente e o período.', variant: 'destructive' });
      return;
    }
    if (periodoInicio > periodoFim) {
      toast({ title: 'Período inválido', description: 'A data de início não pode ser posterior à data de fim.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data: coletas, error: coletasError } = await supabase
        .from('coletas')
        .select('quantidade_coletada')
        .eq('cliente_id', selectedClientId)
        .gte('data_coleta', periodoInicio.toISOString().split('T')[0])
        .lte('data_coleta', periodoFim.toISOString().split('T')[0]);

      if (coletasError) throw coletasError;

      const totalKg = coletas.reduce((acc, coleta) => acc + (coleta.quantidade_coletada || 0), 0);
      if (totalKg === 0) {
        toast({ title: 'Nenhuma coleta encontrada', description: 'Não há coletas para o cliente no período selecionado.', variant: 'destructive' });
        setIsGenerating(false);
        return;
      }

      const selectedClient = clients.find(c => c.id === selectedClientId);
      const dataEmissao = new Date();

      const { data: certData, error: certError } = await supabase
        .from('certificados')
        .insert({
          cliente_id: selectedClientId,
          cliente_nome: selectedClient.nome,
          periodo_inicio: periodoInicio.toISOString().split('T')[0],
          periodo_fim: periodoFim.toISOString().split('T')[0],
          total_kg: totalKg,
          data_emissao: dataEmissao.toISOString(),
        })
        .select()
        .single();

      if (certError) throw certError;

      await logAction('generate_certificate', { certificate_id: certData.id, client_id: selectedClientId });
      toast({ title: 'Certificado gerado com sucesso!' });

      const fullCertData = {
        cliente: selectedClient,
        empresa: empresa,
        periodo: { 
          inicio: certData.periodo_inicio, 
          fim: certData.periodo_fim 
        },
        totalKg: certData.total_kg,
        data_emissao: certData.data_emissao,
      };
      setGeneratedCertificado(fullCertData);

    } catch (error) {
      toast({ title: 'Erro ao gerar certificado', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Emissão de Certificados - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto p-4 md:p-8"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8 text-emerald-400" />
              Emissão de Certificados
            </CardTitle>
            <CardDescription className="text-emerald-200/80">
              Gere certificados de destinação de óleo para seus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            
            {/* // ALTERADO: Substituímos o ClienteSearchableSelect pela lógica manual */}
            <div className="space-y-2 relative">
              <Label htmlFor="cliente" className="block mb-2">Cliente (com contrato ativo) *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                 <Input
                  id="cliente"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Delay para permitir o clique
                  placeholder="Digite para buscar..."
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl pl-10"
                  autoComplete="off"
                />
              </div>
              
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1"
                >
                  {loading ? (
                     <div className="p-3 text-center text-gray-500">Carregando...</div>
                  ) : filteredClients.length > 0 ? filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="periodo-inicio" className="block mb-2">Período Início *</Label>
                <DatePicker date={periodoInicio} setDate={setPeriodoInicio} />
              </div>
              <div>
                <Label htmlFor="periodo-fim" className="block mb-2">Período Fim *</Label>
                <DatePicker date={periodoFim} setDate={setPeriodoFim} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between p-4 md:p-6">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-auto rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || loading || !selectedClientId} // Desabilita se nenhum cliente for selecionado
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              Gerar
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
      <CertificadoViewDialog 
        certificado={generatedCertificado}
        onOpenChange={(isOpen) => !isOpen && setGeneratedCertificado(null)}
      />
    </>
  );
};

export default CertificadoPage;