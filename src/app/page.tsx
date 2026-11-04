import { redirect } from "next/navigation";

// The launcher landing is the default page.
export default function RootPage() {
  redirect("/home");
}
