import { redirect } from "next/navigation";

/** /panel lleva directamente a Facturación */
export default function Panel() {
  redirect("/panel/facturacion");
}
