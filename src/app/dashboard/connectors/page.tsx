import { redirect } from "next/navigation";

// Integrations live at /dashboard/integrations now. Keep this route working
// for any old links (e.g. onboarding deep-links) by forwarding there.
export default function ConnectorsRedirect() {
  redirect("/dashboard/integrations");
}
