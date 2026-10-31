// Funções de cálculo financeiro (sem dependências).
// Funciona no navegador (window.Calc) e no Node (module.exports), para testes.

(function (root) {
  // Converte taxa anual (ex.: 0.15 = 15% a.a.) em taxa mensal equivalente.
  function taxaMensal(taxaAnual) {
    return Math.pow(1 + taxaAnual, 1 / 12) - 1;
  }

  // Alíquota de IR regressivo da renda fixa, pelo prazo em meses (~30 dias cada).
  function aliquotaIR(meses) {
    const dias = meses * 30;
    if (dias <= 180) return 0.225;
    if (dias <= 360) return 0.2;
    if (dias <= 720) return 0.175;
    return 0.15;
  }

  // Rendimento anual da poupança: 0,5% a.m. se Selic > 8,5%; senão 70% da Selic (TR ignorada).
  function taxaPoupanca(selicAnual) {
    if (selicAnual > 0.085) return Math.pow(1.005, 12) - 1;
    return 0.7 * selicAnual;
  }

  // Valor futuro trazido para "reais de hoje", descontando a inflação anual.
  function valorReal(valor, inflacaoAnual, meses) {
    return valor / Math.pow(1 + inflacaoAnual, meses / 12);
  }

  // Simula aportes mensais com juros compostos.
  // Retorna a evolução mês a mês e o resultado final (bruto, IR, líquido e valor real).
  function simular({ inicial, mensal, meses, taxaAnual, isento, inflacao = 0 }) {
    const i = taxaMensal(taxaAnual);
    let saldo = inicial;
    let investido = inicial;
    const evolucao = [{ mes: 0, saldo, investido }];
    for (let m = 1; m <= meses; m++) {
      saldo = saldo * (1 + i) + mensal;
      investido += mensal;
      evolucao.push({ mes: m, saldo, investido });
    }
    const lucro = saldo - investido;
    const ir = isento || lucro <= 0 ? 0 : lucro * aliquotaIR(meses);
    const real = valorReal(saldo - ir, inflacao, meses);
    return {
      evolucao,
      investido,
      bruto: saldo,
      ir,
      liquido: saldo - ir,
      lucroLiquido: lucro - ir,
      real, // valor líquido em reais de hoje
    };
  }

  // Monta os produtos comparados a partir das taxas informadas.
  function produtos({ selic, cdi, pctCdb, pctLci }) {
    return [
      { id: "poupanca", nome: "Poupança", taxaAnual: taxaPoupanca(selic), isento: true },
      { id: "selic", nome: "Tesouro Selic", taxaAnual: selic, isento: false },
      { id: "cdb", nome: `CDB ${Math.round(pctCdb * 100)}% CDI`, taxaAnual: cdi * pctCdb, isento: false },
      { id: "lci", nome: `LCI/LCA ${Math.round(pctLci * 100)}% CDI`, taxaAnual: cdi * pctLci, isento: true },
    ];
  }

  // Reserva de emergência recomendada: gastos mensais x meses (6 para CLT, 12 para autônomo).
  function reservaEmergencia(gastoMensal, perfil) {
    const meses = perfil === "autonomo" ? 12 : perfil === "publico" ? 3 : 6;
    return { meses, valor: gastoMensal * meses };
  }

  // Quantos meses para atingir um valor-alvo com aportes mensais.
  function mesesParaMeta({ inicial, mensal, alvo, taxaAnual }) {
    const i = taxaMensal(taxaAnual);
    let saldo = inicial;
    let m = 0;
    while (saldo < alvo) {
      if (m >= 1200) return null; // > 100 anos: inatingível na prática
      saldo = saldo * (1 + i) + mensal;
      m++;
    }
    return m;
  }

  const Calc = { taxaMensal, valorReal, aliquotaIR, taxaPoupanca, simular, produtos, reservaEmergencia, mesesParaMeta };

  if (typeof module !== "undefined" && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(typeof window !== "undefined" ? window : globalThis);
