import { createClient } from '@supabase/supabase-js';

// Cache global de instâncias do SupabaseClient para evitar o aviso "Multiple GoTrueClient instances"
// e garantir consistência na gestão de sessões.
const clientsCache = new Map();

/**
 * Cria ou retorna uma instância cacheada do SupabaseClient.
 * @param {string} supabaseUrl - URL do projeto Supabase
 * @param {string} supabaseKey - Chave (Anon ou Service Role)
 * @param {Object} options - Opções passadas para createClient
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getOrCreateSupabaseClient(supabaseUrl, supabaseKey, options = {}) {
    // 🛡️ Singleton estrito por URL: Ignora storageKey no cache para evitar múltiplas instâncias
    const cacheKey = supabaseUrl;

    if (clientsCache.has(cacheKey)) {
        return clientsCache.get(cacheKey);
    }

    const client = createClient(supabaseUrl, supabaseKey, options);
    clientsCache.set(cacheKey, client);

    return client;
}
