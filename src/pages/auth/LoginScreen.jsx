import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { LogIn, User, Key, ArrowLeft, Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, resetPassword } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (!error) {
      toast({
        title: 'Login bem-sucedido!',
        description: `Bem-vindo de volta!`,
      });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Email obrigatório",
        description: "Por favor, informe seu email.",
      });
      return;
    }
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    if (!error) {
      setShowForgotPassword(false);
      setResetEmail('');
    }
    setResetLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Login - Sistema de Coleta de Óleo</title>
        <meta name="description" content="Acesse o sistema de coleta de óleo." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl relative"
        >
          <Link to="/" className="absolute top-4 left-4">
            <Button variant="ghost" className="text-white hover:bg-white/20 rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">Acessar Sistema</h1>
            <p className="text-emerald-200">Use suas credenciais para entrar.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white flex items-center gap-2"><User className="w-4 h-4" /> E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white flex items-center gap-2"><Key className="w-4 h-4" /> Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-12"
                  required
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
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-emerald-300 hover:text-emerald-200 underline transition-colors font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-lg rounded-xl" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              Entrar
            </Button>
          </form>
        </motion.div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">Recuperar Senha</DialogTitle>
            <DialogDescription className="text-emerald-200">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-white flex items-center gap-2">
                <Mail className="w-4 h-4" /> E-mail
              </Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginScreen;