import { redirect } from "next/navigation";

export default function Root() {
  // Always start at login; authenticated users will proceed to /dashboard after login
  redirect("/auth/login");
}
