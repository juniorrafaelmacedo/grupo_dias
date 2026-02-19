import { Payable, Company } from '../types';
import { padLeft, padRight, removeNonNumeric, formatDateCNAB, formatTimeCNAB, normalizeText } from '../utils/formatters';

// Helper para garantir que o valor seja inserido na posição exata (1-indexed)
const writeAt = (line: string, pos: number, value: string | number, length: number, padChar: string = ' '): string => {
  const strValue = normalizeText(String(value)).substring(0, length);
  const paddedValue = padChar === '0' ? strValue.padStart(length, '0') : strValue.padEnd(length, ' ');
  
  const lineArray = line.split('');
  for (let i = 0; i < length; i++) {
    lineArray[pos - 1 + i] = paddedValue[i];
  }
  return lineArray.join('');
};

const createEmptyLine = () => ' '.repeat(240);

export const generateCNAB240 = (
  company: Company, 
  payments: Payable[],
  fileSequence: number = 1
): string => {
  const lines: string[] = [];
  const now = new Date();
  const dateGeracao = formatDateCNAB(now.toISOString().split('T')[0]);
  const timeGeracao = formatTimeCNAB(now);

  let recordCountGlobal = 0;

  // --- HEADER DE ARQUIVO (Registro 0) ---
  let hArq = createEmptyLine();
  hArq = writeAt(hArq, 1, '341', 3);
  hArq = writeAt(hArq, 4, '0000', 4);
  hArq = writeAt(hArq, 8, '0', 1);
  hArq = writeAt(hArq, 18, company.cnpj.length > 11 ? '2' : '1', 1);
  hArq = writeAt(hArq, 19, removeNonNumeric(company.cnpj), 14, '0');
  hArq = writeAt(hArq, 53, company.bancoAgencia, 5, '0');
  hArq = writeAt(hArq, 59, company.bancoConta, 12, '0');
  hArq = writeAt(hArq, 72, company.bancoContaDV, 1);
  hArq = writeAt(hArq, 73, company.nomeEmpresa, 30);
  hArq = writeAt(hArq, 103, 'BANCO ITAU S.A.', 30);
  hArq = writeAt(hArq, 143, '1', 1);
  hArq = writeAt(hArq, 144, dateGeracao, 8);
  hArq = writeAt(hArq, 152, timeGeracao, 6);
  hArq = writeAt(hArq, 158, fileSequence, 6, '0');
  hArq = writeAt(hArq, 15, '085', 3); // Versão do Layout do Arquivo
  hArq = writeAt(hArq, 164, '085', 3); // Versão do Layout do Arquivo
  lines.push(hArq);
  recordCountGlobal++;

  const loteSeq = '0001';
  let nsrBatch = 0;
  let totalValorLote = 0;

  // --- HEADER DE LOTE (Registro 1) ---
  let hLote = createEmptyLine();
  hLote = writeAt(hLote, 1, '341', 3);
  hLote = writeAt(hLote, 4, loteSeq, 4);
  hLote = writeAt(hLote, 8, '1', 1);
  hLote = writeAt(hLote, 9, 'C', 1);       // Operação: 'C' (Crédito) - ESSENCIAL PARA SISPAG
  hLote = writeAt(hLote, 10, '20', 2);     // Serviço: 20 (Fornecedores)
  hLote = writeAt(hLote, 12, '30', 2);     // Forma: 30 (Boletos)
  hLote = writeAt(hLote, 14, '040', 3);    // Layout Lote v040 (para Arquivo 085)
  hLote = writeAt(hLote, 18, company.cnpj.length > 11 ? '2' : '1', 1);
  hLote = writeAt(hLote, 19, removeNonNumeric(company.cnpj), 14, '0');
  hLote = writeAt(hLote, 53, company.bancoAgencia, 5, '0');
  hLote = writeAt(hLote, 59, company.bancoConta, 12, '0');
  hLote = writeAt(hLote, 72, company.bancoContaDV, 1);
  hLote = writeAt(hLote, 73, company.nomeEmpresa, 30);
  hLote = writeAt(hLote, 103, 'PAGAMENTO FORNECEDORES BOLETOS', 30);
  lines.push(hLote);
  recordCountGlobal++;

  payments.forEach((p) => {
    totalValorLote += p.valor;
    const valorStr15 = padLeft(Math.round(p.valor * 100), 15);
    const dataPagto = formatDateCNAB(p.dataPagamento);
    const dataVenc = formatDateCNAB(p.dataVencimento);

    // --- SEGMENTO J (Detalhe - Registro 3) ---
    nsrBatch++;
    let segJ = createEmptyLine();
    segJ = writeAt(segJ, 1, '341', 3);
    segJ = writeAt(segJ, 4, loteSeq, 4);
    segJ = writeAt(segJ, 8, '3', 1);
    segJ = writeAt(segJ, 9, nsrBatch, 5, '0');
    segJ = writeAt(segJ, 14, 'J', 1);
    segJ = writeAt(segJ, 15, '040', 3); // Versão do Layout do Lote
    segJ = writeAt(segJ, 18, '0', 1);   // Tipo de Movimento: 0 (Inclusão)
    segJ = writeAt(segJ, 19, '00', 2);  // Código de Instrução: 00 (Inclusão de Registro Liberado)
    
    // Código de Barras (Pos 21-64)
    let barCode = removeNonNumeric(p.codigoBarras || '');
    if (barCode.length === 47) {
        // Conversão de Linha Digitável para Código de Barras 44 posições
        barCode = barCode.substring(0, 3) + barCode.substring(3, 4) + barCode.substring(32, 47) + barCode.substring(4, 9) + barCode.substring(10, 20) + barCode.substring(21, 31);
    }
    segJ = writeAt(segJ, 21, barCode, 44, '0');
    
    segJ = writeAt(segJ, 65, p.nomeFavorecido, 30);
    segJ = writeAt(segJ, 95, dataVenc, 8);
    segJ = writeAt(segJ, 103, valorStr15, 15, '0');
    segJ = writeAt(segJ, 118, '0', 15, '0'); // Desconto
    segJ = writeAt(segJ, 133, '0', 15, '0'); // Multa
    segJ = writeAt(segJ, 148, dataPagto, 8);
    segJ = writeAt(segJ, 156, valorStr15, 15, '0');
    segJ = writeAt(segJ, 186, p.id.substring(0, 20), 20);
    lines.push(segJ);
    recordCountGlobal++;

    // --- SEGMENTO J-52 (Identificação Sacado/Cedente - Registro 3) ---
    nsrBatch++;
    let segJ52 = createEmptyLine();
    segJ52 = writeAt(segJ52, 1, '341', 3);
    segJ52 = writeAt(segJ52, 4, loteSeq, 4);
    segJ52 = writeAt(segJ52, 8, '3', 1);
    segJ52 = writeAt(segJ52, 9, nsrBatch, 5, '0');
    segJ52 = writeAt(segJ52, 14, 'J', 1);
    segJ52 = writeAt(segJ52, 15, '040', 3); // Versão do Layout do Lote
    segJ52 = writeAt(segJ52, 18, '52', 2); // IDENTIFICADOR DE INSTRUÇÃO J-52
    
    // Dados do Pagador (Nós)
    segJ52 = writeAt(segJ52, 20, company.cnpj.length > 11 ? '2' : '1', 1);
    segJ52 = writeAt(segJ52, 21, removeNonNumeric(company.cnpj), 15, '0');
    segJ52 = writeAt(segJ52, 36, company.nomeEmpresa, 40);
    
    // Dados do Beneficiário (Fornecedor)
    segJ52 = writeAt(segJ52, 76, removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1', 1);
    segJ52 = writeAt(segJ52, 77, removeNonNumeric(p.cpfCnpjFavorecido), 15, '0');
    segJ52 = writeAt(segJ52, 92, p.nomeFavorecido, 40);
    lines.push(segJ52);
    recordCountGlobal++;
  });

  // --- TRAILER DE LOTE (Registro 5) ---
  let tLote = createEmptyLine();
  tLote = writeAt(tLote, 1, '341', 3);
  tLote = writeAt(tLote, 4, loteSeq, 4);
  tLote = writeAt(tLote, 8, '5', 1);
  tLote = writeAt(tLote, 18, nsrBatch + 2, 6, '0'); // Qtd registros do lote (Header + NSRs + Trailer)
  tLote = writeAt(tLote, 24, Math.round(totalValorLote * 100), 18, '0');
  lines.push(tLote);
  recordCountGlobal++;

  // --- TRAILER DE ARQUIVO (Registro 9) ---
  let tArq = createEmptyLine();
  tArq = writeAt(tArq, 1, '341', 3);
  tArq = writeAt(tArq, 4, '9999', 4);
  tArq = writeAt(tArq, 8, '9', 1);
  tArq = writeAt(tArq, 18, '1', 6, '0'); // Qtd lotes do arquivo
  tArq = writeAt(tArq, 24, recordCountGlobal + 1, 6, '0'); // Qtd total de registros (incluindo trailer arquivo)
  lines.push(tArq);

  return lines.join('\r\n') + '\r\n';
};