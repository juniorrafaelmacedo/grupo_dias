import { Payable, Company } from '../types';
import { padLeft, padRight, removeNonNumeric, formatDateCNAB, formatTimeCNAB } from '../utils/formatters';

interface PaymentGroup {
  forma: string; // 01, 41, 30, 31, etc.
  tipoServico: string; // 20 (Fornecedores), 22 (Tributos), 98 (Diversos)
  layoutLote: string; // 040 (Transferencias), 030 (Boletos/Tributos)
  payments: Payable[];
}

/**
 * Determine SISPAG specific codes based on payment data
 */
const getSispagAttributes = (p: Payable): { forma: string; tipoServico: string; layoutLote: string } => {
  // BOLETOS (02)
  if (p.tipo === '02') {
    const bankCode = p.codigoBarras ? p.codigoBarras.substring(0, 3) : '000';
    const isItau = bankCode === '341';
    return {
      tipoServico: '20', 
      forma: isItau ? '30' : '31', 
      layoutLote: '030' 
    };
  }

  // TRIBUTOS COM COD BARRAS (04)
  if (p.tipo === '04') {
    return {
      tipoServico: '22', 
      forma: '13', 
      layoutLote: '030'
    };
  }

  // PIX (06)
  if (p.tipo === '06') {
    return {
      tipoServico: '20', 
      forma: '45', 
      layoutLote: '040' 
    };
  }

  // TRANSFERENCIAS (01 - TED/DOC/CONTA)
  const destBank = p.bancoDestino || '';
  const isItauDest = destBank === '341';
  
  if (isItauDest) {
    return {
      tipoServico: '20',
      forma: '01', 
      layoutLote: '040' 
    };
  } else {
    return {
      tipoServico: '20',
      forma: '41', 
      layoutLote: '040'
    };
  }
};

/**
 * Generates the CNAB 240 text content strictly following Itau SISPAG v085.
 */
