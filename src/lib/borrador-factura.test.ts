/** Pruebas del borrador de la factura. Ejecutar con: npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { borradorVacio, cuotasVigentes, leerBorrador, reconciliarLineas, VIGENCIA_BORRADOR_MS, type BorradorFactura } from "./borrador-factura";

const AHORA = Date.UTC(2026, 10, 11, 15, 0, 0);
const producto = (id: string, precio = 100_000, stock = 5) => ({ id, nombre: `Perfume ${id}`, codigo: null, precio, stock });
const base: BorradorFactura = {
  version: 1,
  guardadoEn: AHORA,
  tipo: "NORMAL",
  cliente: { identificacion: "12345", nombre: "Ana", telefono: "", direccion: "", sector: "" },
  lineas: [{ producto: producto("a"), cantidad: 2 }],
  descuento: 0,
  adicional: 0,
  notas: "",
  medioPago: null,
  transferencia: 0,
  cuotas: null,
};

describe("leerBorrador", () => {
  it("lee un borrador válido", () => {
    assert.deepEqual(leerBorrador(JSON.stringify(base), AHORA), base);
  });
  it("descarta texto dañado, de otra versión o vencido", () => {
    assert.equal(leerBorrador("{no es json", AHORA), null);
    assert.equal(leerBorrador(null, AHORA), null);
    assert.equal(leerBorrador(JSON.stringify({ ...base, version: 2 }), AHORA), null);
    assert.equal(leerBorrador(JSON.stringify(base), AHORA + VIGENCIA_BORRADOR_MS + 1), null);
  });
  it("descarta dinero con decimales o negativo", () => {
    assert.equal(leerBorrador(JSON.stringify({ ...base, descuento: 10.5 }), AHORA), null);
    assert.equal(leerBorrador(JSON.stringify({ ...base, adicional: -1 }), AHORA), null);
  });
});

describe("borradorVacio", () => {
  it("vacío sin cliente, productos ni notas", () => {
    assert.equal(borradorVacio({ cliente: { ...base.cliente, identificacion: " ", nombre: "" }, lineas: [], notas: "" }), true);
    assert.equal(borradorVacio(base), false);
  });
});

describe("reconciliarLineas", () => {
  it("usa precio y stock actuales y avisa los cambios", () => {
    const r = reconciliarLineas(base.lineas, new Map([["a", producto("a", 120_000, 1)]]));
    assert.deepEqual(r.lineas, [{ producto: producto("a", 120_000, 1), cantidad: 1 }]);
    assert.equal(r.cambios.length, 2);
    assert.match(r.cambios[0], /ahora cuesta \$\s120\.000/);
    assert.match(r.cambios[1], /solo quedan 1/);
  });
  it("quita productos agotados o eliminados", () => {
    const lineas = [...base.lineas, { producto: producto("b"), cantidad: 1 }];
    const r = reconciliarLineas(lineas, new Map([["a", producto("a", 100_000, 0)], ["b", null]]));
    assert.deepEqual(r.lineas, []);
    assert.match(r.cambios[0], /se agotó/);
    assert.match(r.cambios[1], /ya no está/);
  });
  it("conserva lo guardado si no se pudo verificar", () => {
    const r = reconciliarLineas(base.lineas, new Map());
    assert.deepEqual(r, { lineas: base.lineas, cambios: [] });
  });
});

describe("cuotasVigentes", () => {
  const cuotas = { cantidad: 2, frecuencia: "mensual" as const, primera: "2026-12-11T10:00", fechas: ["2026-12-11T10:00", "2027-01-11T10:00"] };
  it("conserva cuotas con fechas futuras", () => {
    assert.equal(cuotasVigentes(cuotas, AHORA), cuotas);
  });
  it("descarta cuotas con alguna fecha pasada o vacía", () => {
    assert.equal(cuotasVigentes({ ...cuotas, fechas: ["2026-11-01T10:00", "2027-01-11T10:00"] }, AHORA), null);
    assert.equal(cuotasVigentes({ ...cuotas, fechas: [] }, AHORA), null);
    assert.equal(cuotasVigentes(null, AHORA), null);
  });
});
