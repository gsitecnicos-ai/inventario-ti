-- Replace the email, then run with a privileged SQL role in Supabase.
insert into public.global_admins (user_id)
select auth_user.id
from auth.users auth_user
where auth_user.email = 'admin@empresa.com'
on conflict (user_id) do nothing;
