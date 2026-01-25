import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, UserPlus, Save, Loader2, Link } from 'lucide-react';
import { logAction } from '@/lib/logger';
import UserFormFields from '@/components/users/UserFormFields';
import { UserAccountLinkModal } from '@/components/users/UserAccountLinkModal';
import { Dialog } from '@/components/ui/dialog';

const UserFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userFormData, setUserFormData] = useState({
    full_name: '',
    email: '',
    cpf: '',
    telefone: '',
    password: '',
    role: 'coletor',
    status: 'ativo',
  });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAccountLinkDialogOpen, setIsAccountLinkDialogOpen] = useState(false);

  const fetchUser = useCallback(async (userId) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_users');
    
    if (error) {
      toast({ title: 'Erro ao carregar usuário', description: error.message, variant: 'destructive' });
      navigate('/app/usuarios');
      return;
    }

    const user = data.find(u => u.id === userId);

    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não encontrado.', variant: 'destructive' });
      navigate('/app/usuarios');
    } else {
      setUserFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        cpf: user.cpf || '',
        telefone: user.telefone || '',
        password: '',
        role: user.role || 'coletor',
        status: user.status || 'ativo',
      });
    }
    setLoading(false);
  }, [toast, navigate]);

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      fetchUser(id);
    }
  }, [id, fetchUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setUserFormData((prev) => ({ ...prev, role: value }));
  };

  const validateForm = () => {
    const { full_name, email, password, role, status } = userFormData;
    if (!full_name || !email || (!isEditing && !password) || !role || !status) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome, Email, Senha (novo usuário), Perfil e Status são obrigatórios.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleUpdateUser = async () => {
    console.log('🔄 Atualizando usuário:', { id, userFormData });
    
    if (!id) {
      return { message: 'ID do usuário não fornecido' };
    }

    // Validar role
    const validRole = userFormData.role === 'coletor' || userFormData.role === 'administrador' 
      ? userFormData.role 
      : 'coletor';
    
    console.log('📝 Role validado:', validRole);

    // Atualizar diretamente em profiles usando UPDATE (não upsert) para garantir que atualize
    // Usar RPC para garantir que o tipo ENUM seja respeitado
    console.log('📝 Tentando atualizar via UPDATE direto...');
    const { data: updateData, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        full_name: userFormData.full_name,
        role: validRole,
        cpf: userFormData.cpf || null,
        telefone: userFormData.telefone || null,
        status: userFormData.status || 'ativo'
      })
      .eq('id', id)
      .select('id, full_name, role, estado, municipio, cpf');

    if (updateError) {
      console.error('❌ Erro no update:', updateError);
      
      // Se update falhar (pode ser porque o registro não existe), tentar upsert
      console.log('🔄 Tentando upsert (pode ser que o registro não exista)...');
      const profileData = {
        id: id,
        full_name: userFormData.full_name,
        role: validRole,
        estado: null,
        municipio: null,
        cpf: userFormData.cpf || null,
        telefone: userFormData.telefone || null,
        status: userFormData.status || 'ativo'
      };

      const { data: upsertData, error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id'
        })
        .select();
      
      if (upsertError) {
        console.error('❌ Erro no upsert também:', upsertError);
        return upsertError;
      }
      
      console.log('✅ Perfil criado/atualizado com sucesso (upsert):', upsertData);
      return null;
    }

    console.log('✅ Perfil atualizado com sucesso (update):', updateData);
    
    // Verificar se o role foi realmente atualizado
    if (updateData && updateData[0]) {
      console.log('✅ Role confirmado na resposta:', updateData[0].role);
      if (updateData[0].role !== validRole) {
        console.warn('⚠️ ATENÇÃO: O role na resposta não corresponde ao enviado!', {
          enviado: validRole,
          recebido: updateData[0].role
        });
      }
    }

    // Tentar atualizar também em auth.users via edge function (opcional, não bloqueia)
    // A função get_all_users agora busca de profiles, então isso é apenas para sincronização
    try {
      const { error: functionError } = await supabase.functions.invoke('update-user', {
        body: { 
          userId: id, 
          userData: {
            full_name: userFormData.full_name,
            role: validRole
          }
        }
      });
      if (functionError) {
        console.warn('⚠️ Edge function update-user falhou (não crítico, get_all_users usa profiles):', functionError);
      } else {
        console.log('✅ auth.users também atualizado via edge function');
      }
    } catch (err) {
      console.warn('⚠️ Erro ao chamar edge function update-user (não crítico):', err);
    }
    
    return null;
  };

  const handleCreateUser = async () => {
    // Criar usuário em auth.users primeiro
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: userFormData.email,
      password: userFormData.password,
      options: {
        data: { 
          full_name: userFormData.full_name,
          cpf: userFormData.cpf || null,
          telefone: userFormData.telefone || null,
          status: userFormData.status || 'ativo'
        },
        app_metadata: {
          role: userFormData.role,
          estado: null,
          municipio: null
        }
      }
    });

    if (signUpError) {
      return signUpError;
    }

    if (user) {
      // Inserir em profiles (o trigger também vai criar, mas fazemos manualmente para garantir)
      const profileData = {
        id: user.id,
        full_name: userFormData.full_name,
        role: userFormData.role,
        estado: null,
        municipio: null,
        cpf: userFormData.cpf || null,
        telefone: userFormData.telefone || null,
        status: userFormData.status || 'ativo'
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Erro ao inserir em profiles:', profileError);
        // Não é crítico, o trigger vai criar
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    let error;

    if (isEditing) {
      error = await handleUpdateUser();
    } else {
      error = await handleCreateUser();
    }
    
    if (error) {
      toast({ title: `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} usuário`, description: error.message, variant: 'destructive' });
      await logAction(isEditing ? 'update_user_failed' : 'create_user_failed', { error: error.message, user_email: userFormData.email });
    } else {
      // Verificar se o update realmente funcionou antes de navegar
      if (isEditing) {
        console.log('🔍 Verificando se o update foi bem-sucedido...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', id)
          .single();
        
        if (!verifyError && verifyData) {
          console.log('✅ Dados confirmados após update:', verifyData);
          if (verifyData.role !== userFormData.role) {
            console.warn('⚠️ ATENÇÃO: O role não foi atualizado corretamente!', {
              esperado: userFormData.role,
              atual: verifyData.role
            });
            toast({ 
              title: 'Aviso', 
              description: `Perfil atualizado, mas o role pode não ter sido alterado. Verifique manualmente.`,
              variant: 'default'
            });
          } else {
            toast({ title: `Usuário atualizado com sucesso!`, description: `Perfil: ${verifyData.role}` });
          }
        }
      } else {
        toast({ title: `Usuário cadastrado com sucesso!` });
      }
      
      await logAction(isEditing ? 'update_user_success' : 'create_user_success', { user_email: userFormData.email, role: userFormData.role });
      
      // Pequeno delay para garantir que o banco processou
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate('/app/usuarios');
    }
    setLoading(false);
  };

  const handleOpenAccountLinkDialog = () => {
    setIsAccountLinkDialogOpen(true);
  };

  if (loading && isEditing) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }
  
  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Editar Usuário' : 'Novo Usuário'} - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-4 md:p-8"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <UserPlus className="w-8 h-8 text-emerald-400" />
              {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
            </CardTitle>
            {isEditing && (
              <Button
                type="button"
                onClick={handleOpenAccountLinkDialog}
                className="w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2"
              >
                <Link className="w-5 h-5" />
                Vincular Contas Correntes
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <UserFormFields
                userFormData={userFormData}
                isEditing={isEditing}
                handleChange={handleChange}
                handleRoleChange={handleRoleChange}
              />
              <CardFooter className="flex justify-between items-center pt-6 gap-4">
                <Button
                  type="button"
                  onClick={() => navigate('/app/usuarios')}
                  variant="outline"
                  className="w-auto rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {isEditing && userFormData.email && (
        <UserAccountLinkModal
          user={{ id: id, full_name: userFormData.full_name, email: userFormData.email }}
          isOpen={isAccountLinkDialogOpen}
          setIsOpen={setIsAccountLinkDialogOpen}
        />
      )}
    </>
  );
};

export default UserFormPage;