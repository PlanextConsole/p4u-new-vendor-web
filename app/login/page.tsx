import { redirect } from "next/navigation";

/** Login lives at `/`; keep `/login` for bookmarks. */
export default function LoginAliasPage() {
  redirect("/");
}