export const generateCNAB240 = (
  company: Company, 
  payments: Payable[],
  fileSequence: number = 1
): string => {
  const lines: string[] = [];
  const now = new Date();
  const dateGeracao = formatDateCNAB(now.toISOString().split('T')[0]);
  const timeGeracao = formatTimeCNAB(now);

  // Group payments
  const groups: Record<string, PaymentGroup> = {};

  payments.forEach(p => {
    const attrs = getSispagAttributes(p);
    const key = `${attrs.tipoServico}-${attrs.forma}-${attrs.layoutLote}`;
    
    if (!groups[key]) {
      groups[key] = { ...attrs, payments: [] };
    }
    groups[key].payments.push(p);
  });

  const addLine = (line: string) => {
    let finalLine = line.substring(0, 240).padEnd(240, ' ');
    lines.push(finalLine);
  };

  let recordCountGlobal = 0;

  // --- ARQUIVO HEADER (Registro 0) --- Manual Pg 12
  let header = '';
  header += '341'; // 001-003: Banco
  header += '0000'; // 004-007: Lote
  header += '0'; // 008-008: Tipo Registro
  header += padRight('', 9); // 009-017: Brancos
  header += company.cnpj.length > 11 ? '2' : '1'; // 018-018: 1=CPF, 2=CNPJ
  header += padLeft(removeNonNumeric(company.cnpj), 14); // 019-032: Inscrição
  header += padRight('', 20); // 033-052: Brancos
  header += padLeft(company.bancoAgencia, 5); // 053-057: Agencia
  header += ' '; // 058-058: Branco
  header += padLeft(company.bancoConta, 12); // 059-070: Conta
  header += ' '; // 071-071: Branco
  header += padLeft(company.bancoContaDV, 1); // 072-072: DAC
  header += padRight(company.nomeEmpresa, 30); // 073-102: Nome Empresa
  header += padRight('BANCO ITAU S.A.', 30); // 103-132: Nome Banco
  header += padRight('', 10); // 133-142: Brancos
  header += '1'; // 143-143: 1=Remessa
  header += dateGeracao; // 144-151: DDMMAAAA
  header += timeGeracao; // 152-157: HHMMSS
  header += padLeft(fileSequence, 6); // 158-163: Número Sequencial do Arquivo (Remessa)
  header += '085'; // 164-166: Versão do Leiaute do Arquivo (CRÍTICO: SISPAG v085)
  header += padLeft(0, 5); // 167-171: Densidade
  header += padRight('', 69); // 172-240: Brancos
  addLine(header);
  recordCountGlobal++;

  // --- PROCESS LOTS ---
  let loteCount = 0;

  Object.values(groups).forEach((group) => {
    loteCount++;
    const loteSeq = padLeft(loteCount, 4);
    let nsrBatch = 0;
    let totalValorLote = 0;

    // --- HEADER DE LOTE (Registro 1) --- Manual Pg 13/25
    let headerLote = '';
    headerLote += '341'; // 001-003
    headerLote += loteSeq; // 004-007
    headerLote += '1'; // 008-008
    headerLote += 'C'; // 009-009: Operação
    headerLote += padLeft(group.tipoServico, 2); // 010-011
    headerLote += padLeft(group.forma, 2); // 012-013
    headerLote += group.layoutLote; // 014-016
    headerLote += ' '; // 017-017
    headerLote += company.cnpj.length > 11 ? '2' : '1'; // 018-018
    headerLote += padLeft(removeNonNumeric(company.cnpj), 14); // 019-032
    headerLote += padRight('', 20); // 033-052
    headerLote += padLeft(company.bancoAgencia, 5); // 053-057
    headerLote += ' '; // 058-058
    headerLote += padLeft(company.bancoConta, 12); // 059-070
    headerLote += ' '; // 071-071
    headerLote += padLeft(company.bancoContaDV, 1); // 072-072
    headerLote += padRight(company.nomeEmpresa, 30); // 073-102
    headerLote += padRight('', 138); // 103-240
    
    addLine(headerLote);
    recordCountGlobal++;
    // O manual diz que NSR no lote começa com o detalhe, Registro 1 não tem campo NSR 009-013.

    // --- DETALHE PAGAMENTOS ---
    group.payments.forEach((p) => {
      totalValorLote += p.valor;
      const valorStr = Math.round(p.valor * 100).toString();
      const dataPagto = formatDateCNAB(p.dataPagamento); 

      if (group.layoutLote === '040') {
        // --- SEGMENTO A (Transferências) ---
        nsrBatch++;
        let segA = '';
        segA += '341';
        segA += loteSeq;
        segA += '3';
        segA += padLeft(nsrBatch, 5); // 009-013: NSR
        segA += 'A';
        segA += '000'; // Inclusão
        
        const isPix = p.tipo === '06';
        segA += isPix ? '009' : '018'; 
        segA += padLeft(p.bancoDestino || '000', 3); 
        
        const agContaBlock = 
          padLeft(p.agenciaDestino || '0', 5) + 
          ' ' + 
          padLeft(p.contaDestino || '0', 12) + 
          padLeft(p.contaDestinoDV || '0', 1) + 
          ' ';
        segA += agContaBlock; 

        segA += padRight(p.nomeFavorecido, 30); 
        segA += padLeft(p.id.substring(0, 20), 20); // Seu Numero
        segA += dataPagto; 
        segA += 'REA'; 
        segA += padLeft(0, 8); 
        
        let tipoTransf = '01'; 
        if (p.tipo === '06' && p.chavePix) tipoTransf = '04'; 
        segA += padLeft(tipoTransf, 2); 

        segA += padLeft(0, 5); 
        segA += padLeft(valorStr, 15); 
        segA += padRight('', 15); 
        segA += padRight('', 5); 
        segA += padLeft(0, 8); 
        segA += padLeft(0, 15); 
        segA += padRight('', 20); 
        segA += padRight('', 6); 
        segA += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14); 
        segA += padRight('', 2); 
        segA += padRight('00005', 5); 
        segA += padRight('', 5); 
        segA += '0'; 
        segA += padRight('', 10); 
        
        addLine(segA);
        recordCountGlobal++;

        // SEGMENTO B (Opcional - mas obrigatório para PIX Chave)
        if (isPix && p.chavePix) {
           nsrBatch++;
           let segB = '';
           segB += '341';
           segB += loteSeq;
           segB += '3';
           segB += padLeft(nsrBatch, 5);
           segB += 'B';
           segB += '000';
           segB += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
           segB += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14);
           segB += padRight('', 30);
           segB += padRight(p.descricao, 65);
           segB += padRight(p.chavePix || '', 100);
           segB += padRight('', 13);
           addLine(segB);
           recordCountGlobal++;
        }

      } else if (group.layoutLote === '030') {
        if (p.tipo === '04') {
           // --- SEGMENTO O (Tributos Barcode) ---
           nsrBatch++;
           let segO = '';
           segO += '341';
           segO += loteSeq;
           segO += '3';
           segO += padLeft(nsrBatch, 5);
           segO += 'O';
           segO += '000';
           segO += padRight(removeNonNumeric(p.codigoBarras || ''), 48);
           segO += padRight(p.nomeFavorecido, 30);
           segO += formatDateCNAB(p.dataVencimento);
           segO += 'REA';
           segO += padLeft(0, 15);
           segO += padLeft(valorStr, 15);
           segO += dataPagto;
           segO += padLeft(0, 15);
           segO += padRight('', 81);
           addLine(segO);
           recordCountGlobal++;
        } else {
           // --- SEGMENTO J (Boletos) ---
           nsrBatch++;
           let segJ = '';
           segJ += '341';
           segJ += loteSeq;
           segJ += '3';
           segJ += padLeft(nsrBatch, 5);
           segJ += 'J';
           segJ += '000';
           
           const barCode = removeNonNumeric(p.codigoBarras || '');
           if (barCode.length >= 44) {
             const bancoFav = barCode.substring(0, 3);
             const moeda = barCode.substring(3, 4);
             const dv = barCode.substring(4, 5);
             const fatorVenc = barCode.substring(5, 9);
             const valorTitulo = barCode.substring(9, 19);
             const campoLivre = barCode.substring(19, 44);
             segJ += padLeft(bancoFav, 3);
             segJ += padLeft(moeda, 1);
             segJ += padLeft(dv, 1);
             segJ += padLeft(fatorVenc, 4);
             segJ += padLeft(valorTitulo, 10);
             segJ += padRight(campoLivre, 25);
           } else {
             segJ += padRight(barCode, 44);
           }
           
           segJ += padRight(p.nomeFavorecido, 30);
           segJ += formatDateCNAB(p.dataVencimento);
           segJ += padLeft(valorStr, 15);
           segJ += padLeft(0, 15);
           segJ += padLeft(0, 15);
           segJ += dataPagto;
           segJ += padLeft(valorStr, 15);
           segJ += padLeft(0, 15);
           segJ += padLeft(p.id.substring(0, 20), 20);
           segJ += padRight('', 38);
           addLine(segJ);
           recordCountGlobal++;

           // --- SEGMENTO J-52 (Obrigatório SISPAG) ---
           nsrBatch++;
           let segJ52 = '';
           segJ52 += '341';
           segJ52 += loteSeq;
           segJ52 += '3';
           segJ52 += padLeft(nsrBatch, 5);
           segJ52 += 'J';
           segJ52 += '000';
           segJ52 += '52'; 
           segJ52 += company.cnpj.length > 11 ? '2' : '1'; 
           segJ52 += padLeft(removeNonNumeric(company.cnpj), 15); 
           segJ52 += padRight(company.nomeEmpresa, 40); 
           segJ52 += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
           segJ52 += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 15);
           segJ52 += padRight(p.nomeFavorecido, 40);
           segJ52 += padLeft(0, 16);
           segJ52 += padRight('', 93);
           addLine(segJ52);
           recordCountGlobal++;
        }
      }
    });

    // --- TRAILER DE LOTE (Registro 5) ---
    let trailerLote = '';
    trailerLote += '341';
    trailerLote += loteSeq;
    trailerLote += '5';
    trailerLote += padRight('', 9);
    // Qtd de registros no lote: 1 Header + N Segmentos + 1 Trailer
    trailerLote += padLeft(nsrBatch + 2, 6); 
    trailerLote += padLeft(Math.round(totalValorLote * 100), 18);
    trailerLote += padLeft(0, 18);
    trailerLote += padRight('', 171);
    trailerLote += padRight('', 10);
    addLine(trailerLote);
    recordCountGlobal++;
  });

  // --- TRAILER DE ARQUIVO (Registro 9) ---
  let trailerArq = '';
  trailerArq += '341';
  trailerArq += '9999';
  trailerArq += '9';
  trailerArq += padRight('', 9);
  trailerArq += padLeft(loteCount, 6); 
  // Qtd de registros no arquivo: Global + o próprio Trailer 9
  trailerArq += padLeft(recordCountGlobal + 1, 6);
  trailerArq += padRight('', 211);
  addLine(trailerArq);

  return lines.join('\r\n') + '\r\n';
};