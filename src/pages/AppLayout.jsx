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
  PenLine, // Alterado de Signature para PenLine
  Box, // New icon for Recipientes
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/contexts/ProfileContext';
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

const AppLayout = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);
  
  useEffect(() => {
    const fetchLatestVersion = async () => {
      const { data, error } = await supabase
        .from('versoes')
        .select('versao, data_implantacao')
        .order('data_implantacao', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setLatestVersion(data);
      }
    };
    fetchLatestVersion();
  }, []);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
    } else {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { 
      label: 'Cadastro', 
      icon: ClipboardList, // Using ClipboardList for Cadastro
      subItems: [
        { to: '/app/cadastro/clientes', label: 'Clientes', icon: Users },
        { to: '/app/cadastro/fornecedores', label: 'Fornecedores', icon: Users },
        { to: '/app/cadastro/contratos', label: 'Contratos', icon: FileSignature },
      ]
    },
    { 
      label: 'Financeiro', 
      icon: DollarSign, 
      adminOnly: true,
      subItems: [
        { to: '/app/financeiro/credito', label: 'Crédito', icon: TrendingUp },
        { to: '/app/financeiro/debito', label: 'Débito', icon: TrendingDown },
        { to: '/app/financeiro/recibos', label: 'Recibos', icon: FileText },
        { to: '/app/centros-custo', label: 'Centro de Custos', icon: Tag },
      ]
    },
    { to: '/app/coletas', icon: Truck, label: 'Coletas' },
    { to: '/app/certificados', icon: FileText, label: 'Certificados', adminOnly: true },
    { 
      label: 'Relatórios', 
      icon: BarChart2, 
      adminOnly: true,
      subItems: [
        { to: '/app/relatorios/coletas', label: 'Coletas', icon: Truck },
        { to: '/app/relatorios/financeiro', label: 'Financeiro', icon: DollarSign },
        { to: '/app/relatorios/estoque', label: 'Estoque', icon: Warehouse },
        { to: '/app/relatorios/recipientes', label: 'Recipientes', icon: Box }, // Novo item
      ]
    },
    { 
      label: 'Estoque', 
      icon: Warehouse, 
      adminOnly: true,
      subItems: [
        { to: '/app/estoque/produtos', label: 'Produtos', icon: Package },
        { to: '/app/estoque/entradas', label: 'Entradas', icon: ArrowDownSquare },
        { to: '/app/estoque/saidas', label: 'Saídas', icon: ArrowUpSquare },
        { to: '/app/estoque/movimentacoes', label: 'Movimentações', icon: ListChecks },
        { to: '/app/estoque/saldo', label: 'Saldo Atual', icon: Scale },
      ]
    },
    { to: '/app/usuarios', icon: UserCog, label: 'Usuários', adminOnly: true },
    { to: '/app/empresa', icon: Building, label: 'Empresa', adminOnly: true },
    { to: '/app/logs', icon: BookText, label: 'Logs', adminOnly: true },
    { to: '/app/sobre', icon: Info, label: 'Sobre' },
    { to: '/app/versoes', icon: GitBranch, label: 'Versões' },
  ];

  const sidebarVariants = {
    open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    closed: { x: '-100%', transition: { type: 'spring', stiffness: 300, damping: 30 } },
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-2 px-4">
      {navItems.map((item) => {
        if (item.adminOnly && profile?.role !== 'administrador') {
          return null;
        }
        
        if (item.subItems) {
          const isActiveParent = item.subItems.some(sub => location.pathname.startsWith(sub.to));
          return (
            <DropdownMenu key={item.label}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 w-full justify-start transition-all hover:bg-emerald-700 ${
                    isActiveParent ? 'bg-emerald-600 text-white' : 'text-emerald-100'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gray-800 text-white border-gray-700">
                <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {item.subItems.map(subItem => {
                  const SubIcon = subItem.icon;
                  return (
                    <DropdownMenuItem key={subItem.to} asChild>
                      <NavLink
                        to={subItem.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:bg-emerald-700 ${
                            isActive ? 'bg-emerald-600 text-white' : 'text-emerald-100'
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
              `flex items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-emerald-700 ${
                isActive ? 'bg-emerald-600 text-white' : 'text-emerald-100'
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900">
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r border-white/10 bg-black/20 md:block">
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
            <div className="mt-auto p-4 border-t border-white/10">
              <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-emerald-100 hover:bg-emerald-700 hover:text-white">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
               {latestVersion && (
                <div className="text-center text-xs text-emerald-300/70 mt-4">
                  <p>Versão: {latestVersion.versao}</p>
                  <p>{format(new Date(latestVersion.data_implantacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
              )}
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
                  <div className="mt-auto p-4 border-t border-white/10">
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-emerald-100 hover:bg-emerald-700 hover:text-white">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </Button>
                    {latestVersion && (
                      <div className="text-center text-xs text-emerald-300/70 mt-4">
                        <p>Versão: {latestVersion.versao}</p>
                         <p>{format(new Date(latestVersion.data_implantacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </div>
                    )}
                  </div>
                {/* Removed the extra closing div tag here */}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex flex-col">
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
            <div className="w-full flex-1" />
            <div className="text-right text-white">
              <p className="font-semibold flex items-center gap-2 text-sm truncate">
                <UserCircle className="w-5 h-5" /> {profile?.full_name || user?.email}
              </p>
              <p className="text-xs text-emerald-300 capitalize">{profile?.role}</p>
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