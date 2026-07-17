import { redirect } from "next/navigation";

export default function LegacyAccountRoute() {
  redirect("/dashboard/service/profile");
}
