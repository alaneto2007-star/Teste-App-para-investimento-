# Invest Simulador

App web para estudar investimentos: perfil de risco, projeção Monte Carlo, histórico de 2016 a 2024, cripto, renda fixa e carteira com rebalanceamento. É só HTML, CSS e JavaScript, sem instalar nada.

> Projeto educacional. Nada aqui é recomendação de investimento.

## Como abrir

**Online:** https://alaneto2007-star.github.io/Teste-App-para-investimento-/ (depois de ativar o GitHub Pages, veja abaixo).

**No computador:** baixe o repositório (botão verde **Code → Download ZIP** no GitHub), extraia e dê dois cliques em `index.html`.

### Ativar o GitHub Pages (uma vez só)

1. No GitHub, abra o repositório e vá em **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`, depois clique em **Save**.
4. Espere 1 ou 2 minutos e acesse o link acima.

## Seções

| Seção | O que faz |
|---|---|
| **Visão geral** | Mapa de risco × retorno das 8 classes e das carteiras modelo, desempenho de cada classe de 2016 a 2024, resumo do perfil e da carteira. |
| **Meu perfil** | Questionário de 6 perguntas que define o perfil (conservador, moderado, arrojado ou agressivo) e a carteira modelo. |
| **Projeção** | Simulação Monte Carlo em reais de hoje: retornos reais correlacionados, juro real de longo prazo ajustável (no lugar do CDI atual para sempre), aportes corrigidos pela inflação, custos anuais e IR sobre o ganho nominal no resgate. Premissas editáveis. |
| **Histórico** | Backtest com aporte inicial e mensal sobre os retornos de cada ano, descontando custos e IR no resgate, com opção de descontar a inflação e escala logarítmica. |
| **Cripto** | Cotações ao vivo (CoinGecko), retorno anual de BTC e ETH, maiores quedas, calculadora de quanto colocar em cripto e formas de investir no Brasil. |
| **Renda fixa** | Produtos editáveis com teto (ex.: 115% do CDI até R$ 5 mil), taxa acima do teto e carência. Calcula a melhor divisão do dinheiro entre eles, com IR por aporte, opção "só liquidez diária" e tabela de rendimento líquido por prazo. Também tem reserva de emergência e prazo para metas. |
| **Onde investir** | 20 instrumentos, do Tesouro Selic ao day trade, com risco, liquidez, IR, mínimo e principal cuidado. |
| **Apps e corretoras** | Escolha o objetivo (reserva, dinheiro parado, ações/ETFs/FIIs, exterior, cripto) e veja onde rende mais ou custa menos: plano passo a passo com o app de cada etapa, alerta do limite do FGC, taxas oficiais do Tesouro Direto e catálogo de 14 apps com custos editáveis. Não indica ação específica. |
| **Minha carteira** | Cadastro dos seus investimentos, comparação com o alvo do perfil e divisão do próximo aporte para rebalancear. |

## Dados

- **Ao vivo:** Selic, CDI, IPCA e dólar da API do Banco Central; cotações de cripto da CoinGecko. Se o navegador bloquear essas chamadas, o app usa os valores digitados na aba Renda fixa.
- **Histórico 2016–2024:** retornos anuais aproximados de CDI e IPCA (BCB/IBGE), IMA-B (Anbima), Ibovespa e IFIX (B3), S&P 500 com dividendos, ouro, Bitcoin e Ethereum, com ativos em dólar convertidos para reais. Ficam em `js/data.js`.
- **Premissas da projeção:** retorno real (acima da inflação), volatilidade, custo anual e alíquota de IR por classe, e correlações aproximadas, também em `js/data.js`.
- **% do CDI:** aplicado sobre a taxa diária (252 dias úteis), como fazem os bancos.

## Taxas do Tesouro Direto (robô do GitHub)

O workflow `.github/workflows/tesouro.yml` roda em dias úteis às 19h17 (Brasília), baixa o CSV oficial do Tesouro Transparente e grava `data/tesouro.json`, que o site lê. Para rodar a primeira vez: aba **Actions** do repositório → **Atualizar Tesouro** → **Run workflow**. Fora do GitHub Pages (arquivo aberto no computador ou link do Claude) a tabela do Tesouro fica vazia.

## Estrutura

```
index.html          página
css/styles.css      estilos (tema claro e escuro)
js/data.js          dados de referência, perfis, questionário e catálogo
js/calc.js          cálculos: juros, IR, estatísticas, backtest, Monte Carlo, perfil, rebalanceamento
js/charts.js        gráficos em SVG (linhas com faixas, barras, rosca, dispersão, minigráfico)
js/live.js          busca de dados no Banco Central e na CoinGecko
js/app.js           interface
scripts/            robô do Tesouro (download e leitura do CSV)
tests/calc.test.js  testes dos cálculos
tests/tesouro.test.mjs  testes do leitor do CSV do Tesouro
```

## Testes

```bash
node tests/calc.test.js
```

```bash
node tests/tesouro.test.mjs
```

## Limitações

- Histórico com granularidade anual: quedas dentro de um mesmo ano não aparecem no backtest.
- A projeção depende das premissas; elas são estimativas, não promessas.
- IR simplificado: alíquota fixa por classe no resgate final. Não modela a isenção de R$ 20 mil/mês em ações, a de R$ 35 mil/mês em cripto, nem o IR gerado pelos rebalanceamentos.
- Custos dos apps são referências de 2025, editáveis na tela; confira no app.
- Renda fixa supõe o CDI constante no prazo (ajustável como "CDI médio" no objetivo de longo prazo). Títulos com vencimento rendem o CDI depois de vencer.
- Renda fixa não considera a taxa de custódia do Tesouro nem o risco de crédito acima da cobertura do FGC.
- Regras de imposto de renda conforme a legislação de 2025. Confira antes de investir.
