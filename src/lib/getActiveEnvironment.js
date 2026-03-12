import { createClient } from '@supabase/supabase-js';
import { getOrCreateSupabaseClient } from './supabaseClientRegistry';
import { isDevelopment } from './envUtils';
import { SHARED_STORAGE_KEY, mainSupabaseUrl, mainSupabaseAnonKey, homologSupabaseUrl as hUrl, homologSupabaseAnonKey as hKey } from './constants';

export const homologSupabaseUrl = hUrl;
export const homologSupabaseAnonKey = hKey;


// Cliente padrão para buscar o ambiente ativo (usa o banco padrão - PRODUÇÃO)
export const defaultSupabaseUrl = mainSupabaseUrl;
export const defaultSupabaseAnonKey = mainSupabaseAnonKey;

// ✅ Usar storage key única baseada no projeto para evitar conflitos de JWT entre ambientes
export const defaultClient = getOrCreateSupabaseClient(mainSupabaseUrl, mainSupabaseAnonKey, {
  auth: {
    storageKey: SHARED_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const homologClient = getOrCreateSupabaseClient(homologSupabaseUrl, homologSupabaseAnonKey, {
  auth: {
    storageKey: `sb-${homologSupabaseUrl.split('//')[1]?.split('.')[0] || 'homolog'}-auth-token`,
  },
});

// Cache em memória e persistência
const CACHE_KEY = 'rjr_active_env';
let memoryCache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
let memoryCacheTime = memoryCache ? Date.now() : 0;
const MEMORY_CACHE_DURATION = 1000 * 60 * 5; // 5 minutos para cache persistente

/**
 * Busca o ambiente ativo do banco de dados para o usuário
 */
export async function getActiveEnvironment(forceRefresh = false, userRole = null, userId = null, emitenteId = null, dbEnvironmentId = null) {
  const now = Date.now();
  
  if (!forceRefresh && memoryCache && (now - memoryCacheTime < MEMORY_CACHE_DURATION)) {
    return memoryCache;
  }

  try {
    // Se não houver userId, tenta retornar o cache ou Produção como fallback
    if (!userId) {
      if (memoryCache) return memoryCache;
      
      const result = {
        url: defaultSupabaseUrl,
        anon_key: defaultSupabaseAnonKey,
        nome: 'Produção',
        tipo: 'producao',
      };
      return result;
    }

    // Buscar preferência na tabela user_db_preferences no banco de controle (Produção)
    const { data: userPreference, error } = await defaultClient
      .from('user_db_preferences')
      .select('url, anon_key, nome, tipo')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar preferência de banco:', error);
    }

    let result;
    if (userPreference && userPreference.url && userPreference.anon_key) {
      result = {
        url: userPreference.url,
        anon_key: userPreference.anon_key,
        nome: userPreference.nome,
        tipo: userPreference.tipo,
      };
    } else {
      // Fallback para Produção
      result = {
        url: defaultSupabaseUrl,
        anon_key: defaultSupabaseAnonKey,
        nome: 'Produção',
        tipo: 'producao',
      };
    }

    memoryCache = result;
    memoryCacheTime = now;
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('Erro inesperado em getActiveEnvironment:', err);
    return memoryCache || {
      url: defaultSupabaseUrl,
      anon_key: defaultSupabaseAnonKey,
      nome: 'Produção (Fallback)',
      tipo: 'producao',
    };
  }
}

/**
 * Limpa o cache do ambiente ativo
 */
export function clearActiveEnvironmentCache() {
  memoryCache = null;
  memoryCacheTime = 0;
}

/**
 * Força uma atualização do ambiente ativo
 */
export async function refreshActiveEnvironment() {
  clearActiveEnvironmentCache();
  return await getActiveEnvironment(true);
}
