// One-off: seed demo company "XXX" with 10 users (1 PMO, 3 PM, 6 dev/design).
// Creates working logins via the Supabase Admin API. Idempotent on re-run.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) { console.error("Missing env"); process.exit(1); }

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistToken: false } });
const PASSWORD = "DemoXXX2026!";

const USERS = [
  { email: "pmo@xxx-demo.io",  name: "Ana Restrepo (PMO)" },
  { email: "pm1@xxx-demo.io",  name: "Carlos Méndez (PM)" },
  { email: "pm2@xxx-demo.io",  name: "Lucía Fernández (PM)" },
  { email: "pm3@xxx-demo.io",  name: "Diego Torres (PM)" },
  { email: "dev1@xxx-demo.io", name: "Mateo Rojas (Dev)" },
  { email: "dev2@xxx-demo.io", name: "Sofía Gómez (Dev)" },
  { email: "dev3@xxx-demo.io", name: "Javier Ruiz (Dev)" },
  { email: "dev4@xxx-demo.io", name: "Valentina Díaz (Dev)" },
  { email: "des1@xxx-demo.io", name: "Camila Ortiz (Diseño)" },
  { email: "des2@xxx-demo.io", name: "Andrés Vega (Diseño)" },
];

const out = [];
for (const u of USERS) {
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: u.name },
  });
  if (error) {
    // Already exists → find id.
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find((x) => (x.email ?? "").toLowerCase() === u.email);
    out.push({ email: u.email, id: found?.id ?? null, status: error.message.includes("already") ? "exists" : `err:${error.message}` });
  } else {
    out.push({ email: u.email, id: data.user.id, status: "created" });
  }
}
console.log(JSON.stringify(out, null, 2));
console.log("PASSWORD:", PASSWORD);
