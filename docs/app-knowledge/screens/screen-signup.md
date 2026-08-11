---
slug: screen-signup
route: /signup
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(auth)/signup/page.tsx
  - src/components/auth/signup-form.tsx
  - src/app/[locale]/(auth)/actions.ts
  - src/lib/auth/email-redirects.ts
  - src/lib/auth/email-redirects.server.ts
  - src/app/auth/callback/route.ts
---

# EN: Signup screen

The account-creation screen at `/signup` in the `(auth)` route group, reached from the landing page or the login screen's "no account" link. The server page renders a localized title and subtitle (namespace `auth.signup`) above the client `SignupForm`, which collects display name, an optional company name (max 120 characters, with a hint under it), email, password and confirmation (minimum 6 characters). The client checks that both passwords match and meet the length rule before calling `signupAction`, which runs `supabase.auth.signUp` storing `display_name` and — when provided — `company_name` in user metadata; the database's `handle_new_user()` trigger consumes `company_name` to name the new organization. `emailRedirectTo` is built by `getAuthEmailCallbackUrl` → `resolveAuthSiteUrl`, which in a production deployment always uses `NEXT_PUBLIC_SITE_URL` or falls back to `https://projectops360.com`, so confirmation links never point at a preview URL. On success the form is replaced by an envelope icon and a "check your email" message with a link back to login; clicking the emailed link hits `/auth/callback`, which exchanges the code and lands on `/?auth=confirmed`, or bounces to login with `authError=confirmation_failed`. Confirmation email delivery depends on SMTP being configured in Supabase. Related: screen-login, screen-change-password.
Source: (auth)/signup/page.tsx, components/auth/signup-form.tsx, (auth)/actions.ts, lib/auth/email-redirects.ts.
Verify: open /signup, register a new email, and confirm the "check your email" state appears.

# ES: Pantalla Registro

La pantalla de creación de cuenta en `/signup`, dentro del grupo `(auth)`; se llega desde la landing o desde el enlace "sin cuenta" del inicio de sesión. La página de servidor muestra título y subtítulo localizados (namespace `auth.signup`) sobre el componente cliente `SignupForm`, que pide nombre para mostrar, un nombre de empresa opcional (máximo 120 caracteres, con una nota debajo), correo, contraseña y confirmación (mínimo 6 caracteres). El cliente valida que las contraseñas coincidan y cumplan la longitud antes de llamar a `signupAction`, que ejecuta `supabase.auth.signUp` guardando `display_name` y, si se indicó, `company_name` en los metadatos; el disparador `handle_new_user()` de la base de datos usa `company_name` para nombrar la nueva organización. `emailRedirectTo` se construye con `getAuthEmailCallbackUrl` → `resolveAuthSiteUrl`, que en un despliegue de producción siempre usa `NEXT_PUBLIC_SITE_URL` o recurre a `https://projectops360.com`, de modo que los enlaces de confirmación nunca apunten a una URL de vista previa. Si tiene éxito, el formulario se sustituye por un icono de sobre y el mensaje "revisa tu correo" con enlace de vuelta al acceso; al pulsar el enlace del correo se entra a `/auth/callback`, que canjea el código y aterriza en `/?auth=confirmed`, o devuelve al acceso con `authError=confirmation_failed`. La entrega del correo depende de que SMTP esté configurado en Supabase. Relacionadas: screen-login, screen-change-password.
Fuente: (auth)/signup/page.tsx, components/auth/signup-form.tsx, (auth)/actions.ts, lib/auth/email-redirects.ts.
Verifica: abre /signup, regístrate con un correo nuevo y confirma que aparece el estado "revisa tu correo".
