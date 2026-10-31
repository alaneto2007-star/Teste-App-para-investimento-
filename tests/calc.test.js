// Testes das funções de cálculo. Rode com: node tests/calc.test.js
const assert = require("assert");
const Calc = require("../js/calc.js");
const Dados = require("../js/data.js");

const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

// Taxa mensal equivalente: 12% a.a. ≈ 0,9489% a.m.
perto(Calc.taxaMensal(0.12), 0.009489, 1e-6);

// IR regressivo
assert.strictEqual(Calc.aliquotaIR(6), 0.225);
assert.strictEqual(Calc.aliquotaIR(12), 0.2);
assert.strictEqual(Calc.aliquotaIR(24), 0.175);
assert.strictEqual(Calc.aliquotaIR(25), 0.15);

// Poupança: Selic alta -> 0,5% a.m.; Selic baixa -> 70% da Selic
perto(Calc.taxaPoupanca(0.15), Math.pow(1.005, 12) - 1, 1e-9);
perto(Calc.taxaPoupanca(0.08), 0.056, 1e-9);

// Sem aportes, 12 meses a 10% a.a.: 1000 -> 1100 bruto, IR 20% sobre 100
const r = Calc.simular({ inicial: 1000, mensal: 0, meses: 12, taxaAnual: 0.1, isento: false });
perto(r.bruto, 1100);
perto(r.ir, 20);
perto(r.liquido, 1080);
assert.strictEqual(r.evolucao.length, 13);

// Valor real: 1100 daqui a 1 ano com 10% de inflação = 1000 hoje
perto(Calc.valorReal(1100, 0.1, 12), 1000);
// Sem inflação informada, real = líquido
perto(r.real, r.liquido);
perto(Calc.simular({ inicial: 1000, mensal: 0, meses: 12, taxaAnual: 0.1, isento: true, inflacao: 0.1 }).real, 1000);

// Isento não paga IR
assert.strictEqual(Calc.simular({ inicial: 1000, mensal: 0, meses: 12, taxaAnual: 0.1, isento: true }).ir, 0);

// Taxa zero: só soma os aportes
perto(Calc.simular({ inicial: 100, mensal: 50, meses: 10, taxaAnual: 0, isento: false }).bruto, 600);

// Reserva de emergência
assert.deepStrictEqual(Calc.reservaEmergencia(3000, "clt"), { meses: 6, valor: 18000 });
assert.deepStrictEqual(Calc.reservaEmergencia(3000, "autonomo"), { meses: 12, valor: 36000 });

// Meta: sem juros, 1000/mês para 12000 = 12 meses; inatingível -> null; já atingida -> 0
assert.strictEqual(Calc.mesesParaMeta({ inicial: 0, mensal: 1000, alvo: 12000, taxaAnual: 0 }), 12);
assert.strictEqual(Calc.mesesParaMeta({ inicial: 0, mensal: 0, alvo: 1000, taxaAnual: 0 }), null);
assert.strictEqual(Calc.mesesParaMeta({ inicial: 5000, mensal: 0, alvo: 1000, taxaAnual: 0 }), 0);

// Juro real (Fisher): 15% nominal com 5% de inflação = 9,52%
perto(Calc.juroReal(0.15, 0.05), 0.095238, 1e-6);

// Estatísticas: +100% e -50% => volta ao início, queda máxima -50%
const e = Calc.estatisticas([100, -50]);
perto(e.acumulado, 0, 1e-9);
perto(e.cagr, 0, 1e-9);
perto(e.quedaMax, -0.5, 1e-9);
assert.strictEqual(e.anosNegativos, 1);

// Carteira 50/50 rebalanceada: média ponderada ano a ano
assert.deepStrictEqual(Calc.retornosCarteira({ a: 50, b: 50, c: 0 }, { a: [10, 20], b: [0, -20], c: [99, 99] }), [5, 0]);

