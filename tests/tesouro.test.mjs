// Testes do leitor do CSV do Tesouro Direto. Rode com: node tests/tesouro.test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { parseTesouro, numeroBR, dataISO, tipoProduto } from "../scripts/tesouro-parse.mjs";

assert.strictEqual(numeroBR("7,10"), 7.1);
assert.strictEqual(numeroBR("1.234,56"), 1234.56);
assert.strictEqual(numeroBR("0,0450"), 0.045);
assert.strictEqual(numeroBR("12.5"), 12.5);
assert.ok(Number.isNaN(numeroBR("")));
assert.strictEqual(dataISO("29/10/2026"), "2026-10-29");
assert.strictEqual(tipoProduto("Tesouro IPCA+"), "ipca");
assert.strictEqual(tipoProduto("Tesouro IPCA+ com Juros Semestrais"), null);
assert.strictEqual(tipoProduto("Tesouro Selic"), "selic");

const csv = readFileSync(new URL("./fixtures/tesouro-amostra.csv", import.meta.url), "utf8");
const r = parseTesouro(csv);
assert.strictEqual(r.atualizado, "2026-10-29"); // data-base mais recente
assert.strictEqual(r.dataBase, "29/10/2026");
const nomes = r.titulos.map((t) => t.nome);
assert.ok(!nomes.includes("Tesouro Prefixado 2027"), "título sem preço de compra deve sair");
assert.strictEqual(r.titulos[0].nome, "Tesouro Selic 2029"); // ordem: Selic, Prefixado, IPCA+, outros
assert.deepStrictEqual(nomes.slice(1, 4), ["Tesouro Prefixado 2029", "Tesouro IPCA+ 2029", "Tesouro IPCA+ 2035"]);
const ipca35 = r.titulos.find((t) => t.nome === "Tesouro IPCA+ 2035");
assert.strictEqual(ipca35.taxa, 7.1); // valor do dia mais recente, não do anterior
assert.strictEqual(ipca35.tipo, "ipca");
assert.strictEqual(r.titulos.find((t) => t.nome.startsWith("Tesouro Renda+")).pu, 1234.56);
assert.strictEqual(r.titulos.find((t) => t.tipoTitulo.includes("Semestrais")).tipo, null);

// Cabeçalho com acento e BOM também funciona; coluna faltando gera erro claro
const comAcento = "﻿Tipo Título;Data Vencimento;Data Base;Taxa Compra Manhã;PU Compra Manhã\nTesouro Selic;01/03/2029;29/10/2026;0,05;17000,00\n";
assert.strictEqual(parseTesouro(comAcento).titulos.length, 1);
assert.throws(() => parseTesouro("Tipo Titulo;Data Base\nTesouro Selic;29/10/2026\n"), /Coluna não encontrada/);

console.log("Testes do Tesouro passaram.");
