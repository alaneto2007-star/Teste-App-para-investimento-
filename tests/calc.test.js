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

// ---------- Novos: % do CDI diário, plano com teto, IR por aporte, projeção real com IR ----------
// 100% do CDI = o próprio CDI; 115% de 14,9% ≈ 17,36% (sobre a taxa diária), maior que 1,15 × 14,9% = 17,135%
perto(Calc.taxaPctCDI(0.149, 100), 0.149, 1e-12);
perto(Calc.taxaPctCDI(0.149, 115), 0.1736, 0.0005);
assert.ok(Calc.taxaPctCDI(0.149, 115) > 0.149 * 1.15);

const mkt = { cdi: 0.149, selic: 0.15 };
const [poup, selic, cdb100, turbo, lci] = Dados.PRODUTOS_RF;
// Equivalência líquida: CDB 100% por 3 anos ≈ 87,4% do CDI líquido (o IR só é pago no resgate, então
// o valor do imposto também rende até lá; por isso fica acima da regra de bolso de 85%). LCI 90% isenta = 90%.
const bruto3 = Math.pow(1.149, 3), liq3 = Math.pow(1 + (bruto3 - 1) * 0.85, 1 / 3) - 1;
perto(Calc.equivalenteLiquido(cdb100, 36, mkt), ((Math.pow(1 + liq3, 1 / 252) - 1) / (Math.pow(1.149, 1 / 252) - 1)) * 100, 1e-9);
perto(Calc.equivalenteLiquido(cdb100, 36, mkt), 87.4, 0.1);
perto(Calc.equivalenteLiquido(lci, 36, mkt), 90, 0.01);
// Em 3 meses, 115% tributado a 22,5% fica abaixo de 90% isento
assert.ok(Calc.equivalenteLiquido(turbo, 3, mkt) < 90);

// Plano: R$ 20 mil em 12 meses com teto de R$ 5 mil na caixinha 115%: só 5 mil vão para ela
const plano = Calc.simularPlano({ produtos: [cdb100, turbo], inicial: 20000, mensal: 0, meses: 12, ...mkt });
const pTurbo = plano.porProduto.find((p) => p.prod.id === "turbo");
const pCdb = plano.porProduto.find((p) => p.prod.id === "cdb100");
perto(pTurbo.aportado, 5000);
perto(pCdb.aportado, 15000);
assert.strictEqual(plano.porProduto[0].prod.id, "turbo"); // melhor taxa vem primeiro
// Caixinha sozinha com R$ 20 mil: 5 mil a 115% e 15 mil a 100% => igual ao plano acima
const sozinho = Calc.simularPlano({ produtos: [turbo], inicial: 20000, mensal: 0, meses: 12, ...mkt, distribuir: false });
perto(sozinho.bruto, plano.bruto, 0.5);
// IR: 1 ano => 20% sobre o ganho
perto(pCdb.ir, (pCdb.bruto - 15000) * 0.2, 0.01);
// Sem aportes mensais o resultado bate com a fórmula fechada
perto(pCdb.bruto, 15000 * 1.149, 0.01);
// Aporte feito no último mês paga 22,5% e o inicial paga a faixa do prazo total
const lotes = Calc.simularPlano({ produtos: [cdb100], inicial: 1000, mensal: 1000, meses: 30, ...mkt });
assert.ok(lotes.ir > 0 && lotes.liquido < lotes.bruto);
// LCI com carência de 12 meses fica de fora num prazo de 6 meses
const curto = Calc.simularPlano({ produtos: [lci, cdb100], inicial: 1000, mensal: 0, meses: 6, ...mkt });
assert.strictEqual(curto.porProduto.length, 1);
assert.strictEqual(curto.foraPorCarencia[0].id, "lci");

// Backtest com custo de 1% a.a.: 1000 a +10% por 1 ano => 1089
perto(Calc.backtest({ retornosPct: [10], inicial: 1000, mensal: 0, custoPct: 1 })[1].saldo, 1089);

// Projeção real: juro real 0%, inflação 10%, IR 15% => o IR sobre a inflação gera perda real
const pr = { ...Dados.PREMISSAS, cdi: { ret: 0, vol: 0.001, custo: 0, ir: 15 } };
const sem = Calc.monteCarlo({ alocacao: { cdi: 100 }, premissas: pr, ids, correlacao: Dados.CORRELACAO, inicial: 1000, mensal: 0, anos: 1, inflacao: 10, sims: 200 });
perto(sem.final.p50, 1000, 0.5);
const com = Calc.monteCarlo({ alocacao: { cdi: 100 }, premissas: pr, ids, correlacao: Dados.CORRELACAO, inicial: 1000, mensal: 0, anos: 1, inflacao: 10, descontarIR: true, sims: 200 });
perto(com.final.p50, (1100 - 15) / 1.1, 0.5); // 986,36 em reais de hoje
assert.ok(com.probPerda > 0.9);
// Custo de 1% a.a. reduz o retorno real na mesma proporção
const custo = Calc.monteCarlo({ alocacao: { cdi: 100 }, premissas: { ...pr, cdi: { ret: 0, vol: 0.001, custo: 1, ir: 0 } }, ids, correlacao: Dados.CORRELACAO, inicial: 1000, mensal: 0, anos: 1, sims: 200 });
perto(custo.final.p50, 990, 0.5);

