/** Tamanho máximo de página imposto pelo PostgREST/Supabase por requisição. */
export const SUPABASE_MAX_PAGE_SIZE = 1000;

const PAGINATION_BLOCKING_METHODS = new Set([
  'range',
  'limit',
  'single',
  'maybeSingle',
]);

/**
 * Busca todas as linhas de uma consulta, paginando automaticamente além do limite de 1000 do PostgREST.
 *
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 *   Função que retorna a query já com .select() e filtros aplicados (sem .range/.limit).
 * @param {{ pageSize?: number, order?: { column: string, ascending?: boolean } }} [options]
 * @returns {Promise<any[]>}
 */
export async function fetchAllRows(buildQuery, options = {}) {
  const pageSize = options.pageSize ?? SUPABASE_MAX_PAGE_SIZE;
  const allRows = [];
  let from = 0;

  while (true) {
    let query = buildQuery();

    if (options.order) {
      query = query.order(options.order.column, {
        ascending: options.order.ascending ?? true,
      });
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const batch = data ?? [];
    allRows.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

/**
 * Executa uma query GET paginando automaticamente quando não há .range/.limit/.single.
 */
async function autoPaginateSelect(builder) {
  const pageSize = SUPABASE_MAX_PAGE_SIZE;
  const allRows = [];
  let from = 0;

  while (true) {
    const { data, error, count, status, statusText } = await builder.range(
      from,
      from + pageSize - 1
    );

    if (error) {
      return { data: null, error, count: null, status, statusText };
    }

    const batch = data ?? [];
    allRows.push(...batch);

    if (batch.length < pageSize) {
      return {
        data: allRows,
        error: null,
        count: allRows.length,
        status: status ?? 200,
        statusText: statusText ?? 'OK',
      };
    }

    from += pageSize;
  }
}

function shouldAutoPaginate(builder, blockPagination) {
  if (blockPagination) return false;
  if (builder.method && builder.method !== 'GET') return false;
  if (builder.isHead) return false;
  return true;
}

/**
 * Envolve um PostgrestFilterBuilder para buscar todos os registros automaticamente
 * quando a query é aguardada sem .range(), .limit() ou .single().
 */
export function wrapQueryForFullFetch(builder) {
  return createQueryProxy(builder, false);
}

function createQueryProxy(target, blockPagination) {
  if (!target || typeof target !== 'object') return target;

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'then') {
        return (onFulfilled, onRejected) => {
          if (!shouldAutoPaginate(obj, blockPagination)) {
            return Reflect.get(obj, prop, receiver).call(obj, onFulfilled, onRejected);
          }

          return autoPaginateSelect(obj).then(onFulfilled, onRejected);
        };
      }

      const value = Reflect.get(obj, prop, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      return (...args) => {
        const result = value.apply(obj, args);
        const blocksPagination = blockPagination || PAGINATION_BLOCKING_METHODS.has(prop);

        if (result && typeof result === 'object' && result !== obj) {
          return createQueryProxy(result, blocksPagination);
        }

        return result;
      };
    },
  });
}
