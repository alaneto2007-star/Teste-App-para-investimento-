// Lê o CSV de preços e taxas do Tesouro Direto (Tesouro Transparente) e devolve os títulos à venda na data mais recente.
// Formato: separador ";", decimal com vírgula, datas dd/mm/aaaa. Colunas usadas (achadas pelo nome):
// Tipo Titulo, Data Vencimento, Data Base, Taxa Compra Manha, PU Compra Manha.

const norm = (s) => String(s).replace(/^﻿/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function numeroBR(s) {
  const t = String(s ?? "").trim();
  if (!t) return NaN;
  return t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
}

// dd/mm/aaaa -> aaaa-mm-dd (ordenável)
export function dataISO(s) {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Só os títulos que o simulador sabe modelar viram produto; os demais aparecem apenas na tabela.
export function tipoProduto(tipoTitulo) {
  const t = norm(tipoTitulo);
  if (t.startsWith("tesouro selic")) return "selic";
  if (t === "tesouro prefixado") return "prefixado";
  if (t === "tesouro ipca+") return "ipca";
  return null;
}

const ORDEM = { selic: 0, prefixado: 1, ipca: 2 };

export function parseTesouro(texto) {
  const linhas = String(texto).split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) throw new Error("CSV vazio");
  const cab = linhas[0].split(";").map(norm);
  const col = (nome) => {
    const i = cab.indexOf(nome);
    if (i < 0) throw new Error(`Coluna não encontrada: "${nome}". Cabeçalho: ${linhas[0]}`);
    return i;
  };
  const iTipo = col("tipo titulo"), iVenc = col("data vencimento"), iBase = col("data base");
  const iTaxa = col("taxa compra manha"), iPU = col("pu compra manha");

  const registros = [];
  let ultima = null;
  for (const linha of linhas.slice(1)) {
    const c = linha.split(";");
    const base = dataISO(c[iBase]);
    if (!base) continue;
    registros.push({ c, base });
    if (!ultima || base > ultima) ultima = base;
  }
  if (!ultima) throw new Error("Nenhuma data-base válida no CSV");

  const titulos = registros
    .filter((r) => r.base === ultima)
    .map(({ c }) => {
      const tipoTitulo = c[iTipo].trim();
      const vencimento = c[iVenc].trim();
      return {
        nome: `${tipoTitulo} ${vencimento.slice(-4)}`,
        tipoTitulo,
        tipo: tipoProduto(tipoTitulo),
        vencimento,
        taxa: numeroBR(c[iTaxa]),
        pu: numeroBR(c[iPU]),
      };
    })
    // À venda = preço de compra maior que zero.
    .filter((t) => t.pu > 0 && Number.isFinite(t.taxa))
    .sort((a, b) => (ORDEM[a.tipo] ?? 9) - (ORDEM[b.tipo] ?? 9) || a.tipoTitulo.localeCompare(b.tipoTitulo) || dataISO(a.vencimento).localeCompare(dataISO(b.vencimento)));

  if (!titulos.length) throw new Error(`Nenhum título à venda em ${ultima}`);
  const [a, m, d] = ultima.split("-");
  return { atualizado: ultima, dataBase: `${d}/${m}/${a}`, titulos };
}