// ---------- Apps e corretoras: novos tipos, custódia, custos e FGC ----------
const mk2 = { cdi: 0.149, selic: 0.15, ipca: 0.045 };
const pre = { tipo: "prefixado", pct: 12 };
const ipcaMais = { tipo: "ipca", pct: 7 };
perto(Calc.taxaProduto(pre, mk2), 0.12, 1e-12);
perto(Calc.taxaProduto(ipcaMais, mk2), 1.045 * 1.07 - 1, 1e-12); // 11,815%
perto(Calc.taxaProduto({ ...pre, custodia: 0.2 }, mk2), 1.12 * 0.998 - 1, 1e-12);
assert.ok(Calc.taxaProduto({ ...cdb100, custodia: 0.2 }, mk2) < Calc.taxaProduto(cdb100, mk2));
// Sem IPCA informado, IPCA+ rende só o juro real
perto(Calc.taxaProduto(ipcaMais, { cdi: 0.149, selic: 0.15 }), 0.07, 1e-12);
// Equivalência de um IPCA+ isento de IR = taxa / CDI (em base diária)
const eqIpca = Calc.equivalenteLiquido({ ...ipcaMais, isento: true }, 24, mk2);
const dd = (x) => Math.pow(1 + x, 1 / 252) - 1;
perto(eqIpca, (dd(1.045 * 1.07 - 1) / dd(0.149)) * 100, 1e-9);
// Plano com IPCA+ usa o IPCA informado
const planoIpca = Calc.simularPlano({ produtos: [{ ...ipcaMais, id: "x", nome: "IPCA+", isento: true, teto: 0, carencia: 0 }], inicial: 1000, mensal: 0, meses: 12, ...mk2 });
perto(planoIpca.bruto, 1000 * 1.045 * 1.07, 0.01);
// Liquidez diária
assert.strictEqual(Calc.temLiquidezDiaria(cdb100), true);
assert.strictEqual(Calc.temLiquidezDiaria(lci), false);
assert.strictEqual(Calc.temLiquidezDiaria(pre), false);
assert.strictEqual(Calc.temLiquidezDiaria(selic), true);

// Custos: 2 compras de R$ 1.000 por mês, sem corretagem => só B3 (0,03% de R$ 24 mil = R$ 7,20 por ano)
const ca = Calc.custoAcoes({ valorOrdem: 1000, ordensMes: 2 });
perto(ca.total, 7.2, 1e-9);
perto(ca.pctAportes, 0.03, 1e-9);
// Corretagem de R$ 5 por ordem e custódia de 0,1% sobre R$ 10 mil
perto(Calc.custoAcoes({ valorOrdem: 1000, ordensMes: 2, saldo: 10000, corretagem: 5, custodiaPct: 0.1 }).total, 7.2 + 120 + 10, 1e-9);
// Cripto: 1% na compra e 1% na venda => R$ 19,90 em R$ 1.000
perto(Calc.custoCripto({ valor: 1000, taxaPct: 1 }).custo, 19.9, 1e-9);
// Exterior: IOF 1,1% e spread 1% sobre R$ 1.000 => chega R$ 979,11; com dólar a R$ 5, US$ 195,82
const ex = Calc.custoExterior({ valor: 1000, spreadPct: 1, iofPct: 1.1, dolar: 5 });
perto(ex.chega, 1000 * 0.989 * 0.99, 1e-9);
perto(ex.emDolar, (1000 * 0.989 * 0.99) / 5, 1e-9);

// FGC: R$ 150 mil + R$ 150 mil no mesmo emissor passam do limite; Tesouro não conta
const fgc = Calc.concentracaoFGC([
  { prod: { id: "a", nome: "CDB A", emissor: "Banco X" }, bruto: 150000 },
  { prod: { id: "b", nome: "LCI A", emissor: "banco x" }, bruto: 150000 },
  { prod: { id: "c", nome: "CDB B", emissor: "" }, bruto: 200000 },
  { prod: { id: "d", nome: "Tesouro", emissor: "Tesouro Nacional" }, bruto: 900000 },
]);
assert.strictEqual(fgc.length, 2);
assert.strictEqual(fgc[0].valor, 300000);
assert.strictEqual(fgc[0].excede, true);
assert.strictEqual(fgc[1].excede, false);

