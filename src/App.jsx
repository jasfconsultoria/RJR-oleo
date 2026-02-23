import React, { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LandingPage from '@/pages/info/LandingPage';
import AppLayout from '@/components/AppLayout';
import LoginScreen from '@/pages/auth/LoginScreen';
import ResetPasswordScreen from '@/pages/auth/ResetPasswordScreen';
import DashboardPage from '@/pages/config/DashboardPage';
import ListaColetas from '@/pages/coletas/ListaColetas';
import ColetaForm from '@/pages/coletas/ColetaForm';
import ListaClientes from '@/pages/clientes/ListaClientes';
import ClienteForm from '@/pages/clientes/ClienteForm';
import CertificadoPage from '@/pages/certificados/CertificadoPage';
import ListaCertificados from '@/pages/certificados/ListaCertificados';
import CertificadoViewPage from '@/pages/certificados/CertificadoViewPage';
import AssinaturaPage from '@/pages/AssinaturaPage';
import ContratoAssinadoPage from '@/pages/contratos/ContratoAssinadoPage';
import RelatorioColetasPage from '@/pages/relatorios/RelatorioColetasPage';
import RelatorioFinanceiroPage from '@/pages/relatorios/RelatorioFinanceiroPage';
import RelatorioEstoquePage from '@/pages/relatorios/RelatorioEstoquePage';
import UserManagementPage from '@/pages/usuarios/UserManagementPage';
import UserFormPage from '@/pages/usuarios/UserFormPage';
import EmpresaPage from '@/pages/config/EmpresaPage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import ListaContratos from '@/pages/contratos/ListaContratos';
import ContratoForm from '@/pages/contratos/ContratoForm';
import AjudaPage from '@/pages/info/AjudaPage';
import FaqPage from '@/pages/info/FaqPage';
import SobreSistemaPage from '@/pages/info/SobreSistemaPage';
import LogsPage from '@/pages/config/LogsPage';
import VersoesPage from '@/pages/info/VersoesPage';
import ListaFinanceiro from '@/pages/financeiro/ListaFinanceiro';
import FinanceiroForm from '@/pages/financeiro/FinanceiroForm';
import AssinaturaReciboPage from '@/pages/recibos/AssinaturaReciboPage';
import ReciboPublicoPage from '@/pages/recibos/ReciboPublicoPage';
import ListaRecibosAvulsos from '@/pages/recibos-avulsos/ListaRecibosAvulsos';
import ReciboAvulsoForm from '@/pages/recibos-avulsos/ReciboAvulsoForm';
import AssinaturaReciboAvulsoPage from '@/pages/recibos-avulsos/AssinaturaReciboAvulsoPage';
import ReciboAvulsoPublicoPage from '@/pages/recibos-avulsos/ReciboAvulsoPublicoPage';
// Estoque Pages
import EntradaFormPage from '@/pages/estoque/EntradaFormPage';
import SaidaFormPage from '@/pages/estoque/SaidaFormPage';
import ListaMovimentacoesPage from '@/pages/estoque/ListaMovimentacoesPage';
import SaldoEstoquePage from '@/pages/estoque/SaldoEstoquePage';
import ListaProdutosPage from '@/pages/produtos/ListaProdutosPage';
import ProdutoFormPage from '@/pages/produtos/ProdutoFormPage';
import ListaEntradasPage from '@/pages/estoque/ListaEntradasPage'; // New list page
import ListaSaidasPage from '@/pages/estoque/ListaSaidasPage'; // New list page
import ListaCentrosCusto from '@/pages/centros-custo/ListaCentrosCusto'; // New list page
import CentroCustoForm from '@/pages/centros-custo/CentroCustoForm'; // New form page
import CertificadoDisplayPage from '@/pages/certificados/CertificadoDisplayPage';
import CertificadoPublicoPage from '@/pages/certificados/CertificadoPublicoPage';
import RelatorioRecipientesPage from '@/pages/relatorios/RelatorioRecipientesPage'; // New import

const ProtectedRoute = ({ children, requiredRole }) => {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading || profileLoading) {
    return <div className="flex justify-center items-center h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 text-white"><p>Carregando...</p></div>;
  }
  
  if (!session) {
    return <Navigate to="/app/login" state={{ from: location }} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};

function App() {
  const { session, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOutAndRedirect = useCallback(async (isError = false) => {
    await signOut();
    navigate('/app/login');
    if (isError) {
      toast({
        variant: "destructive",
        title: "Sessão Expirada",
        description: "Por favor, faça o login novamente.",
      });
    }
  }, [signOut, navigate, toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
           // This will be handled by the redirect in ProtectedRoute
        } else if (event === 'TOKEN_REFRESHED' && session === null) {
          // This case indicates a problem with the refresh token.
          handleSignOutAndRedirect(true);
        } else if (event === 'USER_DELETED') {
           handleSignOutAndRedirect(true);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [handleSignOutAndRedirect]);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/sobre" element={<SobreSistemaPage />} />
        <Route path="/certificado-view" element={<CertificadoViewPage />} />
        <Route path="/assinatura/recibo/:id" element={<AssinaturaReciboPage />} />
        <Route path="/recibo/publico/:id" element={<ReciboPublicoPage />} />
        <Route path="/assinatura/recibo-avulso/:id" element={<AssinaturaReciboAvulsoPage />} />
        <Route path="/recibo-avulso/publico/:id" element={<ReciboAvulsoPublicoPage />} />
        <Route path="/certificado/publico/:id" element={<CertificadoPublicoPage />} />
        <Route path="/assinatura/:id" element={<AssinaturaPage />} />
        <Route path="/contrato-assinado/:id" element={<ContratoAssinadoPage />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/app/login" element={!session ? <LoginScreen /> : <Navigate to="/app/dashboard" />} />
        <Route 
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="coletas" element={<ListaColetas />} />
                  <Route path="coletas/nova" element={<ColetaForm />} />
                  <Route path="coletas/editar/:id" element={<ColetaForm />} />
                  
                  {/* Updated Cadastro Routes */}
                  <Route path="cadastro/clientes" element={<ListaClientes personType="cliente" />} />
                  <Route path="cadastro/clientes/novo" element={<ClienteForm personType="cliente" />} />
                  <Route path="cadastro/clientes/editar/:id" element={<ClienteForm personType="cliente" />} />
                  <Route path="cadastro/fornecedores" element={<ListaClientes personType="fornecedor" />} />
                  <Route path="cadastro/fornecedores/novo" element={<ClienteForm personType="fornecedor" />} />
                  <Route path="cadastro/fornecedores/editar/:id" element={<ClienteForm personType="fornecedor" />} />
                  <Route path="cadastro/contratos" element={<ListaContratos />} />
                  <Route path="cadastro/contratos/novo" element={<ContratoForm />} />
                  <Route path="cadastro/contratos/editar/:id" element={<ContratoForm />} />

                  <Route path="sobre" element={<SobreSistemaPage />} />
                  <Route path="versoes" element={<VersoesPage />} />
                  
                  <Route path="certificados" element={<ProtectedRoute requiredRole="administrador"><ListaCertificados /></ProtectedRoute>} />
                  <Route path="certificados/novo" element={<ProtectedRoute requiredRole="administrador"><CertificadoPage /></ProtectedRoute>} />
                  <Route path="certificados/editar/:id" element={<ProtectedRoute requiredRole="administrador"><CertificadoPage /></ProtectedRoute>} />
                  <Route path="certificados/view/:id" element={<ProtectedRoute requiredRole="administrador"><CertificadoDisplayPage /></ProtectedRoute>} />
                  <Route path="relatorios/coletas" element={<ProtectedRoute requiredRole="administrador"><RelatorioColetasPage /></ProtectedRoute>} />
                  <Route path="relatorios/financeiro" element={<ProtectedRoute requiredRole="administrador"><RelatorioFinanceiroPage /></ProtectedRoute>} />
                  <Route path="relatorios/estoque" element={<ProtectedRoute requiredRole="administrador"><RelatorioEstoquePage /></ProtectedRoute>} />
                  <Route path="relatorios/recipientes" element={<ProtectedRoute requiredRole="administrador"><RelatorioRecipientesPage /></ProtectedRoute>} /> {/* New route */}
                  
                  {/* New Financeiro Routes */}
                  <Route path="financeiro/credito" element={<ProtectedRoute requiredRole="administrador"><ListaFinanceiro type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/credito/novo" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/credito/editar/:id" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito" element={<ProtectedRoute requiredRole="administrador"><ListaFinanceiro type="debito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito/novo" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="debito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito/editar/:id" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="debito" /></ProtectedRoute>} />
                  <Route path="financeiro/recibos" element={<ProtectedRoute requiredRole="administrador"><ListaRecibosAvulsos /></ProtectedRoute>} />
                  <Route path="financeiro/recibos/novo" element={<ProtectedRoute requiredRole="administrador"><ReciboAvulsoForm /></ProtectedRoute>} />
                  <Route path="financeiro/recibos/editar/:id" element={<ProtectedRoute requiredRole="administrador"><ReciboAvulsoForm /></ProtectedRoute>} />

                  {/* New Estoque Routes */}
                  <Route path="estoque/produtos" element={<ProtectedRoute requiredRole="administrador"><ListaProdutosPage /></ProtectedRoute>} />
                  <Route path="estoque/produtos/novo" element={<ProtectedRoute requiredRole="administrador"><ProdutoFormPage /></ProtectedRoute>} />
                  <Route path="estoque/produtos/editar/:id" element={<ProtectedRoute requiredRole="administrador"><ProdutoFormPage /></ProtectedRoute>} />
                  <Route path="estoque/entradas" element={<ProtectedRoute requiredRole="administrador"><ListaEntradasPage /></ProtectedRoute>} /> {/* New list page */}
                  <Route path="estoque/entradas/novo" element={<ProtectedRoute requiredRole="administrador"><EntradaFormPage /></ProtectedRoute>} /> {/* Form for new entry */}
                  <Route path="estoque/entradas/editar/:id" element={<ProtectedRoute requiredRole="administrador"><EntradaFormPage /></ProtectedRoute>} /> {/* Form for editing entry */}
                  <Route path="estoque/saidas" element={<ProtectedRoute requiredRole="administrador"><ListaSaidasPage /></ProtectedRoute>} /> {/* New list page */}
                  <Route path="estoque/saidas/novo" element={<ProtectedRoute requiredRole="administrador"><SaidaFormPage /></ProtectedRoute>} /> {/* Form for new exit */}
                  <Route path="estoque/saidas/editar/:id" element={<ProtectedRoute requiredRole="administrador"><SaidaFormPage /></ProtectedRoute>} /> {/* Form for editing exit */}
                  <Route path="estoque/movimentacoes" element={<ProtectedRoute requiredRole="administrador"><ListaMovimentacoesPage /></ProtectedRoute>} />
                  <Route path="estoque/saldo" element={<ProtectedRoute requiredRole="administrador"><SaldoEstoquePage /></ProtectedRoute>} />

                  {/* New Cost Center Routes */}
                  <Route path="centros-custo" element={<ProtectedRoute requiredRole="administrador"><ListaCentrosCusto /></ProtectedRoute>} />
                  <Route path="centros-custo/novo" element={<ProtectedRoute requiredRole="administrador"><CentroCustoForm /></ProtectedRoute>} />
                  <Route path="centros-custo/editar/:id" element={<ProtectedRoute requiredRole="administrador"><CentroCustoForm /></ProtectedRoute>} />

                  <Route path="usuarios" element={
                    <ProtectedRoute requiredRole="administrador">
                      <UserManagementPage />
                    </ProtectedRoute>
                  } />
                   <Route path="usuarios/novo" element={
                    <ProtectedRoute requiredRole="administrador">
                      <UserFormPage />
                    </ProtectedRoute>
                  } />
                  <Route path="usuarios/editar/:id" element={
                    <ProtectedRoute requiredRole="administrador">
                      <UserFormPage />
                    </ProtectedRoute>
                  } />
                  <Route path="empresa" element={
                    <ProtectedRoute requiredRole="administrador">
                      <EmpresaPage />
                    </ProtectedRoute>
                  } />
                  <Route path="logs" element={
                    <ProtectedRoute requiredRole="administrador">
                      <LogsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/app/dashboard" />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } 
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;