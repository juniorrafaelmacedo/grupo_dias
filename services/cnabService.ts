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
  // Logic based on Manual SISPAG v085
  
  // BOLETOS (02)
  if (p.tipo === '02') {
    const bankCode = p.codigoBarras ? p.codigoBarras.substring(0, 3) : '000';
    const isItau = bankCode === '341';
    return {
      tipoServico: '20', // Pagamento Fornecedor
      forma: isItau ? '30' : '31', // 30=Boleto Itau, 31=Boleto Outros
      layoutLote: '030' // Manual Pg 25
    };
  }

  // TRIBUTOS COM COD BARRAS (04)
  if (p.tipo === '04') {
    return {
      tipoServico: '22', // Tributos
      forma: '13', // Concessionárias
      layoutLote: '030'
    };
  }

  // PIX (06)
  if (p.tipo === '06') {
    return {
      tipoServico: '20', 
      forma: '45', // PIX Transferência
      layoutLote: '040' 
    };
  }

  // TRANSFERENCIAS (01 - TED/DOC/CONTA)
  const destBank = p.bancoDestino || '';
  const isItauDest = destBank === '341';
  
  if (isItauDest) {
    return {
      tipoServico: '20',
      forma: '01', // Crédito em Conta Corrente no Itaú
      layoutLote: '040' 
    };
  } else {
    return {
      tipoServico: '20',
      forma: '41', // TED Outro Titular (DOC is obsolete)
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
  fileSequence: number
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

  // Helper to ensure line is exactly 240 bytes
  const addLine = (line: string) => {
    // 1. Cut at 240
    let finalLine = line.substring(0, 240);
    // 2. Pad to 240 if short (Critical for Trailer Record)
    finalLine = finalLine.padEnd(240, ' ');
    lines.push(finalLine);
  };

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
  // CORREÇÃO PÁGINA 12: 071 é Branco, 072 é DAC
  header += ' '; // 071-071: Branco
  header += padLeft(company.bancoContaDV, 1); // 072-072: DAC
  header += padRight(company.nomeEmpresa, 30); // 073-102: Nome Empresa
  header += padRight('BANCO ITAU S.A.', 30); // 103-132: Nome Banco
  header += padRight('', 10); // 133-142: Brancos
  header += '1'; // 143-143: 1=Remessa
  header += dateGeracao; // 144-151: DDMMAAAA
  header += timeGeracao; // 152-157: HHMMSS
  header += padLeft(0, 9); // 158-166: Zeros
  header += padLeft(0, 5); // 167-171: Densidade
  header += padRight('', 69); // 172-240: Brancos
  addLine(header);

  // --- PROCESS LOTS ---
  let loteCount = 0;
  let recordCountGlobal = 1;

  Object.values(groups).forEach((group) => {
    loteCount++;
    const loteSeq = padLeft(loteCount, 4);
    let recordCountLote = 0;
    let totalValorLote = 0;

    // --- HEADER DE LOTE (Registro 1) --- Manual Pg 13 (Transfers) or Pg 25 (Boletos)
    let headerLote = '';
    headerLote += '341'; // 001-003
    headerLote += loteSeq; // 004-007
    headerLote += '1'; // 008-008
    headerLote += 'C'; // 009-009: Operação
    headerLote += padLeft(group.tipoServico, 2); // 010-011: Tipo Serviço
    headerLote += padLeft(group.forma, 2); // 012-013: Forma Lançamento
    headerLote += group.layoutLote; // 014-016: Versão Layout
    headerLote += ' '; // 017-017: Branco
    headerLote += company.cnpj.length > 11 ? '2' : '1'; // 018-018
    headerLote += padLeft(removeNonNumeric(company.cnpj), 14); // 019-032
    headerLote += padRight('', 20); // 033-052: Convenio/Brancos
    headerLote += padLeft(company.bancoAgencia, 5); // 053-057
    headerLote += ' '; // 058-058
    headerLote += padLeft(company.bancoConta, 12); // 059-070
    // CORREÇÃO PÁGINA 13/25: 071 é Branco, 072 é DAC
    headerLote += ' '; // 071-071: Branco
    headerLote += padLeft(company.bancoContaDV, 1); // 072-072: DAC
    headerLote += padRight(company.nomeEmpresa, 30); // 073-102
    
    if (group.layoutLote === '040') {
      headerLote += padRight('', 38); // 103-140
      headerLote += padRight('', 40); // 141-180
      headerLote += padRight('', 60); // 181-240
    } else {
      headerLote += padRight('', 38); // 103-140
      headerLote += padRight('', 100); // 141-240
    }
    
    addLine(headerLote);
    recordCountGlobal++;
    recordCountLote++;

    // --- DETALHE PAGAMENTOS ---
    group.payments.forEach((p) => {
      const numRegistro = recordCountLote + 1;
      totalValorLote += p.valor;
      const valorStr = Math.round(p.valor * 100).toString();
      const dataPagto = formatDateCNAB(p.dataPagamento); 

      if (group.layoutLote === '040') {
        // --- SEGMENTO A (Transferências) --- Manual Pg 15
        let segA = '';
        segA += '341'; // 001-003
        segA += loteSeq; // 004-007
        segA += '3'; // 008-008: Detalhe
        segA += padLeft(numRegistro, 5); // 009-013: NSR
        segA += 'A'; // 014-014: Segmento
        segA += '000'; // 015-017: Inclusão
        
        // CORREÇÃO PÁGINA 15:
        // 018-020: CÂMARA (000 ou 018 para TED, 009 para PIX)
        // 021-023: BANCO FAVORECIDO
        const isPix = p.tipo === '06';
        segA += isPix ? '009' : '018'; // 018-020 (Defaulting to 018 for STR/TED, 009 for PIX)
        segA += padLeft(p.bancoDestino || '000', 3); // 021-023: Banco Favorecido
        
        // 024-043: AGENCIA E CONTA (20 chars)
        // Format: Ag(5) + Space(1) + Conta(12) + DAC(1) + Space(1) = 20 chars
        const agContaBlock = 
          padLeft(p.agenciaDestino || '0', 5) + 
          ' ' + 
          padLeft(p.contaDestino || '0', 12) + 
          padLeft(p.contaDestinoDV || '0', 1) + 
          ' ';
        segA += agContaBlock; // 024-043

        segA += padRight(p.nomeFavorecido, 30); // 044-073
        segA += padLeft(p.id, 20); // 074-093: Seu Numero
        segA += dataPagto; // 094-101: Data Pagamento
        segA += 'REA'; // 102-104: Moeda
        segA += padLeft(0, 8); // 105-112: ISPB (Zeros default)
        
        // 113-114: Tipo Transferencia (01=CC, 03=Poup, 04=Chave Pix, etc)
        // Se PIX Chave (tipo 06 + chavePix preenchida)
        let tipoTransf = '01'; // Default CC
        if (p.tipo === '06' && p.chavePix) tipoTransf = '04'; // Chave Pix
        segA += padLeft(tipoTransf, 2); // 113-114

        segA += padLeft(0, 5); // 115-119: Zeros
        segA += padLeft(valorStr, 15); // 120-134: Valor Pagto
        segA += padRight('', 15); // 135-149: Nosso Numero (Banco)
        segA += padRight('', 5); // 150-154: Brancos
        segA += padLeft(0, 8); // 155-162: Data Efetiva
        segA += padLeft(0, 15); // 163-177: Valor Efetivo
        
        // 178-197: Finalidade Detalhe
        segA += padRight('', 20); // 178-197
        
        segA += padRight('', 6); // 198-203: Nr Doc
        
        // 204-217: Inscricao Favorecido
        segA += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14); // 204-217
        
        segA += padRight('', 2); // 218-219: Finalidade Doc
        segA += padRight('00005', 5); // 220-224: Finalidade TED (00005 = Crédito em Conta / Pagto Fornecedor)
        segA += padRight('', 5); // 225-229: Brancos
        segA += '0'; // 230-230: Aviso
        segA += padRight('', 10); // 231-240: Ocorrencias
        
        addLine(segA);
        recordCountGlobal++;
        recordCountLote++;

        // SEGMENTO B (Opcional - mas obrigatório para PIX Chave)
        if (isPix && p.chavePix) {
           recordCountLote++; // Increment for Seg B
           
           let segB = '';
           segB += '341';
           segB += loteSeq;
           segB += '3';
           segB += padLeft(recordCountLote, 5); // Increment NSR
           segB += 'B';
           segB += '000'; // Inclusão
           
           // PIX Specific fields for Seg B (Pg 18)
           // 018-018: Tipo Inscricao Favorecido
           segB += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1';
           segB += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 14); // 019-032
           segB += padRight('', 30); // 033-062
           
           // 063-127: Mensagem / Info (Opcional)
           segB += padRight(p.descricao, 65); // Info
           
           // 128-227: Chave PIX (100 chars)
           segB += padRight(p.chavePix || '', 100);
           
           segB += padRight('', 13); // 228-240 (Brancos + Ocorrencias)
           
           addLine(segB);
           recordCountGlobal++;
        }

      } else if (group.layoutLote === '030') {
        if (p.tipo === '04') {
           // --- SEGMENTO O (Tributos Barcode) --- Manual Pg 34
           let segO = '';
           segO += '341';
           segO += loteSeq;
           segO += '3';
           segO += padLeft(numRegistro, 5);
           segO += 'O';
           segO += '000';
           segO += padRight(removeNonNumeric(p.codigoBarras || ''), 48); // 018-065
           segO += padRight(p.nomeFavorecido, 30); // 066-095
           segO += formatDateCNAB(p.dataVencimento); // 096-103: Vencimento
           segO += 'REA'; // 104-106
           segO += padLeft(0, 15); // 107-121: Qtd Moeda
           segO += padLeft(valorStr, 15); // 122-136: Valor a Pagar
           segO += dataPagto; // 137-144: Data Pagamento
           segO += padLeft(0, 15); // 145-159
           segO += padRight('', 40); // 160-199
           segO += padRight('', 41); // 200-240
           addLine(segO);
           recordCountGlobal++;
           recordCountLote++;
        } else {
           // --- SEGMENTO J (Boletos) --- Manual Pg 26
           let segJ = '';
           segJ += '341';
           segJ += loteSeq;
           segJ += '3';
           segJ += padLeft(numRegistro, 5);
           segJ += 'J';
           segJ += '000';
           
           const barCode = removeNonNumeric(p.codigoBarras || '');
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
           
           segJ += padRight(p.nomeFavorecido, 30);
           segJ += formatDateCNAB(p.dataVencimento); // 092-099
           segJ += padLeft(valorStr, 15); // 100-114: Valor Titulo
           segJ += padLeft(0, 15); // 115-129
           segJ += padLeft(0, 15); // 130-144
           segJ += dataPagto; // 145-152
           segJ += padLeft(valorStr, 15); // 153-167
           segJ += padLeft(0, 15); // 168-182
           segJ += padLeft(p.id, 20); // 183-202
           segJ += padRight('', 38); // 203-240
           addLine(segJ);
           recordCountGlobal++;
           recordCountLote++;

           // --- SEGMENTO J-52 (Obrigatório) --- Manual Pg 27
           recordCountLote++;
           let segJ52 = '';
           segJ52 += '341';
           segJ52 += loteSeq;
           segJ52 += '3';
           segJ52 += padLeft(recordCountLote, 5); // Correct NSR sequence
           segJ52 += 'J';
           segJ52 += '000';
           segJ52 += '52'; // 018-019
           
           // SACADO (Sua empresa)
           segJ52 += company.cnpj.length > 11 ? '2' : '1'; // 020
           segJ52 += padLeft(removeNonNumeric(company.cnpj), 15); // 021-035
           segJ52 += padRight(company.nomeEmpresa, 40); // 036-075
           
           // CEDENTE (Favorecido)
           segJ52 += removeNonNumeric(p.cpfCnpjFavorecido).length > 11 ? '2' : '1'; // 076
           segJ52 += padLeft(removeNonNumeric(p.cpfCnpjFavorecido), 15); // 077-091
           segJ52 += padRight(p.nomeFavorecido, 40); // 092-131
           
           segJ52 += padLeft(0, 16); // 132-147
           segJ52 += padRight('', 40); // 148-187
           segJ52 += padRight('', 53); // 188-240
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
    trailerLote += padRight('', 9); // 009-017
    
    // 018-023: Qtd Registros (Includes HeaderLote + Details + TrailerLote)
    // recordCountLote has accumulated Headers + Details. So add 1 for TrailerLote.
    trailerLote += padLeft(recordCountLote + 1, 6); 
    
    trailerLote += padLeft(Math.round(totalValorLote * 100), 18); // 024-041: Total Valor
    
    if (group.layoutLote === '030') {
      // Manual Pg 36 (Boletos/Tributos)
      trailerLote += padLeft(0, 15); // 042-056: Qtd Moeda
      trailerLote += padRight('', 174); // 057-230: Brancos
    } else {
      // Manual Pg 24 (Transferencias)
      trailerLote += padLeft(0, 18); // 042-059: Zeros
      trailerLote += padRight('', 171); // 060-230: Brancos
    }
    
    trailerLote += padRight('', 10); // 231-240: Ocorrencias
    addLine(trailerLote);
    recordCountGlobal++;
  });

  // --- TRAILER DE ARQUIVO (Registro 9) ---
  let trailerArq = '';
  trailerArq += '341';
  trailerArq += '9999';
  trailerArq += '9';
  trailerArq += padRight('', 9); // 009-017
  trailerArq += padLeft(loteCount, 6); // 018-023: Qtd Lotes
  trailerArq += padLeft(recordCountGlobal + 1, 6); // 024-029: Qtd Regs (Global + Trailer)
  trailerArq += padRight('', 211); // 030-240
  addLine(trailerArq);

  return lines.join('\r\n') + '\r\n'; // Ensure file ends with newline
};