# OPIUM WEALTH BOT: TITAN EDITION

Deployable online PWA starter with:
- Supabase email/password authentication and member profiles
- Shared public chat with Supabase Realtime
- Private member-to-admin messages with row-level security
- Admin/owner publishing for market ideas and bulletins
- TradingView charts, ticker tape, economic calendar and news embeds
- Mobile-responsive layout and installable PWA manifest

## Important status
This is a deployable application starter, not a hosted live website yet. It becomes online only after you create a Supabase project, add its URL and anon key to `config.js`, run the SQL schema, and deploy the files to a web host. No broker connection or trade execution exists. TradingView embeds may show delayed data depending on instrument/exchange.

## 1. Create Supabase backend
1. Create a project at https://supabase.com/
2. Open SQL Editor and run all of `supabase/schema.sql`.
3. In Project Settings > API, copy the Project URL and `anon`/publishable key.
4. Put them in `config.js`. Do not use the `service_role` secret key.
5. In Authentication settings, configure your site URL and allowed redirect URLs after deployment. For first tests, email confirmation may be turned off in Supabase Auth settings; otherwise confirm the signup email.

## 2. Create owner account
1. Set `OWNER_EMAIL` in `config.js` to the owner email you control.
2. Register in the app with that email.
3. Confirm the email if required.
4. Run the owner UPDATE statement at the bottom of `supabase/schema.sql` in SQL Editor (or run an equivalent update for your chosen owner email).
5. To appoint an admin, use SQL Editor:
   `update public.profiles set role='admin' where id=(select id from auth.users where email='admin@example.com');`
   Replace the email with the real account. Do not expose service credentials in the app.

## 3. Deploy free static hosting
You can use GitHub Pages, Netlify, or Cloudflare Pages. Upload the contents of this folder (not the enclosing folder) to your chosen host. For Netlify, drag the project folder into the Netlify deploy area or connect the GitHub repository. For Cloudflare Pages, connect the repository and use no build command; output directory is `/`.
Set the deployed site URL in Supabase Authentication > URL Configuration.

## 4. Install on Android
Open the deployed HTTPS URL in Chrome > menu (⋮) > Add to Home screen / Install app.

## Security and limitations
- The browser uses only the Supabase anon key. Never paste the service_role key into client files.
- Supabase RLS restricts private messages to sender/recipient and permits member-to-admin messages only.
- Role/rank changes are intentionally owner-controlled via SQL in this starter. A polished admin-management screen and stronger operational audit trail are future work.
- Public/private chat requires the Supabase project to be online and configured.
- Chart/news/calendar content is embedded from TradingView and requires internet access. Exchange quote delays/licensing are outside this app.
- This is an information product only: no buy/sell/order buttons, broker API keys, or execution code.
