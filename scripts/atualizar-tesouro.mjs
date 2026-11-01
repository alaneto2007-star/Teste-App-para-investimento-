// Baixa as taxas do Tesouro Direto (Tesouro Transparente) e grava data/tesouro.json para o site.
// Roda no GitHub Actions (.github/workflows/tesouro.yml). Uso local: node scripts/atualizar-tesouro.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { parseTesouro } from "./tesouro-parse.mjs";

const DATASET = "df56aa42-484a-4a59-8184-7676580c81e3";
const CKAN = "https://www.tesourotransparente.gov.br/ckan";
const URL_PADRAO = `${CKAN}/dataset/${DATASET}/resource/796d2059-14e9-4e3e-9e3f-0d6d8ff7c0ca/download/PrecoTaxaTesouroDireto.csv`;
const CABECALHOS = { "User-Agent": "invest-simulador (GitHub Actions)" };

async function baixar(url) {
  const r = await fetch(url, { headers: CABECALHOS, signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

function decodificar(bytes) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(bytes) : utf8;
}

// Se o endereço do arquivo mudar, procura o recurso pelo catálogo (API do CKAN).
async function urlsPeloCatalogo() {
  const urls = [];
  for (const api of [`${CKAN}/api/3/action/package_show?id=${DATASET}`, `${CKAN}/api/3/action/package_search?q=PrecoTaxaTesouroDireto`]) {
    try {
      const r = await fetch(api, { headers: CABECALHOS, signal: AbortSignal.timeout(60000) });
      const j = await r.json();
      const pacotes = j.result?.results || (j.result ? [j.result] : []);
      for (const p of pacotes) for (const rec of p.resources || []) if (/PrecoTaxaTesouroDireto\.csv/i.test(rec.url || "")) urls.push(rec.url);
    } catch (e) {
      console.warn("Catálogo indisponível:", api, e.message);
    }
  }
  return urls;
}

async function main() {
  const tentativas = [process.env.TESOURO_CSV_URL, URL_PADRAO].filter(Boolean);
  let dados = null, fonte = null, ultimoErro = null;
  for (const lista of [tentativas, null]) {
    const urls = lista ?? (await urlsPeloCatalogo());
    for (const url of urls) {
      try {
        dados = parseTesouro(decodificar(await baixar(url)));
        fonte = url;
        break;
      } catch (e) {
        ultimoErro = e;
        console.warn("Falhou:", url, "-", e.message);
      }
    }
    if (dados) break;
  }
  if (!dados) throw ultimoErro || new Error("Não foi possível baixar as taxas do Tesouro");

  await mkdir("data", { recursive: true });
  const saida = { ...dados, fonte: "Tesouro Transparente (Tesouro Nacional)", url: fonte };
  await writeFile("data/tesouro.json", JSON.stringify(saida, null, 2) + "\n");
  console.log(`Taxas de ${dados.dataBase}: ${dados.titulos.length} títulos à venda.`);
  for (const t of dados.titulos) console.log(`  ${t.nome.padEnd(48)} ${t.taxa}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
