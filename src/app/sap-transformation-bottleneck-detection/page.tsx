import { BuyerIntentPage, buildBuyerIntentMetadata } from "@/components/authority/buyer-intent-page";

const slug = "sap-transformation-bottleneck-detection" as const;

export const metadata = buildBuyerIntentMetadata(slug);

export default function Page() {
  return <BuyerIntentPage slug={slug} />;
}
