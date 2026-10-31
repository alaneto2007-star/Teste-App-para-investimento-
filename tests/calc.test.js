// Testes das funções de cálculo. Rode com: node tests/calc.test.js
const assert = require("assert");
const Calc = require("../js/calc.js");

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

console.log("Todos os testes passaram.");
