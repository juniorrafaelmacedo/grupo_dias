export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Removes accents and special characters to ensure 1 char = 1 byte
export const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9 @.-]/g, " ") // Remove weird chars but keep basic punctuation
    .toUpperCase();
};

export const padLeft = (value: string | number, length: number, char: string = '0'): string => {
  const str = normalizeText(String(value)); 
  return str.padStart(length, char).substring(0, length);
};

export const padRight = (value: string | number, length: number, char: string = ' '): string => {
  const str = normalizeText(String(value));
  return str.padEnd(length, char).substring(0, length);
};

export const removeNonNumeric = (value: string): string => {
  return String(value || '').replace(/\D/g, '');
};

// Formats YYYY-MM-DD to DDMMAAAA (CNAB Standard)
export const formatDateCNAB = (dateString: string): string => {
  if (!dateString) return '00000000';
  const [year, month, day] = dateString.split('-');
  return `${day}${month}${year}`;
};

// Returns current time HHMMSS
export const formatTimeCNAB = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
};