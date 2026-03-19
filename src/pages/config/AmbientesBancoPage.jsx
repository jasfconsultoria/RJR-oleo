import React, { useState, useEffect, useCallback } from 'react';
import { Database, Edit2, Trash2, CheckCircle2, XCircle, Loader2, Save, Info, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { defaultClient, defaultSupabaseUrl, defaultSupabaseAnonKey, homologSupabaseUrl, homologSupabaseAnonKey } from '@/lib/getActiveEnvironment';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { isSuperAdmin } from '@/lib/envUtils';
import UserDatabasePreferencesManager from '@/components/UserDatabasePreferencesManager';
import { createClient } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AmbientesBancoPage = () => {
  const { toast } = useToast();
  const { profile } = useProfile();
  const role = profile?.role;
  const [ambientes, setAmbientes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingEnvironmentId, setTestingEnvironmentId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Ambientes padrão (conforme fornecido pelo usuário)
  const ambientesPadrao = [
    {
      id: 'producao-padrao',
      nome: 'Produção',
      tipo: 'producao',
      url: defaultSupabaseUrl,
      anon_key: defaultSupabaseAnonKey,
      descricao: 'Ambiente de Produção (Principal)',
      isPadrao: true,
    },
    {
      id: 'homologacao-padrao',
      nome: 'Homologação',
      tipo: 'homologacao',
      url: homologSupabaseUrl,
      anon_key: homologSupabaseAnonKey,
      descricao: 'Ambiente de Homologação (Testes)',
      isPadrao: true,
    },
  ];

  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'producao',
    url: '',
    anon_key: '',
    descricao: '',
  });
  const [editingId, setEditingId] = useState(null);

  const fetchAmbientes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await defaultClient
        .from('db_environments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao buscar ambientes do banco, usando padrões:', error);
      }

      const ambientesDoBanco = data || [];
      const ambientesCombinados = ambientesPadrao.map(ambientePadrao => {
        const encontrado = ambientesDoBanco.find(a => a.tipo === ambientePadrao.tipo);
        return encontrado || ambientePadrao;
      });

      const outrosAmbientes = ambientesDoBanco.filter(
        a => !ambientesPadrao.some(ap => ap.tipo === a.tipo)
      );

      setAmbientes([...ambientesCombinados, ...outrosAmbientes]);
    } catch (error) {
      console.error('Erro ao buscar ambientes:', error);
      setAmbientes(ambientesPadrao);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAmbientes();
  }, [fetchAmbientes]);

  const handleOpenDialog = (ambiente = null) => {
    if (ambiente) {
      setFormData({
        nome: ambiente.nome,
        tipo: ambiente.tipo,
        url: ambiente.url,
        anon_key: ambiente.anon_key,
        descricao: ambiente.descricao || '',
      });
      setEditingId(ambiente.isPadrao ? null : ambiente.id);
    } else {
      setFormData({
        nome: '',
        tipo: 'producao',
        url: '',
        anon_key: '',
        descricao: '',
      });
      setEditingId(null);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.url || !formData.anon_key) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Nome, URL e Chave Anônima são necessários.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const dbData = {
        nome: formData.nome,
        tipo: formData.tipo,
        url: formData.url,
        anon_key: formData.anon_key,
        descricao: formData.descricao,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await defaultClient
          .from('db_environments')
          .update(dbData)
          .eq('id', editingId);
        if (error) throw error;

        // Atualiza as preferências de todos os usuários atrelados a este tipo de ambiente
        const { error: prefError } = await defaultClient
          .from('user_db_preferences')
          .update({
            url: dbData.url,
            anon_key: dbData.anon_key,
            nome: dbData.nome,
            updated_at: new Date().toISOString()
          })
          .eq('tipo', dbData.tipo);
          
        if (prefError) {
          console.error('Erro ao atualizar user_db_preferences', prefError);
        }
      } else {
        const { error } = await defaultClient
          .from('db_environments')
          .insert(dbData);
        if (error) throw error;
      }

      toast({ title: 'Sucesso!', description: 'Ambiente salvo com sucesso.' });
      setIsDialogOpen(false);
      fetchAmbientes();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (ambiente) => {
    setTestingEnvironmentId(ambiente.id);
    setTestResult(null);
    try {
      const testClient = createClient(ambiente.url, ambiente.anon_key, {
        auth: { persistSession: false }
      });

      // Tentar uma query simples em qualquer tabela comum ou via RPC
      const { error } = await testClient.from('profiles').select('id', { count: 'exact', head: true }).limit(1);

      if (error && error.code !== 'PGRST116') throw error;

      setTestResult({ success: true, url: ambiente.url, timestamp: new Date().toLocaleTimeString() });
      toast({ title: '✅ Conexão OK!', description: 'Banco de dados acessível.' });
    } catch (error) {
      setTestResult({ success: false, url: ambiente.url, error: error.message, timestamp: new Date().toLocaleTimeString() });
      toast({ variant: 'destructive', title: '❌ Falha na conexão', description: error.message });
    } finally {
      setTestingEnvironmentId(null);
    }
  };

  if (!isSuperAdmin(role)) {
    return <div className="p-8 text-center text-white">Acesso negado. Apenas super administradores podem acessar esta página.</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Database className="w-8 h-8 text-emerald-400" />
          Gerenciamento de Ambientes de Banco
        </h1>
        <p className="text-emerald-300/60">Configure múltiplos bancos do Supabase para o sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>
        ) : (
          ambientes.map((amb) => (
            <Card key={amb.id} className="bg-black/40 border-white/10 text-white backdrop-blur-sm">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold text-emerald-100">{amb.nome}</CardTitle>
                    <Badge variant={amb.tipo === 'producao' ? 'default' : 'secondary'} className={amb.tipo === 'producao' ? 'bg-emerald-600' : 'bg-amber-600'}>
                      {amb.tipo === 'producao' ? 'Produção' : 'Homologação'}
                    </Badge>
                  </div>
                  <CardDescription className="text-emerald-300/40">{amb.descricao}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" className="text-emerald-300 hover:text-emerald-100" onClick={() => handleOpenDialog(amb)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs space-y-1">
                  <span className="text-emerald-300/30 uppercase font-bold tracking-wider">URL do Supabase</span>
                  <p className="font-mono bg-black/40 p-2 rounded border border-white/5 break-all">{amb.url}</p>
                </div>
                
                {testResult && testResult.url === amb.url && (
                  <div className={`p-3 rounded-lg flex items-center gap-3 border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <div className="text-xs">
                      <p className="font-bold">{testResult.success ? 'Conexão Estabelecida' : 'Falha na Conexão'}</p>
                      <p className="opacity-70">{testResult.timestamp}</p>
                    </div>
                  </div>
                )}

                <Button 
                  className="w-full bg-white/5 hover:bg-white/10 text-emerald-100 border border-white/10" 
                  onClick={() => handleTestConnection(amb)}
                  disabled={testingEnvironmentId === amb.id}
                >
                  {testingEnvironmentId === amb.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Testar Conexão
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="w-6 h-6 text-emerald-400" />
          Gerenciar Bancos de Dados por Usuário
        </h2>
        <UserDatabasePreferencesManager />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-emerald-500/20 text-white">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Ambiente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="bg-black/40 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipo} onValueChange={t => setFormData({...formData, tipo: t})}>
                  <SelectTrigger className="bg-black/40 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL do Supabase</Label>
              <Input value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="bg-black/40 border-white/10" />
            </div>
            <div className="space-y-2">
              <Label>Chave Anônima (Anon Key)</Label>
              <Input value={formData.anon_key} onChange={e => setFormData({...formData, anon_key: e.target.value})} className="bg-black/40 border-white/10" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="bg-black/40 border-white/10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Ambiente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AmbientesBancoPage;