// Título com vencimento: prefixado de 12% que vence em 12 meses, num prazo de 24 meses com CDI de 10%
// => 12% no 1º ano e o CDI no 2º; aportes depois do vencimento vão para o próximo produto.
const mk3 = { cdi: 0.10, selic: 0.10, ipca: 0.04 };
const preVence = { id: "pv", nome: "Prefixado 12 meses", tipo: "prefixado", pct: 12, isento: false, teto: 0, pctAcima: 100, carencia: 12, vencimento: "01/01/2028" };
const cdbRef = { id: "cr", nome: "CDB", tipo: "cdi", pct: 100, isento: false, teto: 0, pctAcima: 100, carencia: 0 };
const venc = Calc.simularPlano({ produtos: [preVence], inicial: 1000, mensal: 0, meses: 24, ...mk3, distribuir: false });
perto(venc.bruto, 1000 * 1.12 * 1.10, 0.01);
perto(Calc.equivalenteLiquido(preVence, 24, mk3), Calc.equivalenteLiquido({ ...preVence, vencimento: undefined, carencia: 0, tipo: "cdi", pct: 100 }, 24, { ...mk3, cdi: Math.sqrt(1.12 * 1.10) - 1 }) * (Math.pow(Math.sqrt(1.12 * 1.10), 1 / 252) - 1) / (Math.pow(1.10, 1 / 252) - 1), 1e-6);
const vencPlano = Calc.simularPlano({ produtos: [preVence, cdbRef], inicial: 1000, mensal: 100, meses: 24, ...mk3 });
perto(vencPlano.porProduto.find((x) => x.prod.id === "pv").aportado, 1000 + 100 * 11, 1e-9); // aportes até o mês 11
perto(vencPlano.porProduto.find((x) => x.prod.id === "cr").aportado, 100 * 13, 1e-9); // do mês 12 em diante

// Dados das plataformas: ids únicos e ofertas conhecidas
const idsPlat = Dados.PLATAFORMAS.map((p) => p.id);
assert.strictEqual(new Set(idsPlat).size, idsPlat.length);
for (const p of Dados.PLATAFORMAS) for (const o of p.oferece) assert.ok(Dados.OFERTAS[o], p.id + ": " + o);
for (const p of Dados.PRODUTOS_RF) assert.ok(!p.plataforma || idsPlat.includes(p.plataforma), p.id);

// ---------- Manual e backup ----------
// R$ 10 mil a 12% a.a., IR de 15% => R$ 80,65 por mês
perto(Calc.rendaMensal({ valor: 10000, taxaAnual: 0.12, ir: 0.15 }), 10000 * (Math.pow(1.12, 1 / 12) - 1) * 0.85, 1e-9);
perto(Calc.rendaMensal({ valor: 10000, taxaAnual: 0.12, ir: 0.15 }), 80.65, 0.01);
assert.strictEqual(Calc.rendaMensal({ valor: 10000, taxaAnual: 0 }), 0);

// Ida e volta do código de backup, com acentos e números
const dadosTeste = { perfil: { id: "moderado", respostas: [1, 2, 3, 0, 2, 1] }, carteira: { itens: [{ nome: "Tesouro IPCA+ 2045 — ação", classe: "ipca", valor: 1234.56 }], exemplo: false }, objetivo: "reserva" };
const codigo = Calc.exportarCodigo(dadosTeste);
assert.ok(codigo.startsWith("IS1:"));
assert.deepStrictEqual(Calc.importarCodigo(codigo), dadosTeste);
assert.deepStrictEqual(Calc.importarCodigo("  " + codigo.slice(0, 20) + "\n" + codigo.slice(20) + "  "), dadosTeste); // quebras de linha coladas
assert.throws(() => Calc.importarCodigo("abc"), /precisa começar com IS1/);
assert.throws(() => Calc.importarCodigo("IS1:!!!não é base64"), /incompleto ou foi alterado/);
assert.throws(() => Calc.importarCodigo(codigo.slice(0, codigo.length - 8)), /incompleto ou foi alterado/);
assert.throws(() => Calc.importarCodigo(Calc.exportarCodigo([1, 2])), /não tem dados/);

// Dados do manual: termos com definição, investimentos com mecanismo e rota válidos
for (const [id, g] of Object.entries(Dados.GLOSSARIO)) assert.ok(g.termo && g.def.length > 20, id);
const mecs = Dados.MANUAL_MECANISMOS.map((m) => m.id);
const rotasApp = ["visao", "perfil", "projecao", "historico", "cripto", "renda-fixa", "onde-investir", "apps", "carteira", "manual"];
for (const inv of Dados.MANUAL_INVESTIMENTOS) {
  assert.ok(mecs.includes(inv.mecanismo), inv.id);
  assert.ok(rotasApp.includes(inv.rota), inv.id);
  for (const campo of ["frase", "comoGanha", "quando", "riscos", "imposto"]) assert.ok(inv[campo], inv.id + "." + campo);
}
for (const a of Dados.GUIA_ABAS) assert.ok(rotasApp.includes(a.rota) && a.passos.length, a.rota);

console.log("Todos os testes passaram.");
