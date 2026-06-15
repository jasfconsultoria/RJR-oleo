export function isMunicipioCode(val) {
  return val != null && val !== '' && !isNaN(val);
}

export function getMunicipioNomeFromDetails(details, code) {
  if (!details || code == null) return null;
  const entry = details[String(code)] ?? details[code];
  if (!entry) return null;
  return typeof entry === 'string' ? entry : entry.nome;
}

export function getMunicipioUfFromDetails(details, code) {
  if (!details || code == null) return null;
  const entry = details[String(code)] ?? details[code];
  if (!entry || typeof entry === 'string') return null;
  return entry.uf || null;
}

/**
 * Agrupa valores brutos de município por código IBGE canônico.
 * @param {Array<{municipio: string, estado?: string}>} rows
 * @param {Record<string, {nome: string, uf: string}>} detailsByCode
 * @param {Record<string, {codigo: string|number, municipio: string, uf: string}>} namesByText
 */
export function buildMunicipioFilterOptions(rows, detailsByCode = {}, namesByText = {}) {
  const canonical = new Map();

  for (const row of rows) {
    const raw = row.municipio;
    if (!raw) continue;

    let code;
    let nome;
    let uf = row.estado || '';
    const legacyValues = [];

    if (isMunicipioCode(raw)) {
      code = String(raw);
      const details = detailsByCode[code] ?? detailsByCode[Number(code)];
      nome = details?.nome || code;
      uf = uf || details?.uf || '';
    } else {
      const lookupKey = String(raw).trim().toLowerCase();
      const resolved = namesByText[lookupKey] ?? namesByText[raw];
      if (resolved) {
        code = String(resolved.codigo);
        nome = resolved.municipio;
        uf = uf || resolved.uf || '';
        legacyValues.push(raw);
      } else {
        code = raw;
        nome = raw;
      }
    }

    const key = `${code}|${uf}`;
    if (canonical.has(key)) {
      const existing = canonical.get(key);
      if (String(raw) !== code && !existing.filterValues.includes(String(raw))) {
        existing.filterValues.push(String(raw));
      }
    } else {
      canonical.set(key, {
        value: code,
        label: uf ? `${nome} - ${uf}` : nome,
        estado: uf,
        nome,
        filterValues: [code, ...legacyValues],
      });
    }
  }

  return Array.from(canonical.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function applyMunicipioFilter(query, filtroMunicipio, municipiosFiltro) {
  if (!filtroMunicipio || filtroMunicipio === 'todos') return query;

  const selected = municipiosFiltro.find((m) => m.value === filtroMunicipio);
  const values = selected?.filterValues?.length
    ? [...new Set(selected.filterValues)]
    : [filtroMunicipio];

  if (values.length === 1) {
    return query.eq('municipio', values[0]);
  }
  return query.in('municipio', values);
}

export function resolveCanonicalMunicipioKey(row, detailsByCode = {}, namesByText = {}) {
  const raw = row.municipio;
  if (!raw) return 'nao_informado';

  let code;
  let uf = row.estado || '';

  if (isMunicipioCode(raw)) {
    code = String(raw);
    uf = uf || getMunicipioUfFromDetails(detailsByCode, code) || '';
  } else {
    const lookupKey = String(raw).trim().toLowerCase();
    const resolved = namesByText[lookupKey] ?? namesByText[raw];
    if (resolved) {
      code = String(resolved.codigo);
      uf = uf || resolved.uf || '';
    } else {
      return `${raw}|${uf}`;
    }
  }

  return `${code}|${uf}`;
}

export function matchesMunicipioFilter(municipio, filterCode, namesByText = {}) {
  if (municipio == null || filterCode == null || filterCode === 'todos') return true;
  if (String(municipio) === String(filterCode)) return true;
  if (!isMunicipioCode(municipio)) {
    const resolved = namesByText[String(municipio).trim().toLowerCase()] ?? namesByText[municipio];
    if (resolved && String(resolved.codigo) === String(filterCode)) return true;
  }
  return false;
}

export function aggregateColetasByMunicipio(coletas, detailsByCode = {}, namesByText = {}, municipioEstadoMap = {}) {
  const municipioMap = {};

  for (const coleta of coletas) {
    const key = resolveCanonicalMunicipioKey(coleta, detailsByCode, namesByText);
    const raw = coleta.municipio || 'Não informado';
    const estado = coleta.estado || municipioEstadoMap[raw] || getMunicipioUfFromDetails(detailsByCode, raw) || 'Estado não identificado';

    let nome;
    if (isMunicipioCode(raw)) {
      nome = getMunicipioNomeFromDetails(detailsByCode, raw) || raw;
    } else {
      const lookupKey = String(raw).trim().toLowerCase();
      const resolved = namesByText[lookupKey] ?? namesByText[raw];
      nome = resolved?.municipio || raw;
    }

    if (!municipioMap[key]) {
      municipioMap[key] = { coletas: 0, massa: 0, estado, nome };
    }
    municipioMap[key].coletas += 1;
    municipioMap[key].massa += parseFloat(coleta.quantidade_coletada) || 0;
  }

  return Object.values(municipioMap)
    .map((dados) => ({
      local: `${dados.nome} - ${dados.estado}`,
      coletas: dados.coletas,
      massa: parseFloat(dados.massa.toFixed(2)),
    }))
    .sort((a, b) => b.coletas - a.coletas)
    .slice(0, 10);
}
