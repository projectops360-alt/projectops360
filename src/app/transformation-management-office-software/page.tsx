import { BuyerIntentPage, buildBuyerIntentMetadata } from "@/components/authority/buyer-intent-page";

const slug = "transformation-management-office-software" as const;

export const metadata = buildBuyerIntentMetadata(slug);

export default function Page() {
  return <BuyerIntentPage slug={slug} />;
}
