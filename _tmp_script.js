const classesSingular = ['', 'mil', 'milhão', 'bilhão', 'trilhão'];
const classesPlural = ['', 'mil', 'milhões', 'bilhões', 'trilhões'];
const centenasExtenso = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const dezenasExtrasExtenso = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenasExtenso = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const unidadesExtenso = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

function converterBloco(numero) {
  if (numero === 0) return '';
  if (numero === 100) return 'cem';

  const c = Math.floor(numero / 100);
  const d = Math.floor((numero % 100) / 10);
  const u = numero % 10;

  const partes = [];

  if (c > 0) partes.push(centenasExtenso[c]);

  if (d === 1) {
    partes.push(dezenasExtrasExtenso[u]);
  } else {
    if (d > 1) partes.push(dezenasExtenso[d]);
    if (u > 0) partes.push(unidadesExtenso[u]);
  }

  return partes.join(' e ');
}

function valorPorExtenso(valor) {
  if (valor === null || valor === undefined || isNaN(valor) || valor === 0) {
    return 'zero real';
  }

  let valorNumerico = typeof valor === 'string' ?
    parseFloat(valor.replace(/\./g, '').replace(',', '.')) :
    Number(valor);
    
  valorNumerico = Math.round(Number(valorNumerico) * 100) / 100;

  if (isNaN(valorNumerico) || valorNumerico === 0) return 'zero real';

  const inteiro = Math.floor(valorNumerico);
  const centavos = Math.round((valorNumerico - inteiro) * 100);

  let extenso = '';

  if (inteiro > 0) {
    const blocos = [];
    let temp = inteiro;
    while (temp > 0) {
      blocos.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }

    const partesPluralizadas = [];
    for (let i = 0; i < blocos.length; i++) {
        const bloco = blocos[i];
        if (bloco === 0) continue;

        let strBloco = converterBloco(bloco);

        if (i === 1 && bloco === 1) {
            strBloco = 'um'; // O comum é "um mil", não apenas "mil"
        }

        const sufixo = (bloco === 1) ? classesSingular[i] : classesPlural[i];
        
        let blocoCompleto = strBloco;
        if (sufixo) {
            blocoCompleto += ' ' + sufixo;
        }
        
        partesPluralizadas.unshift({texto: blocoCompleto, valor: bloco});
    }

    // Unindo partes
    if (partesPluralizadas.length === 1) {
        extenso = partesPluralizadas[0].texto;
    } else {
        let juncao = partesPluralizadas[0].texto;
        
        for (let i = 1; i < partesPluralizadas.length; i++) {
            const parteAtual = partesPluralizadas[i];
            
            // "e" usado quando é < 100 ou quando é múltiplo de cem
            if (parteAtual.valor < 100 || parteAtual.valor % 100 === 0) {
               juncao += ' e ' + parteAtual.texto;
            } else {
               juncao += ', ' + parteAtual.texto;
            }
        }
        extenso = juncao;
    }

    // Regra do "de reais"
    let sufixoMoeda = 'reais';
    if (inteiro === 1) {
        sufixoMoeda = 'real';
    } else {
        if (blocos.length > 1) {
            let ehRedondo = true;
            for(let i=0; i<blocos.length-1; i++) { 
                if(blocos[i] > 0) {
                    ehRedondo = false;
                    break;
                }
            }
            if(ehRedondo) sufixoMoeda = 'de reais';
        }
    }

    extenso += ' ' + sufixoMoeda;
  }

  if (centavos > 0) {
    if (extenso) extenso += ' e ';
    
    let strCentavos = converterBloco(centavos);
    
    if (centavos === 1) {
      extenso += strCentavos + ' centavo';
    } else {
      extenso += strCentavos + ' centavos';
    }
  }

  return extenso;
}

console.log("1575,00 ->", valorPorExtenso(1575.00));
console.log("10,00 ->", valorPorExtenso(10.00));
console.log("1200,50 ->", valorPorExtenso(1200.50));
console.log("1.000.000,00 ->", valorPorExtenso(1000000));
console.log("1000,00 ->", valorPorExtenso(1000));
console.log("0,50 ->", valorPorExtenso(0.50));
console.log("2015 ->", valorPorExtenso(2015));
console.log("2500 ->", valorPorExtenso(2500));
console.log("1.250.040,15 ->", valorPorExtenso(1250040.15));
