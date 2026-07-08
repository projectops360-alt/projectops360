---
slug: screen-signup
route: /signup
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(auth)/signup/page.tsx
  - src/components/auth/signup-form.tsx
  - src/app/[locale]/(auth)/actions.ts
---

# EN: Signup screen

The account-creation screen at `/signup` in the `(auth)` route group, reached from the landing page or from the login screen's "no account" link. The server page renders a localized title/subtitle (namespace `auth.signup`) above the client `SignupForm`. The form collects display name, email, password, and password confirmation (minimum 6 characters). Before calling the server, the client validates that both passwords match and meet the length rule; it then calls the `signupAction` server action, which runs `supabase.auth.signUp` with the display name stored as `display_name` in user metadata and an `emailRedirectTo` pointing at `{origin}/auth/callback`. The origin prefers the configured `NEXT_PUBLIC_SITE_URL` over the request origin so confirmation emails always link to the canonical domain rather than a preview URL. On success the form replaces itself with a confirmation state — an envelope icon, a "check your email" message including the address, and a link back to login. Errors are mapped to localized messages (email already taken, weak password, mismatch, unexpected). No tables are written directly; account creation goes through Supabase Auth. Related screens: Login (`/login`) and the auth callback route that completes email confirmation.

Source: src/app/[locale]/(auth)/signup/page.tsx, src/components/auth/signup-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verify: open /signup, register with a new email, and confirm the "check your email" success state appears.

# ES: Pantalla Registro

La pantalla de creación de cuenta en `/signup`, dentro del grupo `(auth)`; se llega desde la landing o desde el enlace "sin cuenta" del login. La página de servidor muestra título y subtítulo localizados (namespace `auth.signup`) sobre el componente cliente `SignupForm`. El formulario pide nombre para mostrar, correo, contraseña y confirmación (mínimo 6 caracteres). Antes de llamar al servidor, el cliente valida que las contraseñas coincidan y cumplan la longitud; luego llama la server action `signupAction`, que ejecuta `supabase.auth.signUp` guardando el nombre como `display_name` en los metadatos del usuario y con `emailRedirectTo` apuntando a `{origen}/auth/callback`. El origen prefiere `NEXT_PUBLIC_SITE_URL` sobre el origen de la petición, para que los correos de confirmación enlacen al dominio canónico y no a una URL de preview. Si tiene éxito, el formulario se reemplaza por un estado de confirmación — icono de sobre, mensaje "revisa tu correo" con la dirección y enlace de vuelta al login. Los errores se traducen (correo ya registrado, contraseña débil, no coinciden, inesperado). No se escriben tablas directamente; todo pasa por Supabase Auth. Pantallas relacionadas: Login (`/login`) y la ruta de callback de autenticación.

Fuente: src/app/[locale]/(auth)/signup/page.tsx, src/components/auth/signup-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verifica: abre /signup, regístrate con un correo nuevo y confirma que aparece el estado de éxito "revisa tu correo".
