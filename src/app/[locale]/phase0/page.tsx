import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { Phase0ControlClient } from "@/components/phase0/phase0-control-client";

export default async function Phase0Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AppShell>
      <Phase0ControlClient />
    </AppShell>
  );
}