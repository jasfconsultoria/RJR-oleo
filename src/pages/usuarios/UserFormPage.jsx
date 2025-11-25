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
    password: '',
    role: 'coletor',
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
        password: '',
        role: user.role || 'coletor',
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
    const { full_name, email, password, role } = userFormData;
    if (!full_name || !email || (!isEditing && !password) || !role) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome, Email, Senha (novo usuário) e Perfil são obrigatórios.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleUpdateUser = async () => {
    const { data, error } = await supabase.functions.invoke('update-user', {
      body: { userId: id, userData: userFormData },
    });
    return error;
  };

  const handleCreateUser = async () => {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { userFormData },
    });
    return error;
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
      toast({ title: `Usuário ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!` });
      await logAction(isEditing ? 'update_user_success' : 'create_user_success', { user_email: userFormData.email, role: userFormData.role });
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