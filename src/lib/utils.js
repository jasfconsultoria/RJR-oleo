import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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

export const parseCurrency = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
};

export const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    value = parseCurrency(value);
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatNumber = (value, options = { minimumFractionDigits: 2, maximumFractionDigits: 2 }) => {
  if (typeof value !== 'number') {
    value = parseFloat(value);
  }
  if (isNaN(value)) return '0,00';
  return value.toLocaleString('pt-BR', options);
};

export const formatToISODate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString + 'T00:00:00'); // Ensure it's treated as UTC to avoid timezone issues
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    return 'Data inválida';
  }
};

export const formatDateWithTimezone = (dateString, timezone = 'America/Sao_Paulo') => {
  if (!dateString) return 'N/A';
  try {
    // date-fns-tz is not directly used here, but the principle is to handle dates carefully.
    // For simple display, we assume the dateString is already in the correct local date.
    const date = parseISO(dateString);
    if (!isValid(date)) {
      // Fallback for simple 'YYYY-MM-DD' strings without time
      const [year, month, day] = dateString.split('-').map(Number);
      return format(new Date(year, month - 1, day), 'dd/MM/yyyy', { locale: ptBR });
    }
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch (error) {
    console.error("Failed to format date with timezone:", error);
    return 'Data inválida';
  }
};

// Function to convert number to extenso (Portuguese)
const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];

function numeroParaExtenso(num) {
  if (num === 0) return 'zero';
  if (num < 0) return 'menos ' + numeroParaExtenso(Math.abs(num));

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

export const valorPorExtenso = (valor) => {
  if (typeof valor !== 'number') {
    valor = parseCurrency(valor);
  }
  if (isNaN(valor)) return 'zero reais';

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  let extenso = numeroParaExtenso(inteiro);
  extenso += (inteiro === 1) ? ' real' : ' reais';

  if (centavos > 0) {
    extenso += ' e ' + numeroParaExtenso(centavos);
    extenso += (centavos === 1) ? ' centavo' : ' centavos';
  }

  return extenso;
};

export const getMonthsDifference = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = isValid(startDate) ? startDate : parseISO(startDate);
  const end = isValid(endDate) ? endDate : parseISO(endDate);

  if (!isValid(start) || !isValid(end)) return 0;

  return differenceInMonths(end, start);
};