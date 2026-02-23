import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, differenceInMonths, startOfMonth, endOfMonth } from 'date-fns';
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

export function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const numValue = typeof value === 'number' ? value : parseCurrency(value);
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
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

export function formatDate(date, includeTime = false) {
  if (!date) return 'N/A';
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(parsedDate)) return 'Data inválida';
    return format(parsedDate, includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    console.error("Error formatting date:", e, date);
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

/**
 * Retorna a data/hora atual no fuso horário especificado.
 * @param {string} timezone Fuso horário (ex: 'America/Sao_Paulo')
 * @returns {Date} data objeto Date em UTC recalibrado para o fuso
 */
export function getZonedNow(timezone = 'America/Sao_Paulo') {
  return utcToZonedTime(new Date(), timezone);
}

/**
 * Retorna o primeiro dia do mês atual no fuso horário da empresa.
 * @param {string} timezone 
 * @returns {Date}
 */
export function getZonedStartOfMonth(timezone = 'America/Sao_Paulo') {
  const now = getZonedNow(timezone);
  return startOfMonth(now);
}

/**
 * Retorna o último dia do mês atual no fuso horário da empresa.
 * @param {string} timezone 
 * @returns {Date}
 */
export function getZonedEndOfMonth(timezone = 'America/Sao_Paulo') {
  const now = getZonedNow(timezone);
  return endOfMonth(now);
}

// Função auxiliar para converter números para extenso
function converterNumero(num) {
  if (num === 0) return 'zero';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];

  if (num < 10) return unidades[num];
  if (num < 20) return especiais[num - 10];
  if (num < 100) {
    const d = Math.floor(num / 10);
    const u = num % 10;
    return dezenas[d] + (u > 0 ? ' e ' + unidades[u] : '');
  }

  // Para números maiores (simplificado)
  if (num < 1000) {
    const c = Math.floor(num / 100);
    const resto = num % 100;
    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (c === 1 && resto > 0) return 'cento e ' + converterNumero(resto);
    return centenas[c] + (resto > 0 ? ' e ' + converterNumero(resto) : '');
  }

  return num.toString();
}

// FUNÇÃO CORRIGIDA - valorPorExtenso
export function valorPorExtenso(valor) {
  if (valor === null || valor === undefined || isNaN(valor) || valor === 0) {
    return "zero real";
  }

  // Garantir que é número
  const valorNumerico = typeof valor === 'string' ?
    parseFloat(valor.replace(/\./g, '').replace(',', '.')) :
    valor;

  const inteiro = Math.floor(valorNumerico);
  const centavos = Math.round((valorNumerico - inteiro) * 100);

  let extenso = '';

  // Parte inteira (reais)
  if (inteiro > 0) {
    if (inteiro === 1) {
      extenso = 'um real';
    } else {
      extenso = converterNumero(inteiro) + ' reais';
    }
  }

  // Centavos
  if (centavos > 0) {
    if (extenso) extenso += ' e ';
    if (centavos === 1) {
      extenso += 'um centavo';
    } else {
      extenso += converterNumero(centavos) + ' centavos';
    }
  }

  return extenso;
}

export function escapePostgrestLikePattern(pattern) {
  return pattern.replace(/[%_\\$]/g, '\\$&');
}