-- Vaquero's — permisos de tabla
-- Los proyectos nuevos de Supabase no otorgan privilegios por defecto a los
-- roles de la API; sin esto, ni el servidor puede usar las tablas.
-- Las políticas RLS de 0001 siguen decidiendo QUÉ filas ve cada quien.
-- Idempotente: se puede volver a correr.

-- Servidor (clave secreta): crea pedidos desde el webhook de Stripe y los consulta.
grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.staff  to service_role;

-- Equipo (usuarios autenticados en `staff`): leer pedidos y cambiar solo el estatus.
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant select on public.staff to authenticated;

-- Clientes anónimos: sin acceso directo a ninguna tabla.
revoke all on public.orders from anon;
revoke all on public.staff  from anon;

grant execute on function public.is_staff() to authenticated;
revoke execute on function public.is_staff() from anon;
