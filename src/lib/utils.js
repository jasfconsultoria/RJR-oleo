import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string formatada como moeda brasileira (ex: "1.234,56") para um número float.
 * Remove separadores de milhares (pontos) e substitui a vírgula decimal por ponto.
 * @param {string | number} value - O valor a ser parseado.
 * @returns {number} O valor numérico parseado, ou 0 se for inválido.
 */
export function parseCurrency(value) {
  if (typeof value !== 'string') {
    return parseFloat(value) || 0;
  }
  // Remove separadores de milhares (pontos) e substitui a vírgula decimal por ponto
  const cleanedValue = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleanedValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formata um número para o formato de moeda brasileira (ex: "R$ 1.234,56").
 * @param {number | string} value - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
export function formatCurrency(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return 'R$ 0,00';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'R$ 0,00';
  }
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata um número para o formato numérico brasileiro (ex: "1.234,56").
 * @param {number | string} value - O valor a ser formatado.
 * @param {number} decimals - Número de casas decimais.
 * @returns {string} O valor formatado como número.
 */
export function formatNumber(value, decimals = 2) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return '0,00';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return '0,00';
  }
  return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Formata um CNPJ ou CPF.
 * @param {string} value - O CNPJ/CPF sem formatação.
 * @returns {string} O CNPJ/CPF formatado.
 */
export function formatCnpjCpf(value) {
  if (!value) return '';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d)/, '$1.$2')
                  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    return cleaned.replace(/^(\d{2})(\d)/, '$1.$2')
                  .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                  .replace(/\.(\d{3})(\d)/, '.$1/$2')
                  .replace(/(\d{4})(\d)/, '$1-$2');
  }
}

/**
 * Remove a máscara de um valor (deixa apenas dígitos).
 * @param {string} value - O valor mascarado.
 * @returns {string} O valor sem máscara.
 */
export function unmask(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\D/g, '');
}

/**
 * Formata uma data para o padrão ISO (yyyy-MM-dd).
 * @param {Date | string} date - A data a ser formatada.
 * @returns {string} A data formatada em ISO, ou string vazia se inválida.
 */
export function formatToISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : parseISO(date);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
}

/**
 * Formata uma string de data para o formato dd/MM/yyyy com fuso horário.
 * @param {string} dateString - A string da data (ISO).
 * @param {string} timezone - O fuso horário (ex: 'America/Sao_Paulo').
 * @returns {string} A data formatada.
 */
export function formatDateWithTimezone(dateString, timezone = 'America/Sao_Paulo') {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '-';
    return formatInTimeZone(date, timezone, 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    console.error("Failed to format date with timezone:", e);
    return "-";
  }
}

/**
 * Formata uma string de data e hora para o formato dd/MM/yyyy HH:mm com fuso horário.
 * @param {string} dateString - A string da data e hora (ISO).
 * @param {string} timezone - O fuso horário (ex: 'America/Sao_Paulo').
 * @returns {string} A data e hora formatadas.
 */
export function formatDateTimeWithTimezone(dateString, timezone = 'America/Sao_Paulo') {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '-';
    return formatInTimeZone(date, timezone, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch (e) {
    console.error("Failed to format date-time with timezone:", e);
    return "-";
  }
}