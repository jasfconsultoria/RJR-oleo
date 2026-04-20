import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Info, AlertTriangle, FileText, DollarSign, Truck } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const NotificationsPopover = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    // Buscar global ou específicas não lidas e as 10 últimas lidas (exibir no popup só pra ter listagem legal)
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }, [user]);

  // Subscribe aos inserts para este usuário para notificação push top-bar em tempo real se possível/permitido.
  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();
    
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${user.id}` },
        payload => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Adiciona listener para update forçado pós RPC diária
    const handleLocalUpdate = () => fetchNotifications();
    window.addEventListener('notificacoes_atualizadas', handleLocalUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notificacoes_atualizadas', handleLocalUpdate);
    };
  }, [user, fetchNotifications]);

  const markAllAsRead = async () => {
    if (unreadCount === 0 || !user) return;

    // Atualiza status pra todo mundo daquele usuario id
    await supabase.from('notificacoes')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read && user) {
       await supabase.from('notificacoes').update({ is_read: true }).eq('id', notification.id);
       setNotifications(prev => prev.map(n => n.id === notification.id ? {...n, is_read: true} : n));
       setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case 'coleta': return <Truck className="h-4 w-4 text-emerald-400" />;
      case 'financeiro': return <DollarSign className="h-4 w-4 text-red-400" />;
      case 'contrato': return <FileText className="h-4 w-4 text-yellow-400" />;
      default: return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 rounded-xl">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 inline-flex items-center justify-center -translate-y-1/2 translate-x-1/2 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform bg-red-600 rounded-full border-2 border-emerald-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 bg-emerald-950 border-emerald-800 text-white shadow-xl rounded-xl mr-4 mt-2" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/60 bg-emerald-900/50 rounded-t-xl">
          <span className="font-semibold text-sm text-emerald-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" /> Notificações
          </span>
          {unreadCount > 0 && (
            <Button 
               variant="ghost" 
               size="sm" 
               onClick={markAllAsRead}
               className="h-auto p-1 px-2 text-[10px] bg-emerald-800/50 hover:bg-emerald-700 hover:text-white text-emerald-300 rounded-lg"
            >
              <Check className="w-3 h-3 mr-1" />
              Ler Tudo
            </Button>
          )}
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-emerald-400/60 text-xs">
              <Bell className="w-8 h-8 opacity-20 mx-auto mb-2" />
              Nenhuma notificação encontrada.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 border-b border-emerald-800/30 flex gap-3 cursor-pointer transition-colors
                    ${!notif.is_read ? 'bg-emerald-900/30 hover:bg-emerald-800/40' : 'opacity-70 hover:bg-emerald-900/20'}`}
                >
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm
                    ${!notif.is_read ? 'bg-emerald-800' : 'bg-emerald-900/50'}`}>
                    {getIcon(notif.tipo)}
                  </div>
                  <div className="space-y-1 pr-2 flex-1">
                    <p className={`text-xs font-semibold leading-tight ${!notif.is_read ? 'text-white' : 'text-emerald-200/90'}`}>
                      {notif.titulo}
                    </p>
                    <p className="text-[11px] text-emerald-300/70 leading-relaxed max-w-[220px]">
                      {notif.mensagem}
                    </p>
                    <p className="text-[9px] text-emerald-500/80 pt-1 flex justify-between">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                      {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-emerald-800/60 bg-emerald-900/20 rounded-b-xl text-center">
            {user?.role === 'super_admin' ? (
                <button 
                  onClick={() => { setIsOpen(false); navigate('/app/config/notificacoes'); }}
                  className="w-full text-xs text-emerald-400 hover:text-emerald-300 py-1 transition-colors font-medium">
                  Configurações de Notificação
                </button>
            ) : (
                <span className="text-[10px] text-emerald-500/50 font-medium">Você está atualizado.</span>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;
