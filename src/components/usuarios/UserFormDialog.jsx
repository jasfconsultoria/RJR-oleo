import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useLocationData } from '@/hooks/useLocationData';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';

export const UserFormDialog = ({ userToEdit, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'coletor',
    estado: '',
    municipio: ''
  });
  const [municipios, setMunicipiosList] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { refetchProfile } = useProfile();

  // Buscar estados e municípios do banco de dados
  const { estados, fetchMunicipios } = useLocationData();

  useEffect(() => {
    if (userToEdit) {
      setFormData({
        email: userToEdit.email,
        password: '', // Password is not editable here
        full_name: userToEdit.full_name || '',
        role: userToEdit.role,
        estado: userToEdit.estado || '',
        municipio: userToEdit.municipio || ''
      });
      if(userToEdit.estado) {
        fetchMunicipios(userToEdit.estado).then(municipiosList => {
          setMunicipiosList(municipiosList.map(m => ({ value: m, label: m })));
        });
      }
    } else {
      // Reset form for new user
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'coletor',
        estado: '',
        municipio: ''
      });
      setMunicipiosList([]);
    }
  }, [userToEdit, fetchMunicipios]);

  useEffect(() => {
    const loadMunicipios = async () => {
      if (formData.estado) {
        const municipiosList = await fetchMunicipios(formData.estado);
        setMunicipiosList(municipiosList.map(m => ({ value: m, label: m })));
      } else {
        setMunicipiosList([]);
      }
    };
    loadMunicipios();
  }, [formData.estado, fetchMunicipios]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'estado') {
      setFormData(prev => ({ ...prev, municipio: '' }));
    }
    if (name === 'role' && value === 'administrador') {
      setFormData(prev => ({ ...prev, estado: '', municipio: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (userToEdit) {
      // Atualizar usuário existente (apenas full_name pode ser editado)
      let errors = [];
      
      // 1. Upsert na tabela profiles (insere se não existir, atualiza se existir)
      // Usamos os dados existentes do usuário para garantir que todos os campos estejam presentes
      const profileData = {
        id: userToEdit.id,
        full_name: formData.full_name,
        role: userToEdit.role || 'coletor', // Manter role existente
        estado: userToEdit.estado || null,
        municipio: userToEdit.municipio || null
      };
      
      console.log('📝 Tentando atualizar/inserir em profiles:', profileData);
      
      const { data: profileResult, error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id'
        })
        .select();
      
      if (profileError) {
        console.error('❌ Erro ao atualizar/inserir em profiles:', profileError);
        console.error('❌ Detalhes do erro:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        
        // Tentar atualizar diretamente se upsert falhar
        console.log('🔄 Tentando atualizar diretamente...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ full_name: formData.full_name })
          .eq('id', userToEdit.id);
        
        if (updateError) {
          // Se update falhar, tentar insert
          console.log('🔄 Tentando inserir diretamente...');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(profileData);
          
          if (insertError) {
            console.error('❌ Erro ao inserir diretamente:', insertError);
            errors.push(`Profiles: ${insertError.message}`);
          } else {
            console.log('✅ Perfil inserido com sucesso (método direto)');
          }
        } else {
          console.log('✅ Perfil atualizado com sucesso (método direto)');
        }
      } else {
        console.log('✅ Perfil atualizado/inserido com sucesso em profiles:', profileResult);
      }

      // Nota: O trigger na migração 2072 vai sincronizar automaticamente auth.users quando profiles for atualizado
      // Não precisamos chamar a edge function manualmente

      if (errors.length > 0 && profileError) {
        toast({ 
          title: 'Erro ao atualizar usuário', 
          description: errors.join('; '), 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Usuário atualizado com sucesso!' });
        await refetchProfile();
        onSave();
      }
      
    } else {
      // Criar novo usuário
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name },
          app_metadata: {
            role: formData.role,
            estado: formData.role === 'coletor' ? formData.estado : null,
            municipio: formData.role === 'coletor' ? formData.municipio : null
          }
        }
      });

      if (signUpError) {
        toast({ title: 'Erro ao criar usuário', description: signUpError.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (user) {
        console.log('👤 Usuário criado em auth.users:', user.id);
        
        // Upsert na tabela profiles após criar o usuário (insere se não existir, atualiza se existir)
        const profileData = {
          id: user.id,
          full_name: formData.full_name,
          role: formData.role,
          estado: formData.role === 'coletor' ? formData.estado : null,
          municipio: formData.role === 'coletor' ? formData.municipio : null
        };
        
        console.log('📝 Tentando inserir/atualizar em profiles:', profileData);
        
        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, {
            onConflict: 'id'
          })
          .select();

        if (profileError) {
          console.error('❌ Erro ao inserir/atualizar em profiles:', profileError);
          console.error('❌ Detalhes do erro:', {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint
          });
          
          // Tentar inserir diretamente se upsert falhar
          console.log('🔄 Tentando inserir diretamente...');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(profileData);
          
          if (insertError) {
            console.error('❌ Erro ao inserir diretamente:', insertError);
            toast({ 
              title: 'Usuário criado, mas houve erro ao salvar em profiles', 
              description: `Erro: ${insertError.message}. Verifique as permissões RLS e tente inserir manualmente.`,
              variant: 'destructive'
            });
          } else {
            console.log('✅ Perfil inserido com sucesso (método direto)');
            toast({ title: 'Usuário criado com sucesso!', description: 'Peça para o novo usuário confirmar o e-mail.' });
          }
        } else {
          console.log('✅ Perfil criado/atualizado com sucesso em profiles:', profileResult);
          toast({ title: 'Usuário criado com sucesso!', description: 'Peça para o novo usuário confirmar o e-mail.' });
        }
        onSave();
      }
    }
    setLoading(false);
  };

  return (
    <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
      <DialogHeader>
        <DialogTitle>{userToEdit ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
        <DialogDescription className="text-emerald-300">
          {userToEdit ? 'Atualize os dados do usuário.' : 'Preencha os dados para criar um novo usuário.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleInputChange} required className="bg-white/10 border-white/30" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required disabled={!!userToEdit} className="bg-white/10 border-white/30" />
          </div>
          {!userToEdit && (
            <>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required minLength={6} className="bg-white/10 border-white/30" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="role">Perfil</Label>
                <Select value={formData.role} onValueChange={(v) => handleSelectChange('role', v)}>
                  <SelectTrigger className="bg-white/10 border-white/30"><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coletor">Coletor</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {formData.role === 'coletor' && !userToEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select value={formData.estado} onValueChange={(v) => handleSelectChange('estado', v)}>
                  <SelectTrigger className="bg-white/10 border-white/30"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {estados.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="municipio">Município</Label>
                <SearchableSelect
                  options={municipios}
                  value={formData.municipio}
                  onChange={(v) => handleSelectChange('municipio', v)}
                  placeholder="Selecione"
                  disabled={!formData.estado}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (userToEdit ? 'Salvar Alterações' : 'Criar Usuário')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};