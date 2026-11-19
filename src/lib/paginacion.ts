/**
 * Cálculo de los números que muestra la paginación (función pura, con pruebas en paginacion.test.ts).
 */

/** Números a mostrar: siempre la primera, la última y las vecinas de la actual; el resto se resume con "…". */
export function numerosPagina(pagina: number, totalPaginas: number): (number | "…")[] {
  const candidatos = [1, totalPaginas, pagina - 1, pagina, pagina + 1];
  // Cerca de los extremos se muestran las primeras / últimas páginas seguidas: 1 2 3 4 … 7
  if (pagina <= 3) candidatos.push(2, 3, 4);
  if (pagina >= totalPaginas - 2) candidatos.push(totalPaginas - 1, totalPaginas - 2, totalPaginas - 3);
  const ordenados = [...new Set(candidatos.filter((n) => n >= 1 && n <= totalPaginas))].sort((a, b) => a - b);

  const resultado: (number | "…")[] = [];
  ordenados.forEach((n, i) => {
    const anterior = ordenados[i - 1];
    if (anterior !== undefined && n - anterior === 2) resultado.push(n - 1); // un solo número oculto: se muestra
    else if (anterior !== undefined && n - anterior > 2) resultado.push("…");
    resultado.push(n);
  });
  return resultado;
}
