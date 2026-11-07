import { redirect } from "next/navigation";

export default function LatestPage() {
  redirect("/explore?view=latest");
}
