import { getOrCreateSupabaseClient } from './supabaseClientRegistry';
import { getActiveEnvironment } from './getActiveEnvironment';
import { SHARED_STORAGE_KEY, mainSupabaseUrl, mainSupabaseAnonKey } from './constants';

/**
 * Cliente customizado que gerencia o roteamento entre bancos (Produção/Homologação)
 * de forma transparente para o restante da aplicação.
 */

// Cliente principal (PRODUÇÃO) - usado para o Auth e Tabelas de Controle
const mainClient = getOrCreateSupabaseClient(mainSupabaseUrl, mainSupabaseAnonKey, {
  auth: { storageKey: SHARED_STORAGE_KEY }
});

let currentClient = null;
let currentUrl = null;
let currentKey = null;
let currentUserId = null;
let currentUserRole = null;

// Valores exportados para compatibilidade (apontam para o principal)
export const supabaseUrl = mainSupabaseUrl;
export const supabaseAnonKey = mainSupabaseAnonKey;

/**
 * Retorna o cliente que deve ser usado para uma determinada operação (tabela ou RPC)
 */
function resolveClient(isControl) {
  // 1. Tabelas de Controle (Auth/Profiles/Empresa) devem SEMPRE usar o banco principal
  if (isControl) return mainClient;
  
  // 2. Se já temos o cliente de ambiente carregado em memória, usamos ele
  if (currentClient) return currentClient;
  
  // 3. Se não está em memória mas temos o cache no localStorage, inicializamos síncrono agora
  const CACHE_KEY = 'rjr_active_env';
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (cached && cached.url && cached.anon_key) {
    currentUrl = cached.url;
    currentKey = cached.anon_key;
    currentClient = getOrCreateSupabaseClient(currentUrl, currentKey, {
      auth: { storageKey: SHARED_STORAGE_KEY }
    });
    console.log(`📡 [Routing] Cliente restaurado sob demanda para: ${currentUrl}`);
    return currentClient;
  }
  
  // 4. Se não há nada no cache e não é controle, retornamos o mainClient como último recurso
  return mainClient;
}

/**
 * Define os dados do usuário atual e força a atualização do cliente
 */
export async function setAndRefreshRoutingContext(userId, role) {
  setRoutingContext(userId, role);
  return await refreshSupabaseClient();
}

/**
 * Define os dados do usuário atual para roteamento
 */
export function setRoutingContext(userId, role) {
  currentUserId = userId;
  currentUserRole = role;
}

/**
 * Obtém ou cria o cliente Supabase baseado no ambiente do usuário (Async)
 */
async function getSupabaseClient(forceRefresh = false) {
  const env = await getActiveEnvironment(forceRefresh, currentUserRole, currentUserId);

  if (!currentClient || currentUrl !== env.url || currentKey !== env.anon_key) {
    currentClient = getOrCreateSupabaseClient(env.url, env.anon_key, {
      auth: { storageKey: SHARED_STORAGE_KEY },
    });
    currentUrl = env.url;
    currentKey = env.anon_key;
  }

  return currentClient;
}

// Tabelas que sempre residem no banco "Main" (Produção)
const CONTROL_TABLES = [
  'profiles',
  'user_db_preferences',
  'db_environments',
  'empresa',
  'logs',
  'conta_corrente',
  'conta_usuario'
];

// RPCs que sempre devem rodar no banco "Main" (Produção)
const CONTROL_RPCS = [
  'get_my_profile_info',
  'get_all_users',
  'check_is_super_admin'
];

// Proxy para manter a interface 'supabase.from()', etc, funcionando de forma transparente
export const supabase = new Proxy({}, {
  get(target, prop) {
    // 💡 IMPORTANTE: Auth deve ser SEMPRE do cliente principal para manter a sessão estável e única
    if (prop === 'auth') {
      return mainClient.auth;
    }

    // Se a propriedade for 'from', retornamos uma função que decide qual cliente usar
    if (prop === 'from') {
      return (tableName) => {
        const isControl = CONTROL_TABLES.includes(tableName);
        const resolvedClient = resolveClient(isControl);
        
        const source = isControl ? 'Controle (Main)' : (resolvedClient === mainClient ? 'Fallback (Main)' : 'Ambiente Ativo');
        console.log(`📡 [Proxy:from] Tabela: ${tableName} -> ${source}`);
        
        return resolvedClient.from(tableName);
      };
    }

    // Se a propriedade for 'rpc', retornamos uma função que decide qual cliente usar
    if (prop === 'rpc') {
      return (rpcName, params) => {
        const isControl = CONTROL_RPCS.includes(rpcName);
        const resolvedClient = resolveClient(isControl);
        
        const source = isControl ? 'Controle (Main)' : (resolvedClient === mainClient ? 'Fallback (Main)' : 'Ambiente Ativo');
        console.log(`📡 [Proxy:rpc] RPC: ${rpcName} -> ${source}`);
        
        return resolvedClient.rpc(rpcName, params);
      };
    }

    // Para outras propriedades (storage, functions, etc), usamos o cliente ativo ou principal
    const client = resolveClient(false);
    if (typeof client[prop] === 'function') {
      return client[prop].bind(client);
    }
    return client[prop];
  }
});

/**
 * Força a atualização do cliente Supabase (ex: após mudar preferência)
 */
export async function refreshSupabaseClient() {
  clearActiveClient();
  return await getSupabaseClient(true);
}

function clearActiveClient() {
  currentClient = null;
  currentUrl = null;
  currentKey = null;
}

// Inicializar cliente ao carregar (background)
getSupabaseClient();