// Backtest sem aporte mensal: 1000 com +10% e +10% = 1210; com inflação de 10% a.a. volta a 1000 real
const bt = Calc.backtest({ retornosPct: [10, 10], inicial: 1000, mensal: 0, inflacaoPct: [10, 10] });
perto(bt[2].saldo, 1210);
perto(bt[2].real, 1000);
// Backtest com retorno zero só soma aportes
perto(Calc.backtest({ retornosPct: [0], inicial: 0, mensal: 100 })[1].saldo, 1200);

// Cholesky da matriz de correlação do app reconstrói a matriz
const L = Calc.cholesky(Dados.CORRELACAO);
for (let i = 0; i < L.length; i++)
  for (let j = 0; j < L.length; j++) {
    let s = 0;
    for (let k = 0; k < L.length; k++) s += L[i][k] * L[j][k];
    perto(s, Dados.CORRELACAO[i][j], 1e-9);
  }

// Monte Carlo: 100% CDI quase sem volatilidade => mediana ≈ juros compostos determinísticos
const ids = Dados.CLASSES.map((c) => c.id);
const mcCdi = Calc.monteCarlo({
  alocacao: { cdi: 100 }, premissas: { ...Dados.PREMISSAS, cdi: { ret: 12, vol: 0.01 } }, ids,
  correlacao: Dados.CORRELACAO, inicial: 1000, mensal: 0, anos: 10, sims: 300,
});
perto(mcCdi.final.p50, 1000 * Math.pow(1.12, 10), 1);
assert.strictEqual(mcCdi.probPerda, 0);
// Carteira com cripto: dispersão bem maior e alguma chance de perda
const mcBtc = Calc.monteCarlo({
  alocacao: { btc: 100 }, premissas: Dados.PREMISSAS, ids, correlacao: Dados.CORRELACAO,
  inicial: 1000, mensal: 0, anos: 3, sims: 1000,
});
assert.ok(mcBtc.final.p95 / mcBtc.final.p5 > 10, "BTC deveria ter faixa ampla");
assert.ok(mcBtc.probPerda > 0.2 && mcBtc.probPerda < 0.7);
assert.ok(mcBtc.quedaMediana < -0.4);
// Mesma semente => mesmo resultado
assert.strictEqual(
  Calc.monteCarlo({ alocacao: { btc: 100 }, premissas: Dados.PREMISSAS, ids, correlacao: Dados.CORRELACAO, inicial: 1000, mensal: 0, anos: 3, sims: 1000 }).final.p50,
  mcBtc.final.p50
);

// Perfil
assert.strictEqual(Calc.perfilPorRespostas([0, 0, 0, 0, 0, 0]).id, "conservador");
assert.strictEqual(Calc.perfilPorRespostas([3, 3, 3, 3, 3, 3]).id, "agressivo");
assert.strictEqual(Calc.perfilPorRespostas([2, 1, 1, 2, 2, 1]).id, "moderado");
const semReserva = Calc.perfilPorRespostas([3, 3, 3, 3, 0, 3]);
assert.strictEqual(semReserva.id, "moderado");
assert.ok(semReserva.alerta);
assert.strictEqual(Calc.perfilPorRespostas([0, 3, 3, 3, 3, 3]).id, "conservador");

// Carteiras modelo somam 100%
for (const p of Object.values(Dados.PERFIS)) assert.strictEqual(Object.values(p.alocacao).reduce((a, b) => a + b, 0), 100);

// Rebalancear: aporte vai para a classe abaixo do alvo
const reb = Calc.rebalancear({ a: 800, b: 0 }, { a: 50, b: 50 }, 200);
perto(reb.b, 200);
perto(reb.a, 0);
const reb2 = Calc.rebalancear({ a: 0, b: 0 }, { a: 70, b: 30 }, 1000);
perto(reb2.a, 700);

// Dados: todas as séries têm um valor por ano
for (const c of Dados.CLASSES) assert.strictEqual(c.hist.length, Dados.ANOS.length, c.id);
assert.strictEqual(Dados.IPCA.length, Dados.ANOS.length);

console.log("Todos os testes passaram.");
