# Invest Simulador

App web de estudo para simular, organizar e planejar investimentos. É só HTML, CSS e JavaScript, sem instalar nada.

> Projeto educacional. Não é recomendação de investimento.

## Como abrir

**Online:** https://alaneto2007-star.github.io/Teste-App-para-investimento-/ (depois de ativar o GitHub Pages, veja abaixo).

**No computador:** baixe o repositório (botão verde **Code → Download ZIP** no GitHub), extraia e dê dois cliques em `index.html`.

### Ativar o GitHub Pages (uma vez só)

1. No GitHub, abra o repositório e vá em **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`, depois clique em **Save**.
4. Espere 1 ou 2 minutos e acesse o link acima.

## Funcionalidades

- **Simulador**: compara Poupança, Tesouro Selic, CDB e LCI/LCA com valor inicial, aportes mensais e prazo. Desconta o IR regressivo e mostra um gráfico da evolução. Busca Selic, CDI e IPCA atualizados na API do Banco Central (dá para editar à mão) e mostra o valor final "em reais de hoje", descontada a inflação.
- **Reserva & Metas**: calcula a reserva de emergência ideal e em quanto tempo você chega a uma meta.
- **Minha carteira**: registre seus investimentos e veja a distribuição por categoria. Os dados ficam salvos no navegador (localStorage).

## Estrutura

```
index.html          página principal
css/styles.css      estilos (tema claro e escuro)
js/calc.js          funções de cálculo (juros, IR, metas)
js/app.js           interface
tests/calc.test.js  testes dos cálculos
```

## Testes

Com o Node.js instalado:

```bash
node tests/calc.test.js
```

## Limitações

- Se a API do Banco Central não responder, o app usa os valores digitados nos campos.
- As taxas são fixas durante todo o prazo (na vida real elas mudam).
- Não considera taxa de custódia do Tesouro, IOF (resgates com menos de 30 dias) nem TR na poupança.
