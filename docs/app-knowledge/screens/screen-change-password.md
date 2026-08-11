---
slug: screen-change-password
route: /change-password
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/change-password/page.tsx
  - src/app/[locale]/change-password/change-password-form.tsx
  - src/app/[locale]/change-password/actions.ts
  - src/app/[locale]/(app)/layout.tsx
  - src/app/[locale]/(auth)/actions.ts
---

# EN: Change password screen

A standalone password screen at `/change-password` that deliberately lives outside the `(app)` route group (no app shell), so the forced-change gate in the app layout can redirect here without a loop. It requires a session: the page calls `supabase.auth.getUser()` and redirects to `/login` if there is none. It then reads two things — `user_metadata.must_change_password` (the `forced` flow, set when an admin created the login with a temporary password) and a `mode` from the query string: `?recovery=1` arrives from the reset email sent by `requestPasswordResetAction`, `?invite=1` from `inviteMemberAction`. The heading and copy change accordingly ("Create your password" for an invite, otherwise "Set a new password"). The centered card asks for a new password and its confirmation, both **minimum 12 characters**, and a "Save and continue" button. Submitting calls `changeOwnPasswordAction`, which uses the user's own session — never the service role — to run `supabase.auth.updateUser`, setting the password and clearing `must_change_password`. Errors cover weak password, reusing the same password, mismatch, expired session and a generic failure; strings here are hardcoded EN/ES pairs rather than next-intl keys. In recovery or invite mode it shows a "Password updated" confirmation with a Continue button; otherwise it navigates straight to `/`. Related: screen-login, screen-org-members, screen-team.
Source: change-password/page.tsx, change-password-form.tsx, change-password/actions.ts.
Verify: sign in with an account flagged `must_change_password` (created from Members with a temp password) — you land on /change-password.

# ES: Pantalla Cambio de contraseña

Una pantalla independiente en `/change-password` que vive a propósito fuera del grupo `(app)` (sin shell de la aplicación), para que la puerta de cambio forzado del layout pueda redirigir aquí sin bucles. Exige sesión: la página llama `supabase.auth.getUser()` y redirige a `/login` si no la hay. Luego lee dos cosas: `user_metadata.must_change_password` (el flujo `forced`, activo cuando un administrador creó el acceso con clave temporal) y un `mode` en la cadena de consulta: `?recovery=1` llega desde el correo de recuperación que envía `requestPasswordResetAction` y `?invite=1` desde `inviteMemberAction`. El título y el texto cambian según el caso ("Crea tu contraseña" en una invitación; si no, "Establece una nueva contraseña"). La tarjeta centrada pide la nueva contraseña y su confirmación, ambas de **mínimo 12 caracteres**, con el botón "Guardar y continuar". Al enviar se llama `changeOwnPasswordAction`, que usa la sesión del propio usuario —nunca el service role— para ejecutar `supabase.auth.updateUser`, fijar la contraseña y limpiar `must_change_password`. Los errores cubren contraseña débil, reutilizar la misma, no coincidencia, sesión expirada y fallo genérico; estos textos son pares EN/ES escritos en el componente, no claves de next-intl. En modo recuperación o invitación aparece una confirmación "Contraseña actualizada" con botón Continuar; en el resto de casos navega directo a `/`. Relacionadas: screen-login, screen-org-members, screen-team.
Fuente: change-password/page.tsx, change-password-form.tsx, change-password/actions.ts.
Verifica: inicia sesión con una cuenta marcada `must_change_password` (creada desde Miembros con clave temporal) y comprueba que llegas a /change-password.
