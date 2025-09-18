import React, { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LandingPage from '@/pages/LandingPage';
import AppLayout from '@/components/AppLayout';
import LoginScreen from '@/pages/LoginScreen';
import DashboardPage from '@/pages/DashboardPage';
import ListaColetas from '@/pages/ListaColetas';
import ColetaForm from '@/pages/ColetaForm';
import ListaClientes from '@/pages/ListaClientes';
import ClienteForm from '@/pages/ClienteForm';
import CertificadoPage from '@/pages/CertificadoPage';
import ListaCertificados from '@/pages/ListaCertificados';
import CertificadoViewPage from '@/pages/CertificadoViewPage';
import AssinaturaPage from '@/pages/AssinaturaPage';
import ContratoAssinadoPage from '@/pages/ContratoAssinadoPage';
import RelatorioColetasPage from '@/pages/relatorios/RelatorioColetasPage';
import RelatorioFinanceiroPage from '@/pages/relatorios/RelatorioFinanceiroPage';
import RelatorioEstoquePage from '@/pages/relatorios/RelatorioEstoquePage';
import UserManagementPage from '@/pages/UserManagementPage';
import UserFormPage from '@/pages/UserFormPage';
import EmpresaPage from '@/pages/EmpresaPage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import ListaContratos from '@/pages/ListaContratos';
import ContratoForm from '@/pages/ContratoForm';
import AjudaPage from '@/pages/AjudaPage';
import FaqPage from '@/pages/FaqPage';
import SobreSistemaPage from '@/pages/SobreSistemaPage';
import LogsPage from '@/pages/LogsPage';
import VersoesPage from '@/pages/VersoesPage';
import ListaFinanceiro from '@/pages/ListaFinanceiro';
import FinanceiroForm from '@/pages/FinanceiroForm';
import AssinaturaReciboPage from '@/pages/AssinaturaReciboPage';
import ReciboPublicoPage from '@/pages/ReciboPublicoPage';
// Estoque Pages
import EntradaFormPage from '@/pages/estoque/EntradaFormPage';
import SaidaFormPage from '@/pages/estoque/SaidaFormPage';
import ListaMovimentacoesPage from '@/pages/estoque/ListaMovimentacoesPage';
import SaldoEstoquePage from '@/pages/estoque/SaldoEstoquePage';
import ListaProdutosPage from '@/pages/estoque/ListaProdutosPage';
import ProdutoFormPage from '@/pages/estoque/ProdutoFormPage';
import ListaEntradasPage from '@/pages/estoque/ListaEntradasPage'; // New import
import ListaSaidasPage from '@/pages/estoque/ListaSaidasPage'; // New import
import ListaCentrosCusto from '@/pages/ListaCentrosCusto'; // New import
import CentroCustoForm from '@/pages/CentroCustoForm'; // New import
import CertificadoDisplayPage from '@/pages/CertificadoDisplayPage';
import CertificadoPublicoPage from '@/pages/CertificadoPublicoPage';

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
        <Route path="/certificado/publico/:id" element={<CertificadoPublicoPage />} />
        <Route path="/assinatura/:id" element={<AssinaturaPage />} />
        <Route path="/contrato-assinado/:id" element={<ContratoAssinadoPage />} />
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
                  <Route path="clientes" element={<ListaClientes />} />
                  <Route path="clientes/novo" element={<ClienteForm />} />
                  <Route path="clientes/editar/:id" element={<ClienteForm />} />
                  <Route path="sobre" element={<SobreSistemaPage />} />
                  <Route path="versoes" element={<VersoesPage />} />
                  
                  <Route path="certificados" element={<ProtectedRoute requiredRole="administrador"><ListaCertificados /></ProtectedRoute>} />
                  <Route path="certificados/novo" element={<ProtectedRoute requiredRole="administrador"><CertificadoPage /></ProtectedRoute>} />
                  <Route path="certificados/editar/:id" element={<ProtectedRoute requiredRole="administrador"><CertificadoPage /></ProtectedRoute>} />
                  <Route path="certificados/view/:id" element={<ProtectedRoute requiredRole="administrador"><CertificadoDisplayPage /></ProtectedRoute>} />
                  <Route path="relatorios/coletas" element={<ProtectedRoute requiredRole="administrador"><RelatorioColetasPage /></ProtectedRoute>} />
                  <Route path="relatorios/financeiro" element={<ProtectedRoute requiredRole="administrador"><RelatorioFinanceiroPage /></ProtectedRoute>} />
                  <Route path="relatorios/estoque" element={<ProtectedRoute requiredRole="administrador"><RelatorioEstoquePage /></ProtectedRoute>} />
                  <Route path="contratos" element={<ListaContratos />} />
                  <Route path="contratos/novo" element={<ContratoForm />} />
                  <Route path="contratos/editar/:id" element={<ContratoForm />} />
                  
                  {/* New Financeiro Routes */}
                  <Route path="financeiro/credito" element={<ProtectedRoute requiredRole="administrador"><ListaFinanceiro type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/credito/novo" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/credito/editar/:id" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="credito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito" element={<ProtectedRoute requiredRole="administrador"><ListaFinanceiro type="debito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito/novo" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="debito" /></ProtectedRoute>} />
                  <Route path="financeiro/debito/editar/:id" element={<ProtectedRoute requiredRole="administrador"><FinanceiroForm type="debito" /></ProtectedRoute>} />

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