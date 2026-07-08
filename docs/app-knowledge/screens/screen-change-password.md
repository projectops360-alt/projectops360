---
slug: screen-change-password
route: /change-password
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/change-password/page.tsx
  - src/app/[locale]/change-password/change-password-form.tsx
  - src/app/[locale]/change-password/actions.ts
---

# EN: Change password screen

A standalone password-change screen at `/change-password` that deliberately lives outside the `(app)` route group (no app shell), so the forced-change gate in the app layout can redirect here without a redirect loop. It requires an authenticated session: the server page calls `supabase.auth.getUser()` and redirects to `/login` if there is none. It then reads `user_metadata.must_change_password`; when true (the "forced" flow, typically after an admin created the account with a temporary password), the copy explains the user must choose a new password to continue. The centered card form has two fields — new password and confirmation, both minimum 8 characters — and a "Save and continue" button. Submitting calls the `changeOwnPasswordAction` server action, which uses the user's own session (never the service role) to run `supabase.auth.updateUser`, setting the new password and clearing `must_change_password` in metadata. Localized errors cover weak password, reusing the same password, mismatch, expired session, and generic update failure. On success the client navigates to `/` and refreshes. Related screens: Login, Team (whose admin actions create users with temporary passwords), and the Home dashboard.

Source: src/app/[locale]/change-password/page.tsx, change-password-form.tsx, actions.ts.
Verify: sign in with an account flagged must_change_password (e.g. created from Team with a temp password); you are redirected to /change-password.

# ES: Pantalla Cambio de contraseña

Una pantalla independiente de cambio de contraseña en `/change-password`, que vive deliberadamente fuera del grupo `(app)` (sin shell de la aplicación) para que la puerta de cambio forzado del layout pueda redirigir aquí sin bucles. Requiere sesión autenticada: la página de servidor llama `supabase.auth.getUser()` y redirige a `/login` si no la hay. Luego lee `user_metadata.must_change_password`; cuando es verdadero (flujo "forzado", típico tras crear la cuenta con contraseña temporal), el texto explica que hay que elegir una nueva contraseña para continuar. El formulario en tarjeta centrada tiene dos campos — nueva contraseña y confirmación, mínimo 8 caracteres — y un botón "Guardar y continuar". Al enviar se llama la server action `changeOwnPasswordAction`, que usa la propia sesión del usuario (nunca el service role) para ejecutar `supabase.auth.updateUser`, fijando la contraseña y limpiando `must_change_password` en los metadatos. Los errores localizados cubren contraseña débil, reutilizar la misma, no coincidencia, sesión expirada y fallo genérico. Al terminar, el cliente navega a `/` y refresca. Pantallas relacionadas: Login, Equipo (cuyas acciones de administración crean usuarios con contraseña temporal) y el dashboard de inicio.

Fuente: src/app/[locale]/change-password/page.tsx, change-password-form.tsx, actions.ts.
Verifica: inicia sesión con una cuenta marcada must_change_password (por ejemplo, creada desde Equipo con contraseña temporal); serás redirigido a /change-password.
