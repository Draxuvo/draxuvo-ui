// Las ventas de mostrador del personal: la API solo devuelve las que abrió.
import { SalesHistory } from "@/components/pos/sales-history";

export default function MisVentasPage() {
  return <SalesHistory mine />;
}
