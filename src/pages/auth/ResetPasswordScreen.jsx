import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Key, ArrowLeft, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

const ResetPasswordScreen = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        // Processa o hash da URL primeiro
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && type === 'recovery' && refreshToken) {
          // O token está na URL, vamos processá-lo
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('Erro ao processar token:', error);
            toast({
              variant: "destructive",
              title: "Link inválido",
              description: "O link de recuperação é inválido ou expirou. Solicite um novo link.",
            });
          } else if (data?.session) {
            setIsValidToken(true);
            // Limpa o hash da URL após processar
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            toast({
              variant: "destructive",
              title: "Link inválido",
              description: "O link de recuperação é inválido ou expirou. Solicite um novo link.",
            });
          }
        } else {
          // Verifica se já existe uma sessão válida
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            setIsValidToken(true);
          } else {
            toast({
              variant: "destructive",
              title: "Link inválido",
              description: "O link de recuperação é inválido ou expirou. Solicite um novo link.",
            });
          }
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Ocorreu um erro ao processar o link de recuperação.",
        });
      } finally {
        setCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, []);

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não coincidem",
        description: "As senhas informadas não são iguais. Por favor, verifique.",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao redefinir senha",
          description: error.message || "Não foi possível redefinir a senha. Tente novamente.",
        });
      } else {
        toast({
          title: "Senha redefinida com sucesso!",
          description: "Sua senha foi alterada. Você pode fazer login agora.",
        });
        
        // Aguarda um pouco antes de redirecionar
        setTimeout(() => {
          navigate('/app/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl text-center"
        >
          <div className="text-white mb-6">
            <h1 className="text-2xl font-bold mb-2">Link Inválido</h1>
            <p className="text-emerald-200 mb-6">
              O link de recuperação é inválido ou expirou.
            </p>
            <Link to="/app/login">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Login
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Redefinir Senha - Sistema de Coleta de Óleo</title>
        <meta name="description" content="Redefina sua senha de acesso." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl relative"
        >
          <Link to="/app/login" className="absolute top-4 left-4">
            <Button variant="ghost" className="text-white hover:bg-white/20 rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">Redefinir Senha</h1>
            <p className="text-emerald-200">Digite sua nova senha abaixo.</p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white flex items-center gap-2">
                <Key className="w-4 h-4" /> Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-12"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-800 hover:text-gray-900 transition-all duration-200 flex items-center justify-center"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white flex items-center gap-2">
                <Key className="w-4 h-4" /> Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-12"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-800 hover:text-gray-900 transition-all duration-200 flex items-center justify-center"
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-lg rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Redefinir Senha
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default ResetPasswordScreen;

