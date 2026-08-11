---
slug: screen-login
route: /login
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(auth)/login/page.tsx
  - src/app/[locale]/(auth)/layout.tsx
  - src/components/auth/login-form.tsx
  - src/app/[locale]/(auth)/actions.ts
  - src/app/auth/callback/route.ts
---

# EN: Login screen

The sign-in screen at `/login`, inside the `(auth)` route group whose layout centers a card under the ProjectOps360° wordmark. You reach it from the landing CTAs, from the signup screen's "already have an account" link, or by redirect — `logoutAction` sends you here, and `/auth/callback` redirects here with `?authError=confirmation_failed` or `?authError=recovery_link_invalid` when an email link fails. The server page passes those two values to `LoginForm` as an amber notice banner. The form (next-intl namespace `auth.login`) has email and password (minimum 6 characters), a "Forgot password?" link to `/forgot-password`, a submit button, and a link to `/signup`. Submitting calls `loginAction`, which runs `supabase.auth.signInWithPassword` and on success redirects to `/`; the app layout then intercepts anyone whose `user_metadata.must_change_password` is true and sends them to `/change-password`. Failures map Supabase messages to localized text for invalid credentials, unconfirmed email, or an unexpected error, shown in a red banner. No database table is read or written — the screen only talks to Supabase Auth. Related: screen-signup, screen-change-password, screen-home-dashboard.
Source: (auth)/login/page.tsx, components/auth/login-form.tsx, (auth)/actions.ts.
Verify: open /login logged out, sign in, and confirm the redirect to the home dashboard.

# ES: Pantalla Inicio de sesión

La pantalla de acceso en `/login`, dentro del grupo de rutas `(auth)`, cuyo layout centra una tarjeta bajo el logotipo de ProjectOps360°. Se llega desde los CTA de la landing, desde el enlace "ya tengo cuenta" del registro o por redirección: `logoutAction` te trae aquí y `/auth/callback` redirige con `?authError=confirmation_failed` o `?authError=recovery_link_invalid` cuando falla un enlace de correo. La página de servidor pasa esos dos valores a `LoginForm` como un aviso ámbar. El formulario (namespace `auth.login` de next-intl) tiene correo y contraseña (mínimo 6 caracteres), un enlace "¿Olvidaste tu contraseña?" hacia `/forgot-password`, un botón de envío y un enlace a `/signup`. Al enviar se llama `loginAction`, que ejecuta `supabase.auth.signInWithPassword` y, si funciona, redirige a `/`; después el layout de la aplicación intercepta a quien tenga `user_metadata.must_change_password` en verdadero y lo manda a `/change-password`. Los fallos se traducen a mensajes de credenciales inválidas, correo sin confirmar o error inesperado, en un aviso rojo. No se lee ni escribe ninguna tabla: la pantalla solo habla con Supabase Auth. Relacionadas: screen-signup, screen-change-password, screen-home-dashboard.
Fuente: (auth)/login/page.tsx, components/auth/login-form.tsx, (auth)/actions.ts.
Verifica: abre /login sin sesión, inicia sesión y confirma la redirección al panel de inicio.
