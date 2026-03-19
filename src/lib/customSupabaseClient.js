import { getOrCreateSupabaseClient } from './supabaseClientRegistry';
import { getActiveEnvironment } from './getActiveEnvironment';
import { SHARED_STORAGE_KEY, mainSupabaseUrl, mainSupabaseAnonKey } from './constants';

/**
 * Cliente customizado que gerencia o roteamento entre bancos (Produção/Homologação)
 * de forma transparente para o restante da aplicação.
 */

// Cliente principal (PRODUÇÃO) - usado para o Auth e Tabelas de Controle
const mainClient = getOrCreateSupabaseClient(mainSupabaseUrl, mainSupabaseAnonKey, {
  auth: { 
    storageKey: SHARED_STORAGE_KEY,
    persistSession: true
  }
});

let currentClient = null;
let currentUrl = null;
let currentKey = null;
let currentUserId = null;
let currentUserRole = null;
let lastKnownSession = null;

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
    const isMain = currentUrl === mainSupabaseUrl;
    currentClient = getOrCreateSupabaseClient(currentUrl, currentKey, {
      auth: isMain ? { storageKey: SHARED_STORAGE_KEY } : { persistSession: false }
    });
    console.log(`📡 [Routing] Cliente restaurado sob demanda para: ${currentUrl}`);
    
    // 📡 REMOVIDO: syncSession(currentClient). 
    // Não chamamos setSession em clientes secundários para evitar erros 403 do Auth API.
    // O Custom Fetch agora garante o token no banco de dados de forma transparente.
    
    return currentClient;
  }
  
  // 4. Se não há nada no cache e não é controle, retornamos o mainClient como último recurso
  return mainClient;
}

/**
 * Sincroniza a sessão do mainClient para o currentClient (se for diferente)
 */
/**
 * Sincroniza a sessão do mainClient para o currentClient (se for diferente)
 */
// Função depreciada/removida para evitar erros 403 em ambientes secundários
async function syncSession(targetClient) {
  // Relying solely on customFetch token injection
}

/**
 * Define os dados do usuário atual e força a atualização do cliente
 */
export async function setAndRefreshRoutingContext(userId, role) {
  setRoutingContext(userId, role);
  const client = await refreshSupabaseClient();
  await syncSession(client);
  return client;
}

/**
 * Define os dados do usuário atual para roteamento
 */
export function setRoutingContext(userId, role) {
  currentUserId = userId;
  currentUserRole = role;
}

// 🛡️ Adaptive SSO: Conjunto de URLs que falharam na decodificação do JWT (PGRST301)
const ssoIncompatibleUrls = new Set();

/**
 * Obtém ou cria o cliente Supabase baseado no ambiente do usuário (Async)
 */
async function getSupabaseClient(forceRefresh = false) {
  const env = await getActiveEnvironment(forceRefresh, currentUserRole, currentUserId);

  if (!currentClient || currentUrl !== env.url || currentKey !== env.anon_key) {
    const isMain = env.url === mainSupabaseUrl;

    // 🛡️ CUSTOM FETCH: Garante que o Token da Produção seja enviado para Homologação
    // mas com inteligência para fallback se os segredos JWT não baterem.
    const customFetch = async (url, options = {}) => {
      const targetUrl = new URL(url).origin;
      const isTryingMain = targetUrl === mainSupabaseUrl;

      // Se o ambiente ainda não foi marcado como incompatível, tentamos o token de Produção
      if (!isMain && !isTryingMain && !ssoIncompatibleUrls.has(targetUrl)) {
        const headers = new Headers(options.headers || {});
        
        if (lastKnownSession?.access_token) {
          headers.set('Authorization', `Bearer ${lastKnownSession.access_token}`);
        }
        
        options.headers = headers;
      } 
      // Se JÁ sabemos que é incompatível MAS o usuário está logado (na Prod), usamos a Ponte de Bypass
      else if (!isMain && !isTryingMain && ssoIncompatibleUrls.has(targetUrl) && lastKnownSession) {
        const headers = new Headers(options.headers || {});
        // 🌉 Injetamos o header de bypass que o banco passará a confiar após o SQL
        headers.set('x-admin-bypass', 'rjr_bridge_secure_bypass_2024');
        options.headers = headers;
      }

      try {
        const response = await fetch(url, options);
        
        // Se recebermos erro de decodificação de JWT ou RLS, tentamos detectar a causa
        if (response.status === 401 || response.status === 403) {
          const clone = response.clone();
          try {
            const error = await clone.json();
            // PGRST301 = Erro de Segredo JWT inválido
            if (error.code === 'PGRST301' || error.message?.includes('decode the JWT')) {
              if (!ssoIncompatibleUrls.has(targetUrl)) {
                console.warn(`⚠️ [SSO] Ambiente ${targetUrl} incompatível com Token de Produção. Ativando Modo de Bypass via Header.`);
                ssoIncompatibleUrls.add(targetUrl);
                // Retentamos a mesma chamada já com o bypass aplicado? 
                // Para não complicar o fetch recursivo, deixamos o usuário tentar de novo ou o próximo fetch automático já usará o bypass.
              }
            }
          } catch (e) {
            // Não é um JSON, ignora
          }
        }
        
        return response;
      } catch (err) {
        throw err;
      }
    };

    currentClient = getOrCreateSupabaseClient(env.url, env.anon_key, {
      auth: isMain ? { storageKey: SHARED_STORAGE_KEY } : { persistSession: false },
      global: { fetch: customFetch }
    });
    
    currentUrl = env.url;
    currentKey = env.anon_key;

    // Não chamamos syncSession aqui para evitar o Auth API secundário
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
        // console.log(`📡 [Proxy:from] Tabela: ${tableName} -> ${source}`);
        
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
async function initSession() {
  const { data: { session } } = await mainClient.auth.getSession();
  lastKnownSession = session;
  getSupabaseClient();
}
initSession();

// Ouvir mudanças de autenticação no banco principal e refletir no ativo
mainClient.auth.onAuthStateChange(async (event, session) => {
  lastKnownSession = session;
  
  // Só sincronizamos se for o mainClient (onde o auth realmente reside)
  // Para os outros, o customFetch cuida do token dinamicamente
  // Não é necessário chamar setSession/signOut em clientes secundários,
  // pois o customFetch já injeta o token do lastKnownSession.
  // O mainClient já é o dono do evento e gerencia sua própria sessão.
});