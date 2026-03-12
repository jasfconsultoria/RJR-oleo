import { getOrCreateSupabaseClient } from './supabaseClientRegistry';
import { getActiveEnvironment, defaultClient } from './getActiveEnvironment';
import { SHARED_STORAGE_KEY, mainSupabaseUrl, mainSupabaseAnonKey } from './constants';

// Valores padrão (PRODUÇÃO)
export const supabaseUrl = mainSupabaseUrl;
export const supabaseAnonKey = mainSupabaseAnonKey;

let currentClient = null;
let currentUrl = null;
let currentKey = null;
let currentUserId = null;
let currentUserRole = null;

// ✅ Inicialização síncrona do cache (essencial para páginas públicas e refresh)
const CACHE_KEY = 'rjr_active_env';
const cachedEnv = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');

if (cachedEnv && cachedEnv.url && cachedEnv.anon_key) {
  const projectRef = cachedEnv.url.split('//')[1]?.split('.')[0] || 'default';
  const storageKey = `sb-${projectRef}-auth-token`;
  
  currentUrl = cachedEnv.url;
  currentKey = cachedEnv.anon_key;
  currentClient = getOrCreateSupabaseClient(currentUrl, currentKey, {
    auth: { storageKey }
  });
  console.log(`🚀 [Routing] Cliente RESTAURADO do cache local: ${currentUrl} (${cachedEnv.nome})`);
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
 * Obtém ou cria o cliente Supabase baseado no ambiente do usuário
 */
async function getSupabaseClient(forceRefresh = false) {
  const env = await getActiveEnvironment(forceRefresh, currentUserRole, currentUserId);

  if (!currentClient || currentUrl !== env.url || currentKey !== env.anon_key) {
    // 🛡️ Isolamento de Sessão: Cada projeto Supabase deve ter seu próprio token no localStorage
    // Isso evita o erro 401 (PGRST301 - JWT de outro projeto)
    const projectRef = env.url.split('//')[1]?.split('.')[0] || 'default';
    const storageKey = `sb-${projectRef}-auth-token`;

    currentClient = getOrCreateSupabaseClient(env.url, env.anon_key, {
      auth: {
        storageKey: storageKey,
      },
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
  'logs'
];

// RPCs que sempre devem rodar no banco "Main" (Produção)
const CONTROL_RPCS = [
  'get_my_profile_info',
  'get_all_users',
  'check_is_super_admin'
];

// Cliente padrão para inicialização ou fallback (Main DB)
const mainClient = getOrCreateSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: SHARED_STORAGE_KEY }
});

// Proxy para manter a interface 'supabase.from()', etc, funcionando de forma transparente e assíncrona (internamente)
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
        const resolvedClient = isControl ? mainClient : (currentClient || mainClient);
        return resolvedClient.from(tableName);
      };
    }

    // Se a propriedade for 'rpc', retornamos uma função que decide qual cliente usar
    if (prop === 'rpc') {
      return (rpcName, params) => {
        const isControl = CONTROL_RPCS.includes(rpcName);
        const resolvedClient = isControl ? mainClient : (currentClient || mainClient);
        return resolvedClient.rpc(rpcName, params);
      };
    }

    // Para outras propriedades (storage, functions, etc), usamos o cliente ativo ou principal
    const client = currentClient || mainClient;
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