import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime, toDate } from 'date-fns-tz'; // Importar toDate

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

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const parseCurrency = (value) => {
  if (typeof value !== 'string') return parseFloat(value) || 0;
  const cleaned = value.replace(/[R$.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export const formatNumber = (value, options = { minimumFractionDigits: 2, maximumFractionDigits: 2 }) => {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return parseFloat(value).toLocaleString('pt-BR', options);
};

export const formatToISODate = (date) => {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
};

// Função para formatar datas com base no fuso horário da empresa
export const formatDateWithTimezone = (dateInput, timezone = 'America/Sao_Paulo', formatStr = 'dd/MM/yyyy') => {
  if (!dateInput) return 'N/A';

  let dateObj;
  if (dateInput instanceof Date) {
    dateObj = dateInput;
  } else if (typeof dateInput === 'string') {
    // Se a string for apenas 'YYYY-MM-DD' (de uma coluna DATE do DB),
    // interpretá-la como meia-noite daquele dia no fuso horário especificado.
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Usa toDate com a opção de fuso horário para criar o objeto Date diretamente no fuso horário alvo
      dateObj = toDate(`${dateInput}T00:00:00`, { timeZone: timezone });
    } else {
      // Para strings ISO completas (com hora e fuso), parseISO funciona bem.
      // Em seguida, converte para o fuso horário alvo para tratamento consistente.
      dateObj = toZonedTime(parseISO(dateInput), timezone);
    }
  } else {
    return 'N/A';
  }

  if (!isValid(dateObj)) {
    console.error("Data inválida para formatação:", dateInput, timezone);
    return 'Data inválida';
  }

  return formatInTimeZone(dateObj, timezone, formatStr, { locale: ptBR });
};

// Função para converter valor numérico em extenso
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
  if (valor === null || valor === undefined || isNaN(valor)) return '';

  const partes = valor.toFixed(2).split('.');
  const inteiros = parseInt(partes[0], 10);
  const decimais = parseInt(partes[1], 10);

  let extenso = numeroParaExtenso(inteiros);
  extenso += (inteiros === 1) ? ' real' : ' reais';

  if (decimais > 0) {
    extenso += ' e ' + numeroParaExtenso(decimais);
    extenso += (decimais === 1) ? ' centavo' : ' centavos';
  }

  return extenso;
};

export const getMonthsDifference = (date1, date2) => {
  if (!date1 || !date2) return 0;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  let months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
};