import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { utcToZonedTime } from 'date-fns-tz';

export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export const formatCnpjCpf = (value) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value;
};

export const unmask = (value) => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseCurrency = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return 0;

  // If the value is already in a normalized, dot-separated format (e.g., "100.00" from IMask onAccept)
  // just parse it directly.
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  // Otherwise, assume it's a user-entered string with potential thousands separators and comma decimal
  const cleanedValue = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

export const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
};

export const formatToISODate = (date) => {
  if (!date) return null;
  if (typeof date === 'string') {
    const parsedDate = parseISO(date);
    return isValid(parsedDate) ? format(parsedDate, 'yyyy-MM-dd') : null;
  }
  return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
};

export const formatDateWithTimezone = (dateInput, timezone = 'America/Sao_Paulo') => {
  if (!dateInput) return 'N/A';

  let dateObject;
  if (dateInput instanceof Date) {
    dateObject = dateInput;
  } else if (typeof dateInput === 'string') {
    const parsed = parseISO(dateInput);
    if (isValid(parsed)) {
      dateObject = parsed;
    } else {
      return 'Data inválida';
    }
  } else {
    return 'Data inválida';
  }

  try {
    const zonedDate = utcToZonedTime(dateObject, timezone);
    return format(zonedDate, 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    console.error("Error formatting date with timezone:", e, dateInput, timezone);
    return 'Data inválida';
  }
};

export const valorPorExtenso = (valor) => {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];

  function numeroParaExtensoGrupo(n) {
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

  if (valor === 0) return 'zero real';

  let inteiro = Math.floor(valor);
  let centavos = Math.round((valor - inteiro) * 100);

  let extensoInteiro = [];
  let grupos = [];
  let tempInteiro = inteiro;

  while (tempInteiro > 0) {
    grupos.unshift(tempInteiro % 1000);
    tempInteiro = Math.floor(tempInteiro / 1000);
  }

  const sufixos = ['', 'mil', 'milhões', 'bilhões', 'trilhões'];

  for (let i = 0; i < grupos.length; i++) {
    let grupo = grupos[grupos.length - 1 - i];
    if (grupo === 0) continue;

    let parte = numeroParaExtensoGrupo(grupo);
    let sufixo = sufixos[i];

    if (i === 1 && grupo === 1) { // "mil" singular
      extensoInteiro.unshift('mil');
    } else if (i > 1 && grupo > 1) { // "milhões", "bilhões" plural
      extensoInteiro.unshift(sufixo);
      extensoInteiro.unshift(parte);
    } else if (i > 1 && grupo === 1) { // "um milhão", "um bilhão"
      extensoInteiro.unshift(sufixo.slice(0, -1)); // remove 's'
      extensoInteiro.unshift('um');
    } else {
      extensoInteiro.unshift(sufixo);
      extensoInteiro.unshift(parte);
    }
  }

  let resultado = extensoInteiro.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  if (inteiro === 1) {
    resultado += ' real';
  } else {
    resultado += ' reais';
  }

  if (centavos > 0) {
    let extensoCentavos = numeroParaExtensoGrupo(centavos);
    resultado += ' e ' + extensoCentavos;
    if (centavos === 1) {
      resultado += ' centavo';
    } else {
      resultado += ' centavos';
    }
  }

  return resultado;
};

export const getMonthsDifference = (date1, date2) => {
  if (!date1 || !date2) return 0;

  let d1 = date1 instanceof Date ? date1 : parseISO(date1);
  let d2 = date2 instanceof Date ? date2 : parseISO(date2);

  if (!isValid(d1) || !isValid(d2)) return 0;

  let months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};