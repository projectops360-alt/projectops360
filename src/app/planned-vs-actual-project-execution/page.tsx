import { BuyerIntentPage, buildBuyerIntentMetadata } from "@/components/authority/buyer-intent-page";

const slug = "planned-vs-actual-project-execution" as const;

export const metadata = buildBuyerIntentMetadata(slug);

export default function Page() {
  return <BuyerIntentPage slug={slug} />;
}
