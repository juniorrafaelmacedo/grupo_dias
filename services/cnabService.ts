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
    // SISPAG v085 utiliza layout 040 para quase todos os lotes de pagamento
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

  // --- HEADER DE ARQUIVO (Registro 0) - Manual Pág 12 ---
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
  header += '1'; // Remessa
  header += dateGeracao;
  header += timeGeracao;
  header += padLeft(fileSequence, 6);
  header += '085'; // Versão v085
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

    // --- HEADER DE LOTE (Registro 1) - Manual Pág 13/25 ---
    let headerLote = '341' + loteSeq + '1C';
    headerLote += padLeft(group.tipoServico, 2);
    headerLote += padLeft(group.forma, 2);
    headerLote += '040'; // Versão do Lote v085
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
      const dataVenc = formatDateCNAB(p.dataVencimento);

      if (group.layoutLote === '040' && p.tipo !== '02' && p.tipo !== '04') {
        // --- SEGMENTO A (TED/DOC/PIX) ---
        nsrBatch++;
        let segA = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'A';
        segA += '000'; // 015-017: Movimento (Inclusão)
        segA += p.tipo === '06' ? '009' : '018'; 
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
          let segB = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'B';
          segB += '000'; // 15-17
          segB += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
          segB += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14);
          segB += padRight('', 30) + padRight(p.descricao, 65) + padRight(p.chavePix || '', 100) + padRight('', 13);
          addLine(segB);
          recordCountGlobal++;
        }
      } else {
        // --- SEGMENTO J (BOLETOS) - Manual Pág 26 ---
        nsrBatch++;
        let segJ = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ += '000'; // 015-017: TIPO DE MOVIMENTO (Nota 10)
        
        const barCode = removeNonNumeric(p.codigoBarras || '');
        segJ += padRight(barCode, 44); // 018-061: Código de Barras (44 posições)
        
        segJ += '00'; // 062-063: Complemento
        segJ += padRight(p.nomeFavorecido, 30); // 064-093: Nome Favorecido
        segJ += dataVenc; // 094-101: Data Vencimento
        segJ += padLeft(valorStr, 15); // 102-116: Valor Título
        segJ += padLeft(0, 15); // 117-131: Descontos
        segJ += padLeft(0, 15); // 132-146: Acréscimos
        segJ += dataPagto; // 147-154: Data Pagamento
        segJ += padLeft(valorStr, 15); // 155-169: Valor Pagamento
        segJ += padLeft(0, 15); // 170-184: Quantidade Moeda
        segJ += padLeft(p.id.substring(0, 20), 20); // 185-204: Seu Número
        segJ += padRight('', 13); // 205-217: Brancos
        segJ += padLeft(0, 15); // 218-232: Nosso Número
        segJ += padRight('', 8); // 233-240: Ocorrências
        addLine(segJ);
        recordCountGlobal++;

        // --- SEGMENTO J-52 (OBRIGATÓRIO) - Manual Pág 27 ---
        nsrBatch++;
        let segJ52 = '341' + loteSeq + '3' + padLeft(nsrBatch, 5) + 'J';
        segJ52 += '000'; // 015-017: Movimento
        segJ52 += '52';  // 018-019: Identificador Registro Opcional (52)
        
        // Dados do Sacado (Nós)
        segJ52 += (company.cnpj.length > 11 ? '2' : '1'); // 020: Tipo Inscrição
        segJ52 += padLeft(removeNonNumeric(company.cnpj), 15); // 021-035: Inscrição
        segJ52 += padRight(company.nomeEmpresa, 40); // 036-075: Nome
        
        // Dados do Beneficiário (Favorecido)
        segJ52 += (removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1'); // 076: Tipo
        segJ52 += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 15); // 077-091: Inscrição
        segJ52 += padRight(p.nomeFavorecido, 40); // 092-131: Nome
        
        segJ52 += '0'; // 132: Tipo Sacador Avalista
        segJ52 += padLeft(0, 15); // 133-147: Inscrição Avalista
        segJ52 += padRight('', 40); // 148-187: Nome Avalista
        segJ52 += padRight('', 53); // 188-240: Brancos
        addLine(segJ52);
        recordCountGlobal++;
      }
    });

    // --- TRAILER DE LOTE (Registro 5) - Manual Pág 24 ---
    let trailerLote = '341' + loteSeq + '5';
    trailerLote += padRight('', 9); // 009-017
    trailerLote += padLeft(nsrBatch + 2, 6); // 018-023: Qtd registros (Header + Details + Trailer)
    trailerLote += padLeft(Math.round(totalValorLote * 100), 18); // 024-041: Soma valores
    trailerLote += padLeft(0, 18); // 042-059: Soma Qtd moedas
    trailerLote += padRight('', 171); // 060-230: Brancos
    trailerLote += padRight('', 10); // 231-240: Ocorrências
    addLine(trailerLote);
    recordCountGlobal++;
  });

  // --- TRAILER DE ARQUIVO (Registro 9) - Manual Pág 43 ---
  let trailerArq = '34199999'; // 001-008: Banco + Lote + Registro
  trailerArq += padRight('', 9); // 009-017
  trailerArq += padLeft(loteCount, 6); // 018-023: Qtd Lotes
  trailerArq += padLeft(recordCountGlobal + 1, 6); // 024-029: Qtd Total Registros (incluindo o trailer 9)
  trailerArq += padRight('', 211); // 030-240: Brancos
  addLine(trailerArq);

  return lines.join('\r\n') + '\r\n';
};