import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { estados, getMunicipios } from '@/lib/location';
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
  const { updateUser } = useAuth();
  const { refetchProfile } = useProfile();

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
      if(userToEdit.estado) setMunicipiosList(getMunicipios(userToEdit.estado).map(m => ({ value: m, label: m })));
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
  }, [userToEdit]);

  useEffect(() => {
    if (formData.estado) {
      setMunicipiosList(getMunicipios(formData.estado).map(m => ({ value: m, label: m })));
    } else {
      setMunicipiosList([]);
    }
  }, [formData.estado]);

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
      let error;
      if (userToEdit.role === 'administrador') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: formData.full_name })
          .eq('id', userToEdit.id);
        error = profileError;
      } else {
        const { error: authError } = await updateUser(userToEdit.id, {
          user_metadata: { full_name: formData.full_name }
        });
        error = authError;
      }

      if (error) {
        toast({ title: 'Erro ao atualizar usuário', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Usuário atualizado com sucesso!' });
        await refetchProfile();
        onSave();
      }
      
    } else {
      // Logic for creating a new user
      const { data: { user }, error } = await supabase.auth.signUp({
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

      if (error) {
        toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
      } else if (user) {
         toast({ title: 'Usuário criado com sucesso!', description: 'Peça para o novo usuário confirmar o e-mail.' });
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