import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format as formatFns, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString) {
  if (!dateString) return '';

  // Verifica se é uma data simples 'YYYY-MM-DD' ou um timestamp completo
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  
  // Se for apenas data, adiciona tempo e 'Z' para tratar como UTC
  // Caso contrário, usa a string original que deve ser um timestamp ISO completo
  const dateToParse = isDateOnly ? `${dateString}T00:00:00Z` : dateString;
  
  const date = parseISO(dateToParse);
  
  if (!isValid(date)) return '';
  
  // Formata sempre em UTC para evitar deslocamentos de fuso horário
  return formatInTimeZone(date, 'UTC', 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateWithTimezone(dateString, timeZone) {
    if (!dateString || !timeZone) return '';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return '';
        return formatInTimeZone(date, timeZone, 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
        console.error("Error formatting date with timezone:", error);
        return dateString; // Fallback
    }
}

export function formatToISODate(date) {
    if (!date || !isValid(date)) return null;
    return formatFns(date, 'yyyy-MM-dd');
}

export function formatCnpjCpf(value) {
  if (!value) return '';
  const onlyNumbers = value.replace(/[^\d]/g, '');

  if (onlyNumbers.length <= 11) {
    return onlyNumbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  return onlyNumbers.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  );
}

export function unmask(value) {
  return value ? value.replace(/[^\d]/g, '') : '';
}

export function parseCurrency(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  const stringValue = String(value)
    .replace('R$', '')    // Remove o símbolo da moeda
    .trim()               // Remove espaços em branco
    .replace(/\./g, '')   // Remove separadores de milhar
    .replace(',', '.');   // Substitui a vírgula decimal por ponto
  
  const number = parseFloat(stringValue);
  return isNaN(number) ? 0 : number;
}

export function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value));
}

export function formatNumber(value, options = {}) {
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number(value));
}

const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const dezenasEspeciais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function converterNumeroParaPalavras(num) {
    if (num === 0) return 'zero';
    if (num < 0) return 'menos ' + converterNumeroParaPalavras(Math.abs(num));

    let s = num.toString();
    let result = [];

    function processChunk(chunk) {
        let c = parseInt(chunk);
        if (c === 0) return '';
        if (c < 10) return unidades[c];
        if (c < 20) return dezenasEspeciais[c - 10];
        if (c < 100) {
            let dez = Math.floor(c / 10);
            let uni = c % 10;
            return dezenas[dez] + (uni > 0 ? ' e ' + unidades[uni] : '');
        }
        if (c < 1000) {
            let cent = Math.floor(c / 100);
            let rest = c % 100;
            return (cent === 1 && rest === 0 ? 'cem' : centenas[cent]) + (rest > 0 ? ' e ' + converterNumeroParaPalavras(rest) : '');
        }
        return ''; // Should not happen for chunks of 3 digits
    }

    let chunks = [];
    for (let i = s.length; i > 0; i -= 3) {
        chunks.unshift(s.substring(Math.max(0, i - 3), i));
    }

    const grandezas = ['', 'mil', 'milhões', 'bilhões', 'trilhões']; // Extend as needed

    for (let i = 0; i < chunks.length; i++) {
        let chunk = parseInt(chunks[i]);
        if (chunk === 0) continue;

        let chunkWords = processChunk(chunks[i]);
        let grandeza = grandezas[chunks.length - 1 - i];

        if (grandeza === 'mil' && chunk === 1) {
            // "um mil" is usually just "mil"
            result.push('mil');
        } else if (grandeza) {
            result.push(chunkWords + ' ' + grandeza + (chunk > 1 && grandeza !== 'mil' ? 'ões' : ''));
        } else {
            result.push(chunkWords);
        }
    }

    return result.join(' ').trim();
}

export function valorPorExtenso(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) {
        return '';
    }

    let partes = valor.toFixed(2).split('.');
    let reais = parseInt(partes[0]);
    let centavos = parseInt(partes[1]);

    let extenso = '';

    if (reais > 0) {
        extenso += converterNumeroParaPalavras(reais);
        extenso += (reais === 1) ? ' real' : ' reais';
    }

    if (centavos > 0) {
        if (reais > 0) {
            extenso += ' e ';
        }
        extenso += converterNumeroParaPalavras(centavos);
        extenso += (centavos === 1) ? ' centavo' : ' centavos';
    }

    if (reais === 0 && centavos === 0) {
        return 'zero reais';
    }

    return extenso;
}

function validateCpf(cpf) {
  const strCPF = unmask(cpf);
  if (!strCPF || strCPF.length !== 11 || /^(\d)\1{10}$/.test(strCPF)) return false;
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(strCPF.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(strCPF.substring(10, 11))) return false;
  return true;
}

function validateCnpj(cnpj) {
  const strCNPJ = unmask(cnpj);
  if (!strCNPJ || strCNPJ.length !== 14 || /^(\d)\1{13}$/.test(strCNPJ)) return false;
  
  let size = strCNPJ.length - 2;
  let numbers = strCNPJ.substring(0, size);
  const digits = strCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result != digits.charAt(0)) return false;
  
  size = size + 1;
  numbers = strCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += numbers.charAt(size - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - sum % 11;
  if (result != digits.charAt(1)) return false;
  
  return true;
}

export function validateCnpjCpf(value) {
  const unmaskedValue = unmask(value);
  if (unmaskedValue.length === 11) {
    return validateCpf(unmaskedValue);
  }
  if (unmaskedValue.length === 14) {
    return validateCnpj(unmaskedValue);
  }
  return false;
}