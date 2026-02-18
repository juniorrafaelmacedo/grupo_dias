import { Payable, Company } from '../types';
import { padLeft, padRight, removeNonNumeric, formatDateCNAB, formatTimeCNAB } from '../utils/formatters';

interface PaymentGroup {
  forma: string; 
  tipoServico: string; 
  layoutLote: string; 
  payments: Payable[];
}

const getSispagAttributes = (p: Payable): { forma: string; tipoServico: string; layoutLote: string } => {
  if (p.tipo === '02') {
    const bankCode = p.codigoBarras ? p.codigoBarras.substring(0, 3) : '000';
    const isItau = bankCode === '341';
    // SISPAG v085: Boletos exigem layout de lote 030
    return { tipoServico: '20', forma: isItau ? '31' : '30', layoutLote: '030' };
  }
  if (p.tipo === '04') {
    return { tipoServico: '22', forma: '13', layoutLote: '030' };
  }
  if (p.tipo === '06') {
    return { tipoServico: '20', forma: '45', layoutLote: '040' };
  }
  const destBank = p.bancoDestino || '';
  if (destBank === '341') {
    return { tipoServico: '20', forma: '01', layoutLote: '040' };
  } else {
    return { tipoServico: '20', forma: '41', layoutLote: '040' };
  }
};

