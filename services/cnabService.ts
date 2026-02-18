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
    // Para Boletos, v085 exige layout 040 no lote
    return { tipoServico: '20', forma: isItau ? '30' : '31', layoutLote: '040' };
  }
  if (p.tipo === '04') {
    return { tipoServico: '22', forma: '13', layoutLote: '040' };
  }
  if (p.tipo === '06') {
    return { tipoServico: '20', forma: '45', layoutLote: '040' };
  }
  const destBank = p.bancoDestino || '';
  const isItauDest = destBank === '341';
  if (isItauDest) {
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
    lines.push(line.substring(0, 240).padEnd(240, ' '));
  };

  let recordCountGlobal = 0;

  // --- HEADER DE ARQUIVO (Registro 0) ---
  let header = '34100000'; 
  header += padRight('', 9);
  header += company.cnpj.length > 11 ? '2' : '1';
  header += padLeft(removeNonNumeric(company.cnpj), 14);
  header += padRight('', 20);
  header += padLeft(company.bancoAgencia, 5);
  header += ' ';
  header += padLeft(company.bancoConta, 12);
  header += ' ';
  header += padLeft(company.bancoContaDV, 1);
  header += padRight(company.nomeEmpresa, 30);
  header += padRight('BANCO ITAU S.A.', 30);
  header += padRight('', 10);
  header += '1';
  header += dateGeracao;
  header += timeGeracao;
  header += padLeft(fileSequence, 6);
  header += '085'; 
  header += '00000';
  header += padRight('', 69);
  addLine(header);
  recordCountGlobal++;

  let loteCount = 0;
  Object.values(groups).forEach((group) => {
    loteCount++;
    const loteSeq = padLeft(loteCount, 4);
    let nsrBatch = 0;
    let totalValorLote = 0;

    // --- HEADER DE LOTE (Registro 1) ---
    let headerLote = '341' + loteSeq + '1C';
    headerLote += padLeft(group.tipoServico, 2);
    headerLote += padLeft(group.forma, 2);
    headerLote += group.layoutLote; // 040 para SISPAG v085
    headerLote += ' ';
    headerLote += company.cnpj.length > 11 ? '2' : '1';
    headerLote += padLeft(removeNonNumeric(company.cnpj), 14);
    headerLote += padRight('', 20);
    headerLote += padLeft(company.bancoAgencia, 5);
    headerLote += ' ';
    headerLote += padLeft(company.bancoConta, 12);
    headerLote += ' ';
    headerLote += padLeft(company.bancoContaDV, 1);
    headerLote += padRight(company.nomeEmpresa, 30);
    headerLote += padRight('', 138);
    addLine(headerLote);
    recordCountGlobal++;

    group.payments.forEach((p) => {
      totalValorLote += p.valor;
      const valorStr = Math.round(p.valor * 100).toString();
      const dataPagto = formatDateCNAB(p.dataPagamento);

      if (group.layoutLote === '040' && p.tipo !== '02' && p.tipo !== '04') {
        // --- SEGMENTO A (TED/DOC/PIX) ---
        nsrBatch++;
        let segA = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'A000';
        segA += p.tipo === '06' ? '009' : '018'; // 018=Transferencia, 009=PIX
        segA += padLeft(p.bancoDestino || '000', 3);
        segA += padLeft(p.agenciaDestino || '0', 5) + ' ' + padLeft(p.contaDestino || '0', 12) + padLeft(p.contaDestinoDV || '0', 1) + ' ';
        segA += padRight(p.nomeFavorecido, 30);
        segA += padLeft(p.id.substring(0, 20), 20);
        segA += dataPagto;
        segA += 'REA' + padLeft(0, 8);
        segA += (p.tipo === '06' && p.chavePix) ? '04' : '01';
        segA += padLeft(0, 5) + padLeft(valorStr, 15) + padRight('', 15) + padRight('', 5) + padLeft(0, 8) + padLeft(0, 15);
        segA += padRight('', 20) + padRight('', 6) + padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14) + padRight('', 2) + '00005' + padRight('', 5) + '0' + padRight('', 10);
        addLine(segA);
        recordCountGlobal++;

        if (p.tipo === '06' && p.chavePix) {
          nsrBatch++;
          let segB = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'B000';
          segB += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
          segB += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14);
          segB += padRight('', 30) + padRight(p.descricao, 65) + padRight(p.chavePix || '', 100) + padRight('', 13);
          addLine(segB);
          recordCountGlobal++;
        }
      } else {
        // --- SEGMENTO J (BOLETOS) ---
        nsrBatch++;
        let segJ = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ += '   '; // 015-017: Brancos/Zeros
        segJ += '01';  // 018-019: CÓDIGO DE MOVIMENTO (01 = INCLUSÃO) - CRÍTICO
        
        const barCode = removeNonNumeric(p.codigoBarras || '');
        segJ += padRight(barCode, 44); // 020-063: Código de Barras
        
        segJ += padRight(p.nomeFavorecido, 30); // 064-093
        segJ += formatDateCNAB(p.dataVencimento); // 094-101
        segJ += padLeft(valorStr, 15); // 102-116
        segJ += padLeft(0, 15); // Desconto
        segJ += padLeft(0, 15); // Acréscimo
        segJ += dataPagto; // Data Pagto
        segJ += padLeft(valorStr, 15); // Valor Pagto
        segJ += padLeft(0, 15); // Quantidade
        segJ += padLeft(p.id.substring(0, 20), 20); // Seu Numero
        segJ += padRight('', 38); 
        addLine(segJ);
        recordCountGlobal++;

        // --- SEGMENTO J-52 (OBRIGATÓRIO) ---
        nsrBatch++;
        let segJ52 = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ52 += '   '; // 015-017
        segJ52 += '01';  // 018-019: Movimento
        segJ52 += '52';  // 020-021: Identificador Registro Opcional
        
        // Dados do Pagador (Nós)
        segJ52 += (company.cnpj.length > 11 ? '2' : '1');
        segJ52 += padLeft(removeNonNumeric(company.cnpj), 15); 
        segJ52 += padRight(company.nomeEmpresa, 40);
        
        // Dados do Beneficiário (Favorecido)
        segJ52 += (removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1');
        segJ52 += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 15);
        segJ52 += padRight(p.nomeFavorecido, 40);
        
        segJ52 += padLeft(0, 16); // Sacador Avalista
        segJ52 += padRight('', 93);
        addLine(segJ52);
        recordCountGlobal++;
      }
    });

    let trailerLote = '341' + loteSeq + '5' + padRight('', 9);
    trailerLote += padLeft(nsrBatch + 2, 6);
    trailerLote += padLeft(Math.round(totalValorLote * 100), 18);
    trailerLote += padLeft(0, 18) + padRight('', 171) + padRight('', 10);
    addLine(trailerLote);
    recordCountGlobal++;
  });

  let trailerArq = '341999999' + padRight('', 9) + padLeft(loteCount, 6) + padLeft(recordCountGlobal + 1, 6) + padRight('', 211);
  addLine(trailerArq);

  return lines.join('\r\n') + '\r\n';
};