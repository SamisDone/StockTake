import { both } from "@/lib/i18n";
import { PRODUCTS_COPY } from "../../copy";
import { Drawer } from "../../drawer";

/**
 * Everything that opens over the list shares one drawer, so moving between them (a new
 * product becoming its own label) changes what's printed on it, not the drawer itself.
 * It reads nothing from the request, so it opens with the prefetched page, at once.
 */
export default function DrawerLayout({ children }: LayoutProps<"/products">) {
  return <Drawer closeLabel={both(PRODUCTS_COPY, (t) => t.close)}>{children}</Drawer>;
}
