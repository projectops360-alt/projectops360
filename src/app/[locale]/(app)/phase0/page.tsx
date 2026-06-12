import { setRequestLocale } from "next-intl/server";
import { Phase0ControlClient } from "@/components/phase0/phase0-control-client";

export default async function Phase0Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <Phase0ControlClient />;
}