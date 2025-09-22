import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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

export function unmask(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

export function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCurrency(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 'R$ 0,00';
  const num = parseCurrency(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function formatNumber(value, options = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') return '0';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: options.minimumFractionDigits || 2,
    maximumFractionDigits: options.maximumFractionDigits || 2,
  }).format(num);
}

export function formatToISODate(date) {
  if (!date) return ''; // Handle null/undefined dates
  // Ensure date is a valid Date object before formatting
  if (!(date instanceof Date) || !isValid(date)) {
    console.warn("formatToISODate received an invalid date object:", date);
    return ''; // Return empty string for invalid dates
  }
  return format(date, 'yyyy-MM-dd');
}

export function formatDateWithTimezone(dateInput, timezone = 'America/Sao_Paulo') {
  if (!dateInput) return 'N/A';

  let baseDate;
  if (dateInput instanceof Date) {
    baseDate = dateInput;
  } else if (typeof dateInput === 'string') {
    const parsedDate = parseISO(dateInput);
    if (!isValid(parsedDate)) {
      console.error("formatDateWithTimezone - Invalid date string provided:", dateInput);
      return 'Data inválida';
    }
    baseDate = parsedDate;
  } else {
    console.error("formatDateWithTimezone - Unexpected dateInput type:", typeof dateInput, dateInput);
    return 'Data inválida';
  }

  // If the date is already a Date object, assume it's in local time or already zoned.
  // If it's a string, parseISO treats it as UTC if it has 'Z' or timezone info,
  // otherwise as local. We then convert it to the target timezone.
  let finalDateObject = baseDate;
  if (typeof dateInput === 'string') {
    try {
      finalDateObject = utcToZonedTime(baseDate, timezone);
    } catch (tzError) {
      console.error("formatDateWithTimezone - Error converting to zoned time:", tzError, baseDate, timezone);
      return 'Data inválida';
    }
  }

  if (!isValid(finalDateObject)) {
    console.error("formatDateWithTimezone - Final date object is Invalid Date:", finalDateObject);
    return 'Data inválida';
  }

  try {
    return format(finalDateObject, 'dd/MM/yyyy', { locale: ptBR });
  } catch (formatError) {
    console.error("formatDateWithTimezone - Error during final date formatting:", formatError, finalDateObject);
    return 'Data inválida';
  }
}

export function valorPorExtenso(valor) {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];

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

  let [inteiro, centavos] = String(valor.toFixed(2)).split('.');
  inteiro = parseInt(inteiro);
  centavos = parseInt(centavos);

  let extensoInteiro = [];
  let grupos = [];
  let s = String(inteiro);

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

    if (i === 1 && grupo === 1) {
      extensoInteiro.unshift('mil');
    } else if (i > 1 && grupo > 1) {
      extensoInteiro.unshift(sufixo);
      extensoInteiro.unshift(parte);
    } else if (i > 1 && grupo === 1) {
      extensoInteiro.unshift(sufixo.slice(0, -1));
      extensoInteiro.unshift('um');
    } else {
      extensoInteiro.unshift(sufixo);
      extensoInteiro.unshift(parte);
    }
  }

  let resultado = extensoInteiro.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  resultado += (inteiro === 1) ? ' real' : ' reais';

  if (centavos > 0) {
    resultado += ' e ' + converterGrupo(centavos);
    resultado += (centavos === 1) ? ' centavo' : ' centavos';
  }

  return resultado;
}

export function getMonthsDifference(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 0;

  const d1 = dateFrom instanceof Date ? dateFrom : parseISO(dateFrom);
  const d2 = dateTo instanceof Date ? dateTo : parseISO(dateTo);

  if (!isValid(d1) || !isValid(d2)) return 0;

  let months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}