
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Building, Upload, Save, Loader2, Clock, ListChecks } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { brazilianLocations } from '@/lib/brazilian-locations';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const timezones = [
  'America/Noronha',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Araguaina',
  'America/Maceio',
  'America/Bahia',
  'America/Sao_Paulo',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Santarem',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Manaus',
  'America/Eirunepe',
  'America/Rio_Branco',
];

const EmpresaPage = () => {
  const [empresa, setEmpresa] = useState(null);
  const [formData, setFormData] = useState({
    nome_fantasia: '',
    razao_social: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    logo_sistema_url: '',
    logo_documento_url: '',
    timezone: 'America/Sao_Paulo',
    items_per_page: 25,
    estado: '',
    municipio: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ sistema: false, documento: false });
  const { toast } = useToast();
  const [municipios, setMunicipios] = useState([]);

  const fetchEmpresa = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('empresa').select('*').limit(1).single();

    if (error) {
      if (error.code === 'PGRST116') {
        toast({ title: 'Empresa não cadastrada', description: 'Cadastre as informações da empresa.', variant: 'default' });
      } else {
        toast({ title: 'Erro ao buscar dados da empresa', description: error.message, variant: 'destructive' });
      }
    } else if (data) {
      setEmpresa(data);
      setFormData({ 
        ...data, 
        timezone: data.timezone || 'America/Sao_Paulo',
        items_per_page: data.items_per_page || 25,
        estado: data.estado || '',
        municipio: data.municipio || '',
      });
      if (data.estado) {
        setMunicipios(brazilianLocations.municipios[data.estado] || []);
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchEmpresa();
  }, [fetchEmpresa]);

  const handleChange = (e) => {
    const { id, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [id]: type === 'number' ? parseInt(value, 10) : value }));
  };
  
  const handleSelectChange = (id, value) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (id === 'estado') {
      setMunicipios(brazilianLocations.municipios[value] || []);
      setFormData((prev) => ({ ...prev, municipio: '' }));
    }
  };

  const handleLogoUpload = async (event, logoType) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [logoType]: true }));
    const fileName = `${logoType}_${Date.now()}_${file.name}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro no upload da logo', description: uploadError.message, variant: 'destructive' });
      setUploading(prev => ({ ...prev, [logoType]: false }));
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);

    if (!publicUrlData) {
        toast({ title: 'Erro ao obter URL pública', variant: 'destructive' });
        setUploading(prev => ({ ...prev, [logoType]: false }));
        return;
    }
    
    const urlKey = logoType === 'sistema' ? 'logo_sistema_url' : 'logo_documento_url';
    setFormData((prev) => ({ ...prev, [urlKey]: publicUrlData.publicUrl }));
    setUploading(prev => ({ ...prev, [logoType]: false }));
    toast({ title: `Logo (${logoType}) enviada com sucesso!` });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const dataToSave = { ...formData, updated_at: new Date() };

    let error;

    if (empresa && empresa.id) {
       const { error: updateError } = await supabase
        .from('empresa')
        .update(dataToSave)
        .eq('id', empresa.id);
       error = updateError;
    } else {
       const { error: insertError } = await supabase
        .from('empresa')
        .insert(dataToSave);
       error = insertError;
    }

    if (error) {
      toast({ title: 'Erro ao salvar os dados', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dados da empresa atualizados com sucesso!' });
      fetchEmpresa();
    }
    setSaving(false);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const estadoOptions = brazilianLocations.estados.map(e => ({ value: e.sigla, label: e.nome }));
  const municipioOptions = municipios.map(m => ({ value: m, label: m }));

  return (
    <>
      <Helmet>
        <title>Dados da Empresa - RJR Óleo</title>
      </Helmet>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <Building className="w-8 h-8 text-emerald-400" /> Dados da Empresa
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie as informações e as logos da sua empresa.</p>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Informações Cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input id="nome_fantasia" value={formData.nome_fantasia || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social</Label>
                  <Input id="razao_social" value={formData.razao_social || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" value={formData.cnpj || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" value={formData.telefone || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input id="endereco" value={formData.endereco || ''} onChange={handleChange} className="bg-white/20 border-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <SearchableSelect
                    options={estadoOptions}
                    value={formData.estado}
                    onChange={(value) => handleSelectChange('estado', value)}
                    placeholder="Selecione o estado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipio">Município</Label>
                  <SearchableSelect
                    options={municipioOptions}
                    value={formData.municipio}
                    onChange={(value) => handleSelectChange('municipio', value)}
                    placeholder="Selecione o município"
                    disabled={!formData.estado}
                  />
                </div>
              </div>
              
              <div className="pt-6 border-t border-white/20 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="flex items-center gap-2"><Clock className="w-4 h-4"/> Fuso Horário</Label>
                    <Select value={formData.timezone} onValueChange={(value) => handleSelectChange('timezone', value)}>
                        <SelectTrigger className="w-full bg-white/20 border-white/30 text-white">
                            <SelectValue placeholder="Selecione o fuso horário" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 text-white border-gray-700">
                            {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-emerald-200/70">Define o fuso horário para os filtros de data em todo o sistema.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="items_per_page" className="flex items-center gap-2"><ListChecks className="w-4 h-4"/> Itens por Página</Label>
                    <Input id="items_per_page" type="number" value={formData.items_per_page} onChange={handleChange} className="bg-white/20 border-white/30" />
                    <p className="text-xs text-emerald-200/70">Define a quantidade de registros exibidos por página nas listas.</p>
                  </div>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/20">
                <div className="space-y-4">
                  <CardTitle className="text-lg">Logo do Sistema</CardTitle>
                  <CardDescription>Usada na página inicial e no topo do sistema.</CardDescription>
                  {formData.logo_sistema_url && (
                      <div className="my-4 p-2 bg-white/10 rounded-md flex justify-center">
                          <img src={formData.logo_sistema_url} alt="Logo do Sistema" className="h-24 w-auto rounded object-contain" />
                      </div>
                    )}
                  <div className="flex items-center gap-4">
                    <Button type="button" asChild variant="outline" className="border-emerald-500 text-emerald-300 hover:bg-emerald-800 hover:text-emerald-200">
                      <label htmlFor="logo-sistema-upload" className="cursor-pointer flex items-center">
                        {uploading.sistema ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {uploading.sistema ? 'Enviando...' : 'Trocar Logo'}
                      </label>
                    </Button>
                    <input type="file" id="logo-sistema-upload" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'sistema')} disabled={uploading.sistema} />
                  </div>
                </div>

                <div className="space-y-4">
                  <CardTitle className="text-lg">Logo para Documentos</CardTitle>
                  <CardDescription>Usada em recibos, certificados e outros documentos.</CardDescription>
                  {formData.logo_documento_url && (
                      <div className="my-4 p-2 bg-white/10 rounded-md flex justify-center">
                          <img src={formData.logo_documento_url} alt="Logo para Documentos" className="h-24 w-auto rounded object-contain" />
                      </div>
                    )}
                  <div className="flex items-center gap-4">
                    <Button type="button" asChild variant="outline" className="border-emerald-500 text-emerald-300 hover:bg-emerald-800 hover:text-emerald-200">
                      <label htmlFor="logo-documento-upload" className="cursor-pointer flex items-center">
                        {uploading.documento ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {uploading.documento ? 'Enviando...' : 'Trocar Logo'}
                      </label>
                    </Button>
                    <input type="file" id="logo-documento-upload" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'documento')} disabled={uploading.documento} />
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="border-t border-white/20 pt-6">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </>
  );
};

export default EmpresaPage;
