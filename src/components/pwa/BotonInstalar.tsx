/**
 * Botón "Instalar aplicación".
 * - Android y computador: usa el evento beforeinstallprompt, que captura un script del
 *   layout raíz. El evento llega una sola vez y mucho antes de que se abra el menú del
 *   celular; por eso no se escucha aquí, sino que este botón lo lee de window.
 * - iPhone/iPad: Safari no tiene ese evento, así que se muestran instrucciones.
 * - Si la app ya está instalada, o el navegador no permite instalarla, no se muestra nada.
 */
"use client";

import { useEffect, useState } from "react";
import { Boton } from "../ui/Boton";
import { Icono, type NombreIcono } from "../ui/Icono";
import { Modal } from "../ui/Modal";

/** Evento propio de Chrome/Edge: todavía no está en los tipos de TypeScript. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __eventoInstalacion?: EventoInstalacion | null;
  }
  interface Navigator {
    /** Solo existe en iOS: indica si la app se abrió desde la pantalla de inicio */
    standalone?: boolean;
  }
}

/** Se dispara desde el script del layout raíz cuando cambia la posibilidad de instalar. */
const EVENTO_CAMBIO = "pwa:instalacion";

type Modo = "oculto" | "directo" | "ios";

function detectarModo(): Modo {
  const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (instalada) return "oculto";
  if (window.__eventoInstalacion) return "directo";
  // Los iPad modernos se presentan como Mac, pero con pantalla táctil
  const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return esIos ? "ios" : "oculto";
}

const PASOS_IOS: { icono: NombreIcono; texto: string }[] = [
  { icono: "compartirIos", texto: "Toca Compartir" },
  { icono: "mas", texto: "Toca «Agregar a pantalla de inicio»" },
  { icono: "check", texto: "Toca «Agregar» para terminar" },
];

export function BotonInstalar({ claro = false }: { /** Para fondos oscuros, como el menú */ claro?: boolean }) {
  // "oculto" al inicio para que el servidor y el navegador dibujen lo mismo
  const [modo, setModo] = useState<Modo>("oculto");
  const [verInstrucciones, setVerInstrucciones] = useState(false);

  useEffect(() => {
    const actualizar = () => setModo(detectarModo());
    actualizar();
    window.addEventListener(EVENTO_CAMBIO, actualizar);
    return () => window.removeEventListener(EVENTO_CAMBIO, actualizar);
  }, []);

  async function instalar() {
    const evento = window.__eventoInstalacion;
    if (!evento) return setVerInstrucciones(modo === "ios");
    await evento.prompt();
    await evento.userChoice;
    // El navegador solo permite usar cada evento una vez
    window.__eventoInstalacion = null;
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }

  if (modo === "oculto") return null;

  return (
    <>
      {claro ? (
        <button
          type="button"
          onClick={instalar}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-base font-bold text-white hover:bg-white/25"
        >
          <Icono nombre="descargar" />
          Instalar aplicación
        </button>
      ) : (
        <Boton variante="secundario" ancho icono="descargar" onClick={instalar}>
          Instalar aplicación
        </Boton>
      )}

      <Modal abierto={verInstrucciones} onCerrar={() => setVerInstrucciones(false)} titulo="Instalar aplicación">
        <ol className="space-y-4 text-left text-lg">
          {PASOS_IOS.map((paso, indice) => (
            <li key={paso.texto} className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-acento">
                <Icono nombre={paso.icono} className="size-7" />
              </span>
              <span>
                <span className="font-bold">{indice + 1}.</span> {paso.texto}
              </span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
