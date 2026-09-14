# YN POS on Render

YN POS is a Vite frontend that can be hosted as a Render **Static Site**. It does not need a Node server at runtime because Supabase is accessed from the browser.

Recommended Render settings:

- Service type: **Static Site**
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Using a Static Site avoids the Free Web Service sleep/cold-start loading page. The app now includes its own YN POS welcome animation instead.

Keep the existing Supabase environment variables configured for the build.
