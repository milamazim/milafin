import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

import { signOut } from "../(auth)/actions";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <>
      <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline" title={user.email}>
        {user.email}
      </span>
      <form action={signOut} className="order-last">
        <Button type="submit" variant="ghost" size="icon" aria-label="Sair" title="Sair">
          <LogOutIcon />
        </Button>
      </form>
    </>
  );
}
