# YT LIVE 24 BY 7 — Upload-ready starter

यह Node.js वेबसाइट starter है। इसमें responsive dashboard, Google OAuth, अपने YouTube channel के उपलब्ध statistics, live broadcasts list/create और playlist lookup शामिल हैं।

## जरूरी बातें
- यह शुरुआती deployable code है, पहले से hosted/live website नहीं।
- Broadcast schedule/create करने से अपने-आप video stream नहीं होती। असली live video के लिए OBS या अलग cloud encoder/FFmpeg worker और सुरक्षित stream-key handling चाहिए।
- यह अभी single-session starter है; public multi-user accounts, billing, database-backed user management और 24×7 cloud encoder अभी शामिल नहीं हैं।
- Fake views, subscribers या watch time बनाने की सुविधा नहीं है।

## GitHub पर upload
1. ZIP extract करें।
2. GitHub में अपनी `Yt-Live-24-by-7` repository खोलें।
3. `Add file` → `Upload files` चुनें।
4. Extract किए गए folder के अंदर की सभी files upload करें (folder के भीतर folder nesting न बनाएं)।
5. Commit changes करें।

## Google API setup
1. Google Cloud Console में project बनाएं।
2. YouTube Data API v3 enable करें।
3. OAuth consent screen configure करें।
4. OAuth Client ID बनाएं: Web application.
5. Authorized redirect URI जोड़ें: `https://YOUR-APP-DOMAIN/auth/google/callback`
6. Hosting service में `.env.example` के सभी values environment variables के रूप में सेट करें। `.env` कभी GitHub पर upload न करें।

## Render deploy (उदाहरण)
- New → Web Service → GitHub repository connect.
- Build command: `npm install`
- Start command: `npm start`
- Node version: 20+
- Environment variables: `APP_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- OAuth redirect URI में deployed domain का exact callback URL दें।

Production multi-user use से पहले persistent session store, database, CSRF/rate limiting, account ownership controls और token encryption जोड़ना जरूरी है।
