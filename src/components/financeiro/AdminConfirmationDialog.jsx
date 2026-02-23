import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

const AdminConfirmationDialog = ({ isOpen, onClose, onConfirm, currentUserId, documentInfo }) => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirm = async () => {
        if (!email || !password) {
            setError('Por favor, preencha todos os campos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Cria um cliente temporário isolado para não afetar o usuário logado
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                    storageKey: 'supabase.auth.temp.confirmation'
                }
            });

            const { data: authData, error: authError } = await tempSupabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                throw new Error('Credenciais inválidas ou erro na autenticação.');
            }

            const secondAdminId = authData.user.id;

            // 1. Verificar se não é o mesmo usuário
            if (secondAdminId === currentUserId) {
                throw new Error('A confirmação deve ser realizada por um administrador diferente.');
            }

            // 2. Verificar se o usuário é administrador
            const { data: profile, error: profileError } = await tempSupabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', secondAdminId)
                .single();

            if (profileError || profile?.role !== 'administrador') {
                throw new Error('O usuário informado não possui privilégios de administrador.');
            }

            // Sucesso!
            onConfirm({
                id: secondAdminId,
                name: profile.full_name
            });
            onClose();

        } catch (err) {
            setError(err.message);
            toast({
                title: 'Erro na confirmação',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                        <AlertCircle className="text-yellow-400" />
                        Confirmação de Administrador
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-emerald-200">
                        Esta é uma operação sensível. Para excluir o documento <strong>{documentInfo}</strong>, é necessária a confirmação de um segundo administrador.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-email">E-mail do Administrador</Label>
                        <Input
                            id="admin-email"
                            type="email"
                            placeholder="email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin-password">Senha</Label>
                        <Input
                            id="admin-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
                        />
                    </div>
                    {error && (
                        <p className="text-red-400 text-sm font-medium">{error}</p>
                    )}
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel
                        onClick={() => {
                            setEmail('');
                            setPassword('');
                            setError('');
                            onClose();
                        }}
                        className="bg-transparent border-white/20 text-white hover:bg-white/10 rounded-xl"
                    >
                        Cancelar
                    </AlertDialogCancel>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            'Confirmar Exclusão'
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default AdminConfirmationDialog;
