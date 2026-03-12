/**
 * Utilitários para detecção de ambiente e roles
 */

/**
 * Verifica se está rodando em desenvolvimento (localhost)
 * @returns {boolean}
 */
export function isDevelopment() {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname === '[::1]' ||
         hostname.startsWith('192.168.') ||
         hostname.startsWith('10.') ||
         hostname.startsWith('172.');
}

/**
 * Verifica se está em produção
 * @returns {boolean}
 */
export function isProduction() {
  if (typeof window === 'undefined') return true;
  
  return import.meta.env.PROD;
}

/**
 * Verifica se o usuário é Super Admin
 * @param {string} role - Role do usuário
 * @returns {boolean}
 */
export function isSuperAdmin(role) {
  if (!role) return false;
  const roleLower = String(role).toLowerCase().trim();
  return roleLower === 'super_admin' || 
         roleLower === 'superadmin' || 
         roleLower === 'super administrador' ||
         roleLower === 'super admin';
}
