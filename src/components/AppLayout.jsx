import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Truck,
  FileText,
  BarChart2,
  LogOut,
  UserCircle,
  Menu,
  X,
  Calendar,
  Users,
  UserCog,
  Building,
  FileSignature,
  Info,
  BookText,
  GitBranch,
  DollarSign,
  Warehouse, // New icon for Estoque
  ArrowDownSquare, // New icon for Entradas
  ArrowUpSquare, // New icon for Saídas
  ListChecks, // New icon for Movimentações
  Scale, // New icon for Saldo Atual
  Package, // New icon for Produtos
  Tag, // New icon for Centros de Custo
  TrendingUp, // New icon for Crédito
  TrendingDown, // New icon for Débito
  ClipboardList, // Icon for Cadastro
  PenLine, 
  Box, 
  Database,
  Bell,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  MapPin,
  Route,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useMenuPermissions } from '@/contexts/MenuPermissionsContext';
import { MENU_STRUCTURE } from '@/config/menuConfig';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getActiveEnvironment, defaultClient } from '@/lib/getActiveEnvironment';
import { setAndRefreshRoutingContext } from '@/lib/customSupabaseClient';
import NotificationsPopover from '@/components/notificacoes/NotificationsPopover';

const AppLayout = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [latestVersion, setLatestVersion] = useState(null);
  const location = useLocation();
   const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { canView, loading: permsLoading } = useMenuPermissions();
  const [activeEnv, setActiveEnv] = useState(null);

  useEffect(() => {
    const fetchEnv = async () => {
      if (user?.id) {
        // ✅ Sincroniza o contexto de roteamento global (PROD ou HOMOLOG)
        await setAndRefreshRoutingContext(user.id, profile?.role);
        
        // Busca o ambiente atual para atualizar o ícone/bugate no layout localmente
        const env = await getActiveEnvironment(false, profile?.role, user.id);
        setActiveEnv(env);

        if (profile?.role) {
           const today = new Date().toISOString().split('T')[0];
           const notifKey = `notif_gen_${user.id}_${today}`;
           if (!sessionStorage.getItem(notifKey)) {
              supabase.rpc('gerar_notificacoes_diarias', { p_user_id: user.id, p_role: profile.role }).then(() => {
                 sessionStorage.setItem(notifKey, 'true');
                 window.dispatchEvent(new Event('notificacoes_atualizadas'));
              }).catch(err => console.log('Notice - Falha silenciosa sync:', err));
           }
        }
      }
    };
    fetchEnv();
    
    // Atualizar quando houver mudança no contexto (simplificado)
    const interval = setInterval(fetchEnv, 30000);
    return () => clearInterval(interval);
  }, [user?.id, profile?.role]);

  const getRoleLabel = (role) => {
    const labels = {
      super_admin: 'Super Admin',
      administrador: 'Administrador',
      gerente: 'Gerente',
      coletor: 'Coletor',
    };
    return labels[role] || role;
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        // DEBUG: Verificar qual cliente está sendo usado
        const clientUrl = supabase.supabaseUrl;
        console.log(`🔍 [AppLayout] Buscando versão no banco: ${clientUrl}`);

        const { data, error } = await supabase
          .from('versoes')
          .select('versao, data_implantacao')
          .order('data_implantacao', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('❌ [AppLayout] Erro ao buscar versão:', error);
          return;
        }

        console.log('✅ [AppLayout] Dados da versão recebidos:', data);
        setLatestVersion(data || { versao: '?.?.?', data_implantacao: new Date().toISOString() });
      } catch (err) {
        console.error('❌ [AppLayout] Erro inesperado ao buscar versão:', err);
      }
    };
    fetchLatestVersion();
  }, [activeEnv]); // Atualiza quando o ambiente muda

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
    } else {
      console.error('Logout error:', error);
    }
  };


  const sidebarVariants = {
    open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-2 px-4">
      {MENU_STRUCTURE.map((item) => {
        if (!canView(item.key)) {
          return null;
        }

        if (item.subItems) {
          // Filtrar os subItems visíveis
          const visibleSubItems = item.subItems.filter(sub => canView(sub.key));
          
          if (visibleSubItems.length === 0) return null;

          const isActiveParent = visibleSubItems.some(sub => location.pathname.startsWith(sub.to));

          return (
            <DropdownMenu key={item.label}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 w-full justify-start transition-all hover:bg-emerald-700 ${isActiveParent ? 'bg-emerald-600 text-white' : 'text-emerald-100'
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gray-800 text-white border-gray-700">
                <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {visibleSubItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  return (
                    <DropdownMenuItem key={subItem.to} asChild>
                      <NavLink
                        to={subItem.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:bg-emerald-700 ${isActive ? 'bg-emerald-600 text-white' : 'text-emerald-100'
                          }`
                        }
                      >
                        {SubIcon && <SubIcon className="h-4 w-4" />}
                        {subItem.label}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-emerald-700 ${isActive ? 'bg-emerald-600 text-white' : 'text-emerald-100'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 overflow-x-hidden">
      <div className={`grid min-h-screen w-full transition-all duration-300 ${isDesktopSidebarOpen
        ? 'md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]'
        : 'grid-cols-[0px_minmax(0,1fr)]'
        }`}>
        <div className={`hidden border-r border-white/10 bg-black/20 md:block overflow-hidden transition-all duration-300 ${isDesktopSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b border-white/10 px-4 lg:h-[60px] lg:px-6">
              <Link to="/" className="flex items-center gap-1 font-semibold text-white">
                <span className="text-white font-bold text-xl">RJR</span>
                <span className="text-yellow-400 font-bold text-xl">ÓLEO</span>
              </Link>
            </div>
            <div className="flex-1 py-4 overflow-y-auto">
              <NavLinks />
            </div>
            <div className="mt-auto px-4 pb-1">
              <div className="border-t border-white/10 pt-3 space-y-2">
                <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-emerald-100 hover:bg-emerald-700/50 hover:text-white rounded-xl h-8 text-xs">
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sair
                </Button>

                <div className="flex flex-col items-center justify-center w-full px-2">
                  <div className="flex items-center justify-center gap-2 mb-0.5">
                    <div
                      className="cursor-pointer group flex items-center gap-1.5"
                      onClick={() => navigate('/app/versoes')}
                    >
                      <span className="text-[10px] text-emerald-300/80 font-medium group-hover:text-white transition-colors">
                        Versão: <span className="font-bold text-emerald-300">v{latestVersion?.versao || '?.?.?'}</span>
                      </span>

                      <TooltipProvider>
                        {activeEnv && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`p-1 rounded-md border cursor-help transition-all transform hover:scale-110 shadow-sm ${activeEnv.tipo === 'producao'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                }`}>
                                <Database className="w-3 h-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-gray-900 border-white/10 text-white p-2 shadow-xl">
                              <p className="text-[10px] font-bold">{activeEnv.nome}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </div>
                  <p className="text-[8px] text-emerald-300/20 font-medium tracking-tight uppercase">
                    Sistema de Gerenciamento
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 z-40 md:hidden"
              />
              <motion.div
                variants={sidebarVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="fixed top-0 left-0 h-full w-64 bg-emerald-900 border-r border-white/10 z-50 md:hidden"
              >
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 lg:h-[60px] lg:px-6">
                  <Link to="/" className="flex items-center gap-1 font-semibold text-white">
                    <span className="text-white font-bold text-xl">RJR</span>
                    <span className="text-yellow-400 font-bold text-xl">ÓLEO</span>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 py-4 overflow-y-auto">
                  <NavLinks />
                </div>
                <div className="mt-auto px-4 pb-1">
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-emerald-100 hover:bg-emerald-700/50 hover:text-white rounded-xl h-8 text-xs">
                      <LogOut className="mr-2 h-3.5 w-3.5" />
                      Sair
                    </Button>

                    <div className="flex flex-col items-center justify-center w-full pb-2">
                      <div className="flex items-center justify-center gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5" onClick={() => navigate('/app/versoes')}>
                          <span className="text-[10px] text-emerald-300/80 font-medium">
                            Versão: <span className="font-bold text-emerald-300">v{latestVersion?.versao || '?.?.?'}</span>
                          </span>

                          {activeEnv && (
                            <div className={`p-1 rounded-md border shadow-sm ${activeEnv.tipo === 'producao'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                              }`}>
                              <Database className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[8px] text-emerald-300/20 font-medium tracking-tight uppercase">
                        Sistema de Gerenciamento
                      </p>
                    </div>
                  </div>
                </div>
                {/* Removed the extra closing div tag here */}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex flex-col min-w-0">
          <header className="flex h-14 items-center gap-4 border-b border-white/10 bg-black/20 px-4 lg:h-[60px] lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>

            {/* Desktop Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex text-white hover:bg-emerald-700/50"
              onClick={() => setDesktopSidebarOpen(!isDesktopSidebarOpen)}
              title={isDesktopSidebarOpen ? "Recolher menu" : "Expandir menu"}
            >
              {isDesktopSidebarOpen ? (
                <ChevronsLeft className="h-5 w-5 text-emerald-300" />
              ) : (
                <ChevronsRight className="h-5 w-5 text-emerald-300" />
              )}
            </Button>

            <div className="w-full flex-1" />
            <div className="text-right text-white flex items-center justify-end gap-3">
              <NotificationsPopover />
              <div className="flex flex-col items-end">
                <p className="font-semibold flex items-center gap-2 text-sm truncate">
                  <UserCircle className="w-5 h-5" /> {profile?.full_name || user?.email}
                </p>
                <p className="text-xs text-emerald-300 capitalize">{getRoleLabel(profile?.role)}</p>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;