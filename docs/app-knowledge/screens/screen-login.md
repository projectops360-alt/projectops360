---
slug: screen-login
route: /login
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(auth)/login/page.tsx
  - src/components/auth/login-form.tsx
  - src/app/[locale]/(auth)/actions.ts
---

# EN: Login screen

The sign-in screen, at `/login` inside the `(auth)` route group. Users reach it from the landing page CTAs, from the signup screen's "back to login" link, or by being redirected when unauthenticated (for example, `logoutAction` redirects here). The server page renders a localized title and subtitle (next-intl namespace `auth.login`) above the client `LoginForm`. The form has two fields — email and password (minimum 6 characters) — plus a submit button and a link to the signup screen for users without an account. Submitting calls the `loginAction` server action, which runs `supabase.auth.signInWithPassword` and, on success, redirects to `/` (the home dashboard / PMO Command Center). On failure the form maps Supabase error messages to localized errors: invalid credentials, email not confirmed, or a generic unexpected error, shown in a red banner. No database tables are touched directly; everything goes through Supabase Auth. There is no password-recovery link on this screen in the current code. Related screens: Signup (`/signup`), Change password (`/change-password`, used for forced password changes after login), and the Home dashboard it redirects to.

Source: src/app/[locale]/(auth)/login/page.tsx, src/components/auth/login-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verify: open /login while logged out, sign in with valid credentials, and confirm the redirect to the home dashboard.

# ES: Pantalla Inicio de sesión

La pantalla de inicio de sesión, en `/login` dentro del grupo de rutas `(auth)`. Se llega desde los CTA de la landing, desde el enlace "volver a iniciar sesión" del registro, o por redirección cuando no hay sesión (por ejemplo, `logoutAction` redirige aquí). La página de servidor muestra título y subtítulo localizados (namespace `auth.login` de next-intl) sobre el componente cliente `LoginForm`. El formulario tiene dos campos — correo y contraseña (mínimo 6 caracteres) — más un botón de envío y un enlace al registro para quien no tiene cuenta. Al enviar se llama la server action `loginAction`, que ejecuta `supabase.auth.signInWithPassword` y, si tiene éxito, redirige a `/` (el dashboard PMO Command Center). Si falla, el formulario traduce los errores de Supabase a mensajes localizados: credenciales inválidas, correo no confirmado o error inesperado, mostrados en un aviso rojo. No se tocan tablas directamente; todo pasa por Supabase Auth. En el código actual no hay enlace de recuperación de contraseña. Pantallas relacionadas: Registro (`/signup`), Cambio de contraseña (`/change-password`) y el dashboard de inicio.

Fuente: src/app/[locale]/(auth)/login/page.tsx, src/components/auth/login-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verifica: abre /login sin sesión, inicia sesión con credenciales válidas y confirma la redirección al dashboard de inicio.
