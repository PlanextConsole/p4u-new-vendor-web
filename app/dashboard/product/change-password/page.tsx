import { redirect } from "next/navigation";

export default function LegacyAccountRoute() {
  redirect("/dashboard/product/profile");
}
