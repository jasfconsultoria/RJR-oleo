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
  Warehouse,
  ArrowDownSquare,
  ArrowUpSquare,
  ListChecks,
  Scale,
  Package,
  Tag,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  ClipboardCheck,
  MapPin,
  Route,
  Settings,
  Database,
  Bell,
  Box,
  ShieldCheck
} from 'lucide-react';

export const MENU_STRUCTURE = [
  { key: 'dashboard', to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', hasActions: false },
  {
    key: 'cadastro',
    label: 'Cadastro',
    icon: ClipboardList,
    hasActions: false,
    subItems: [
      { key: 'cadastro_clientes', to: '/app/cadastro/clientes', label: 'Clientes', icon: Users, hasActions: true },
      { key: 'cadastro_fornecedores', to: '/app/cadastro/fornecedores', label: 'Fornecedores', icon: Users, hasActions: true },
      { key: 'cadastro_contratos', to: '/app/cadastro/contratos', label: 'Contratos', icon: FileSignature, hasActions: true },
    ]
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    hasActions: false,
    subItems: [
      { key: 'financeiro_credito', to: '/app/financeiro/credito', label: 'Crédito', icon: TrendingUp, hasActions: true },
      { key: 'financeiro_debito', to: '/app/financeiro/debito', label: 'Débito', icon: TrendingDown, hasActions: true },
      { key: 'financeiro_recibos', to: '/app/financeiro/recibos', label: 'Recibos', icon: FileText, hasActions: true },
      { key: 'financeiro_centros_custo', to: '/app/centros-custo', label: 'Centro de Custos', icon: Tag, hasActions: true },
    ]
  },
  { key: 'agenda', to: '/app/agenda', label: 'Agenda', icon: Calendar, hasActions: true },
  {
    key: 'coletas',
    label: 'Coletas',
    icon: Truck,
    hasActions: false,
    subItems: [
      { key: 'coletas_lista', to: '/app/coletas', label: 'Lista de Coletas', icon: Truck, hasActions: true },
      { key: 'coletas_rotas', to: '/app/coletas/rotas', label: 'Rotas de Coletas', icon: Route, hasActions: true },
      { key: 'coletas_mapa', to: '/app/coletas/mapa', label: 'Mapa de Coletas', icon: MapPin, hasActions: false },
    ]
  },
  { key: 'recipientes', to: '/app/recipientes', label: 'Recipientes', icon: Box, hasActions: true },
  { key: 'certificados', to: '/app/certificados', icon: FileText, label: 'Certificados', hasActions: true },
  {
    key: 'relatorios',
    label: 'Relatórios',
    icon: BarChart2,
    hasActions: false,
    subItems: [
      { key: 'relatorios_coletas', to: '/app/relatorios/coletas', label: 'Coletas', icon: Truck, hasActions: false },
      { key: 'relatorios_financeiro', to: '/app/relatorios/financeiro', label: 'Financeiro', icon: DollarSign, hasActions: false },
      { key: 'relatorios_estoque', to: '/app/relatorios/estoque', label: 'Estoque', icon: Warehouse, hasActions: false },
      { key: 'relatorios_recipientes', to: '/app/relatorios/recipientes', label: 'Recipientes', icon: Box, hasActions: false },
      { key: 'relatorios_contratos', to: '/app/relatorios/contratos', label: 'Contratos', icon: FileSignature, hasActions: false },
    ]
  },
  {
    key: 'estoque',
    label: 'Estoque',
    icon: Warehouse,
    hasActions: false,
    subItems: [
      { key: 'estoque_produtos', to: '/app/estoque/produtos', label: 'Produtos', icon: Package, hasActions: true },
      { key: 'estoque_entradas', to: '/app/estoque/entradas', label: 'Entradas', icon: ArrowDownSquare, hasActions: true },
      { key: 'estoque_saidas', to: '/app/estoque/saidas', label: 'Saídas', icon: ArrowUpSquare, hasActions: true },
      { key: 'estoque_movimentacoes', to: '/app/estoque/movimentacoes', label: 'Movimentações', icon: ListChecks, hasActions: true },
      { key: 'estoque_saldo', to: '/app/estoque/saldo', label: 'Saldo Atual', icon: Scale, hasActions: false },
      { key: 'estoque_auditoria', to: '/app/relatorios/auditoria', label: 'Auditoria', icon: ClipboardCheck, hasActions: false },
    ]
  },
  {
    key: 'configuracoes',
    label: 'Configurações',
    icon: Settings,
    hasActions: false,
    subItems: [
      { key: 'configuracoes_empresa', to: '/app/empresa', label: 'Empresa', icon: Building, hasActions: true },
      { key: 'configuracoes_usuarios', to: '/app/usuarios', label: 'Usuários', icon: UserCog, hasActions: true },
      { key: 'configuracoes_permissoes', to: '/app/config/permissoes', label: 'Permissões', icon: ShieldCheck, hasActions: true },
      { key: 'configuracoes_notificacoes', to: '/app/config/notificacoes', label: 'Notificações', icon: Bell, hasActions: true },
      { key: 'configuracoes_ambientes', to: '/app/config/ambientes', label: 'Banco Dados', icon: Database, hasActions: false },
      { key: 'configuracoes_logs', to: '/app/logs', label: 'Logs', icon: BookText, hasActions: false },
    ]
  },
  { key: 'sobre', to: '/app/sobre', icon: Info, label: 'Sobre', hasActions: false },
  { key: 'versoes', to: '/app/versoes', icon: GitBranch, label: 'Versões', hasActions: false },
];
