import { ContactPageClient } from "@/components/ContactPageClient";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const content = await getSiteContent();
  return <ContactPageClient churchInfo={content.churchInfo} />;
}
