import { Drawer } from "../../drawer";

/**
 * Everything that opens over the list shares one drawer, so moving between them (a new
 * product becoming its own label) changes what's printed on it, not the drawer itself.
 */
export default function DrawerLayout({ children }: LayoutProps<"/products">) {
  return <Drawer>{children}</Drawer>;
}
