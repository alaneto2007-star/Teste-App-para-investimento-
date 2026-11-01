// Calcula a projeção Monte Carlo fora da tela principal, para a digitação não travar no celular.
// Recebe { id, params } e devolve { id, r } (ou { id, erro }). O app descarta respostas antigas pelo id.
importScripts("calc.js");

self.onmessage = (e) => {
  const { id, params } = e.data || {};
  try {
    self.postMessage({ id, r: self.Calc.monteCarlo(params) });
  } catch (err) {
    self.postMessage({ id, erro: String((err && err.message) || err) });
  }
};
