import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  }, []);

  // Função auxiliar para limpar tokens inválidos
  const clearInvalidTokens = useCallback(() => {
    try {
      // Limpar todas as chaves relacionadas ao Supabase do localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();
      console.log('Tokens de autenticação limpos');
    } catch (error) {
      console.error('Erro ao limpar tokens:', error);
    }
  }, []);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Se houver erro ao buscar sessão (ex: token inválido), limpar dados locais
        if (error && (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found'))) {
          console.warn('Token de refresh inválido, limpando dados de autenticação...');
          clearInvalidTokens();
          handleSession(null);
          return;
        }
        
        handleSession(session);
      } catch (error) {
        console.error('Erro ao buscar sessão:', error);
        // Se for erro de token, limpar
        if (error.message?.includes('token') || error.message?.includes('Token')) {
          clearInvalidTokens();
        }
        handleSession(null);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        // Se o evento for de erro de token, limpar dados locais
        if (event === 'SIGNED_OUT') {
          clearInvalidTokens();
        }
        
        handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, clearInvalidTokens]);

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    try {
      // Limpar tokens inválidos antes de tentar login
      clearInvalidTokens();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = error.message || "Erro ao fazer login";
        
        // Mensagens de erro mais amigáveis
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
          errorMessage = "Email ou senha incorretos. Verifique suas credenciais.";
        } else if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
          errorMessage = "Por favor, confirme seu email antes de fazer login.";
        } else if (error.status === 500 || error.message?.includes('500')) {
          errorMessage = "Erro no servidor. Por favor, tente novamente em alguns instantes ou verifique se o servidor está online.";
        } else if (error.message?.includes('rate_limit')) {
          errorMessage = "Muitas tentativas de login. Por favor, aguarde alguns minutos antes de tentar novamente.";
        }
        
        toast({
          variant: "destructive",
          title: "Erro ao fazer login",
          description: errorMessage,
        });
        
        return { data, error };
      }

      // Se o login foi bem-sucedido, verificar o status do usuário
      if (data?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Erro ao buscar status do usuário:', profileError);
          // Se não conseguir buscar o perfil, permite o login (comportamento padrão)
        } else if (profileData?.status === 'inativo') {
          // Se o usuário estiver inativo, fazer logout e mostrar mensagem
          await supabase.auth.signOut();
          clearInvalidTokens();
          setSession(null);
          setUser(null);
          
          toast({
            variant: "destructive",
            title: "Acesso negado",
            description: "Sua conta está inativa. Entre em contato com o administrador do sistema.",
          });
          
          return { 
            data: null, 
            error: { 
              message: "Usuário inativo",
              status: 403
            } 
          };
        }
        // Se o status for 'ativo' ou não existir, permite o login normalmente
      }

      return { data, error: null };
    } catch (err) {
      console.error('Erro inesperado ao fazer login:', err);
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: "Ocorreu um erro inesperado. Por favor, tente novamente.",
      });
      return { error: err };
    }
  }, [toast, clearInvalidTokens]);

  const signOut = useCallback(async () => {
    try {
      // Limpa dados locais primeiro
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Faz logout no Supabase
      const { error } = await supabase.auth.signOut();
      
      // Limpa estado local independente do resultado
      setSession(null);
      setUser(null);

      if (error) {
        console.error('Sign out error:', error);
        // Não mostra toast de erro para evitar confusão do usuário
        // O importante é que o estado local foi limpo
      }

      return { error: null }; // Sempre retorna sucesso para o fluxo continuar
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      // Limpa estado mesmo em caso de erro inesperado
      setSession(null);
      setUser(null);
      return { error: null };
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      let errorMessage = error.message || "Não foi possível enviar o email de recuperação";
      
      // Tratamento específico para rate limit
      if (error.code === 'over_email_send_rate_limit' || error.error_code === 'over_email_send_rate_limit') {
        errorMessage = "Limite de envio de emails excedido. Por favor, aguarde alguns minutos antes de tentar novamente.";
      }
      
      toast({
        variant: "destructive",
        title: "Erro ao enviar email",
        description: errorMessage,
      });
    } else {
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    }

    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }), [user, session, loading, signUp, signIn, signOut, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};