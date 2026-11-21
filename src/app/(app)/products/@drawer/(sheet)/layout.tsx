import { getLanguage } from "@/server/preferences";
import { PRODUCTS_COPY } from "../../copy";
import { Drawer } from "../../drawer";

/**
 * Everything that opens over the list shares one drawer, so moving between them (a new
 * product becoming its own label) changes what's printed on it, not the drawer itself.
 */
export default async function DrawerLayout({ children }: LayoutProps<"/products">) {
  return <Drawer closeLabel={PRODUCTS_COPY[await getLanguage()].close}>{children}</Drawer>;
}