export const generateCNAB240 = (
  company: Company, 
  payments: Payable[],
  fileSequence: number = 1
): string => {
  const lines: string[] = [];
  const now = new Date();
  const dateGeracao = formatDateCNAB(now.toISOString().split('T')[0]);
  const timeGeracao = formatTimeCNAB(now);

  const groups: Record<string, PaymentGroup> = {};
  payments.forEach(p => {
    const attrs = getSispagAttributes(p);
    const key = `${attrs.tipoServico}-${attrs.forma}-${attrs.layoutLote}`;
    if (!groups[key]) groups[key] = { ...attrs, payments: [] };
    groups[key].payments.push(p);
  });

  const addLine = (line: string) => {
    // Garante rigorosamente 240 caracteres com espaços
    lines.push(line.padEnd(240, ' ').substring(0, 240));
  };

  let recordCountGlobal = 0;

  // --- HEADER DE ARQUIVO (Registro 0) ---
  let header = '34100000'; 
  header += ' '.repeat(9);
  header += company.cnpj.length > 11 ? '2' : '1';
  header += padLeft(removeNonNumeric(company.cnpj), 14);
  header += ' '.repeat(20);
  header += padLeft(company.bancoAgencia, 5);
  header += ' ';
  header += padLeft(company.bancoConta, 12);
  header += ' ';
  header += padLeft(company.bancoContaDV, 1);
  header += padRight(company.nomeEmpresa, 30);
  header += padRight('BANCO ITAU S.A.', 30);
  header += ' '.repeat(10);
  header += '1'; 
  header += dateGeracao;
  header += timeGeracao;
  header += padLeft(fileSequence, 6);
  header += '085'; 
  header += '00000';
  header += ' '.repeat(69);
  addLine(header);
  recordCountGlobal++;

  let loteCount = 0;
  Object.values(groups).forEach((group) => {
    loteCount++;
    const loteSeq = padLeft(loteCount, 4);
    let nsrBatch = 0;
    let totalValorLote = 0;

    // --- HEADER DE LOTE (Registro 1) ---
    // Pos 009: Operação 'C' (Crédito) - Essencial para SISPAG
    let headerLote = '341' + loteSeq + '1' + 'C'; 
    headerLote += padLeft(group.tipoServico, 2); // 010-011
    headerLote += padLeft(group.forma, 2);       // 012-013
    headerLote += padLeft(group.layoutLote, 3);  // 014-016
    headerLote += ' ';                           // 017
    headerLote += company.cnpj.length > 11 ? '2' : '1';
    headerLote += padLeft(removeNonNumeric(company.cnpj), 14);
    headerLote += ' '.repeat(20);
    headerLote += padLeft(company.bancoAgencia, 5);
    headerLote += ' ';
    headerLote += padLeft(company.bancoConta, 12);
    headerLote += ' ';
    headerLote += padLeft(company.bancoContaDV, 1);
    headerLote += padRight(company.nomeEmpresa, 30);
    headerLote += ' '.repeat(38);
    headerLote += ' '.repeat(100);
    addLine(headerLote);
    recordCountGlobal++;

    group.payments.forEach((p) => {
      totalValorLote += p.valor;
      const valorStr15 = padLeft(Math.round(p.valor * 100), 15);
      const dataPagto = formatDateCNAB(p.dataPagamento);
      const dataVenc = formatDateCNAB(p.dataVencimento);

      if (group.layoutLote === '040') {
        // --- SEGMENTO A (TED/DOC/PIX) ---
        nsrBatch++;
        let segA = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'A';
        segA += '000'; 
        segA += p.tipo === '06' ? '009' : '018'; 
        segA += padLeft(p.bancoDestino || '000', 3);
        segA += padLeft(p.agenciaDestino || '0', 5) + ' ' + padLeft(p.contaDestino || '0', 12) + padLeft(p.contaDestinoDV || '0', 1) + ' ';
        segA += padRight(p.nomeFavorecido, 30);
        segA += padLeft(p.id.substring(0, 20), 20);
        segA += dataPagto;
        segA += 'REA' + padLeft(0, 8);
        segA += (p.tipo === '06' && p.chavePix) ? '04' : '01';
        segA += padLeft(0, 5) + valorStr15 + ' '.repeat(15) + ' '.repeat(5) + padLeft(0, 8) + padLeft(0, 15);
        segA += ' '.repeat(20) + ' '.repeat(6) + padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14) + ' '.repeat(2) + '00005' + ' '.repeat(5) + '0' + ' '.repeat(10);
        addLine(segA);
        recordCountGlobal++;

        if (p.tipo === '06' && p.chavePix) {
          nsrBatch++;
          let segB = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'B';
          segB += '000';
          segB += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
          segB += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14);
          segB += ' '.repeat(30) + padRight(p.descricao, 65) + padRight(p.chavePix || '', 100) + ' '.repeat(13);
          addLine(segB);
          recordCountGlobal++;
        }
      } else {
        // --- SEGMENTO J (BOLETOS) ---
        nsrBatch++;
        let segJ = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ += '000'; // 015-017: Tipo Movimento
        
        // CÓDIGO DE BARRAS (44 caracteres rigorosos começando na 018)
        const barCode = removeNonNumeric(p.codigoBarras || '').padEnd(44, '0');
        segJ += barCode; 
        
        segJ += padRight(p.nomeFavorecido, 30); // 062-091
        segJ += dataVenc; // 092-099
        segJ += valorStr15; // 100-114
        segJ += padLeft(0, 15); // Descontos
        segJ += padLeft(0, 15); // Acréscimos
        segJ += dataPagto; // 145-152
        segJ += valorStr15; // 153-167
        segJ += padLeft(0, 15); // Qtd
        segJ += padRight(p.id.substring(0, 20), 20); // Seu Número
        segJ += padLeft(0, 15); // Nosso Número
        segJ += ' '; // Branco
        addLine(segJ);
        recordCountGlobal++;

        // --- SEGMENTO J-52 (DADOS DO CEDENTE/SACADO) ---
        nsrBatch++;
        let segJ52 = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ52 += '000'; // 015-017: Movimento
        segJ52 += '52';  // 018-019: IDENTIFICADOR DO J-52 (Crítico!)
        
        // Pagador (Nós/Empresa)
        segJ52 += (company.cnpj.length > 11 ? '2' : '1');
        segJ52 += padLeft(removeNonNumeric(company.cnpj), 15); 
        segJ52 += padRight(company.nomeEmpresa, 40);
        
        // Beneficiário (Fornecedor)
        segJ52 += (removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1');
        segJ52 += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 15);
        segJ52 += padRight(p.nomeFavorecido, 40);
        
        // Sacador Avalista (Vazio)
        segJ52 += '0';
        segJ52 += padLeft(0, 15);
        segJ52 += ' '.repeat(40);
        
        addLine(segJ52);
        recordCountGlobal++;
      }
    });

    // --- TRAILER DE LOTE (Registro 5) ---
    let trailerLote = '341' + loteSeq + '5';
    trailerLote += ' '.repeat(9); 
    trailerLote += padLeft(nsrBatch + 2, 6); // Qtd registros
    trailerLote += padLeft(Math.round(totalValorLote * 100), 18);
    trailerLote += padLeft(0, 18); 
    trailerLote += ' '.repeat(171); 
    trailerLote += ' '.repeat(10); 
    addLine(trailerLote);
    recordCountGlobal++;
  });

  // --- TRAILER DE ARQUIVO (Registro 9) ---
  let trailerArq = '34199999'; 
  trailerArq += ' '.repeat(9);
  trailerArq += padLeft(loteCount, 6); 
  trailerArq += padLeft(recordCountGlobal + 1, 6); 
  trailerArq += ' '.repeat(211); 
  addLine(trailerArq);

  return lines.join('\r\n') + '\r\n';
};