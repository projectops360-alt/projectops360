---
slug: screen-forgot-password
route: /forgot-password
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(auth)/forgot-password/page.tsx
  - src/components/auth/forgot-password-form.tsx
  - src/app/[locale]/(auth)/actions.ts
---

# EN: Forgot password screen

A public password-recovery screen at `/forgot-password`, inside the `(auth)` route group, reached from the "Forgot password?" link on the Login form — no session is required. The server page only renders a localized title and subtitle above the client `ForgotPasswordForm`. The form has a single required email field and a submit button that shows a "sending" state while pending; a "Back to login" link is always available. Submitting calls the `requestPasswordResetAction` server action, which normalizes the email (trim + lowercase), validates it against a simple email regex, and then calls Supabase Auth `resetPasswordForEmail` with a `redirectTo` pointing at `/change-password?recovery=1` (built by `getAuthEmailCallbackUrl`), so the recovery link in the email lands the user on the Change Password screen in recovery mode. The action returns exactly two error codes — `invalid_email` when the address fails validation and `delivery_failed` when Supabase reports an error — rendered as localized banners; no user database table is read or written, everything goes through Supabase Auth. On success the form is replaced by a confirmation message telling the user to check their inbox, plus the back-to-login link. Related screens: Login and Change Password.
Source: src/app/[locale]/(auth)/forgot-password/page.tsx, src/components/auth/forgot-password-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verify: open /login, click "Forgot password?", submit your email; you see the confirmation message and receive a recovery email linking to /change-password.

# ES: Pantalla de recuperación de contraseña

Una pantalla pública de recuperación de contraseña en `/forgot-password`, dentro del grupo de rutas `(auth)`, a la que se llega desde el enlace "¿Olvidaste tu contraseña?" del formulario de inicio de sesión — no requiere sesión. La página de servidor solo muestra un título y subtítulo localizados sobre el componente cliente `ForgotPasswordForm`. El formulario tiene un único campo obligatorio de correo electrónico y un botón de envío que muestra un estado de "enviando" mientras procesa; el enlace "Volver al inicio de sesión" está siempre visible. Al enviar se llama la server action `requestPasswordResetAction`, que normaliza el correo (recorte y minúsculas), lo valida con una expresión regular sencilla y llama a `resetPasswordForEmail` de Supabase Auth con un `redirectTo` que apunta a `/change-password?recovery=1` (construido por `getAuthEmailCallbackUrl`), de modo que el enlace del correo lleva al usuario a la pantalla de cambio de contraseña en modo recuperación. La acción devuelve exactamente dos códigos de error — `invalid_email` si el correo no es válido y `delivery_failed` si Supabase reporta un fallo — mostrados como avisos localizados; no se lee ni escribe ninguna tabla propia, todo pasa por Supabase Auth. Si tiene éxito, el formulario se sustituye por un mensaje de confirmación que invita a revisar la bandeja de entrada, junto al enlace de regreso. Pantallas relacionadas: Inicio de sesión y Cambio de contraseña.
Fuente: src/app/[locale]/(auth)/forgot-password/page.tsx, src/components/auth/forgot-password-form.tsx, src/app/[locale]/(auth)/actions.ts.
Verifica: abre /login, pulsa "¿Olvidaste tu contraseña?", envía tu correo; verás el mensaje de confirmación y recibirás un correo de recuperación que enlaza a /change-password.
