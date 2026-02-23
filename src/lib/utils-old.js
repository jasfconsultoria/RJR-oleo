import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { utcToZonedTime } from 'date-fns-tz';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function parseCurrency(value) {
  if (typeof value !== 'string') {
    return parseFloat(value) || 0;
  }
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function formatCnpjCpf(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
}

export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  const defaultOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  };
  return new Intl.NumberFormat('pt-BR', defaultOptions).format(value);
}

export function unmask(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\D/g, '');
}

export function validateCnpjCpf(value) {
  const cleaned = unmask(value);
  if (cleaned.length === 11) {
    return validateCpf(cleaned);
  }
  if (cleaned.length === 14) {
    return validateCnpj(cleaned);
  }
  return false;
}

function validateCpf(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

function validateCnpj(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  let digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(0))) return false;
  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result !== parseInt(digits.charAt(1))) return false;
  return true;
}

export function formatToISODate(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    const parsedDate = parseISO(date);
    return isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : null;
  }
  return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
}

export function formatDateWithTimezone(dateInput, timezone = 'America/Sao_Paulo') {
  if (!dateInput) return 'N/A';

  let dateObject;
  if (dateInput instanceof Date) {
    dateObject = dateInput;
  } else if (typeof dateInput === 'string') {
    const parsedDate = parseISO(dateInput);
    if (!isValid(parsedDate)) {
      console.error("Invalid date string provided to formatDateWithTimezone:", dateInput);
      return 'Data inválida';
    }
    dateObject = parsedDate;
  } else {
    console.error("Unexpected dateInput type to formatDateWithTimezone:", typeof dateInput, dateInput);
    return 'Data inválida';
  }

  try {
    const zonedDate = utcToZonedTime(dateObject, timezone);
    return format(zonedDate, 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    console.error("Error formatting date with timezone:", e, dateInput, timezone);
    return 'Data inválida';
  }
}

export function getMonthsDifference(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 0;
  const d1 = dateFrom instanceof Date ? dateFrom : parseISO(dateFrom);
  const d2 = dateTo instanceof Date ? dateTo : parseISO(dateTo);
  if (!isValid(d1) || !isValid(d2)) return 0;
  return differenceInMonths(d2, d1);
}

// Helper function to convert numbers to Portuguese words (for internal use by valorPorExtenso)
const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];

function _numeroParaExtenso(num) {
  if (num === 0) return ''; // Return empty for zero when used as part of a larger number
  if (num < 0) return 'menos ' + _numeroParaExtenso(Math.abs(num));

  let s = String(num);
  let extenso = [];

  function converterGrupo(n) {
    let str = '';
    let c = Math.floor(n / 100);
    let d = Math.floor((n % 100) / 10);
    let u = n % 10;

    if (c > 0) {
      str += (c === 1 && (d > 0 || u > 0)) ? 'cento e ' : centenas[c] + ' ';
    }

    if (d > 1) {
      str += dezenas[d] + (u > 0 ? ' e ' : '');
    } else if (d === 1) {
      str += especiais[u] + ' ';
      return str.trim();
    }

    if (u > 0 && d !== 1) {
      str += unidades[u] + ' ';
    }
    return str.trim();
  }

  let grupos = [];
  while (s.length > 0) {
    grupos.unshift(parseInt(s.slice(-3)));
    s = s.slice(0, -3);
  }

  const sufixos = ['', 'mil', 'milhões', 'bilhões', 'trilhões'];

  for (let i = 0; i < grupos.length; i++) {
    let grupo = grupos[grupos.length - 1 - i];
    if (grupo === 0) continue;

    let parte = converterGrupo(grupo);
    let sufixo = sufixos[i];

    if (i === 1 && grupo === 1) { // "mil" singular
      extenso.unshift('mil');
    } else if (i > 1 && grupo > 1) { // "milhões", "bilhões" plural
      extenso.unshift(sufixo);
      extenso.unshift(parte);
    } else if (i > 1 && grupo === 1) { // "um milhão", "um bilhão"
      extenso.unshift(sufixo.slice(0, -1)); // remove 's'
      extenso.unshift('um');
    } else {
      extenso.unshift(sufixo);
      extenso.unshift(parte);
    }
  }

  return extenso.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function valorPorExtenso(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'zero reais';
  }

  const partes = valor.toFixed(2).split('.');
  const reais = parseInt(partes[0], 10);
  const centavos = parseInt(partes[1], 10);

  let extenso = [];

  if (reais > 0) {
    extenso.push(_numeroParaExtenso(reais));
    extenso.push(reais === 1 ? 'real' : 'reais');
  }

  if (centavos > 0) {
    if (reais > 0) {
      extenso.push('e');
    }
    extenso.push(_numeroParaExtenso(centavos));
    extenso.push(centavos === 1 ? 'centavo' : 'centavos');
  }

  if (reais === 0 && centavos === 0) {
    return 'zero reais';
  }

  return extenso.filter(Boolean).join(' ').trim();
}

export function escapePostgrestLikePattern(pattern) {
  // Escapa caracteres que têm significado especial em padrões LIKE do SQL: %, _, \
  // Também escapa $ se estiver causando problemas no parser de filtros do PostgREST.
  // A substituição usa '\\$&' para inserir uma barra invertida antes do caractere correspondente.
  return pattern.replace(/[%_\\$]/g, '\\$&');
}