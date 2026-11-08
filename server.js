require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const crypto = require("crypto");
const path = require("path");
const { google } = require("googleapis");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "SESSION_SECRET"];
const missing = required.filter(k => !process.env[k]);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(session({
  name: "ytlive.sid",
  secret: process.env.SESSION_SECRET || "development-secret-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 }
}));
app.use(express.static(path.join(__dirname, "public")));

function oauth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}
function youtube(req) {
  if (!req.session.tokens) return null;
  const auth = oauth();
  auth.setCredentials(req.session.tokens);
  auth.on("tokens", tokens => { req.session.tokens = { ...req.session.tokens, ...tokens }; });
  return google.youtube({ version: "v3", auth });
}
function needYoutube(req, res, next) {
  const client = youtube(req);
  if (!client) return res.status(401).json({ error: "पहले अपना YouTube अकाउंट कनेक्ट करें।" });
  req.yt = client;
  next();
}

app.get("/api/config", (_req, res) => res.json({ configured: missing.length === 0, missing }));
app.get("/auth/google", (req, res) => {
  if (missing.length) return res.status(503).send("Google OAuth सेटअप अधूरा है। Hosting environment में .env.example के variables भरें।");
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;
  res.redirect(oauth().generateAuthUrl({
    access_type: "offline", prompt: "consent", state,
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube"
    ]
  }));
});
app.get("/auth/google/callback", async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.oauthState) return res.status(400).send("OAuth state invalid. फिर से कनेक्ट करें।");
    delete req.session.oauthState;
    const { tokens } = await oauth().getToken(String(req.query.code));
    req.session.tokens = tokens;
    res.redirect("/");
  } catch (e) {
    console.error("OAuth callback:", e.message);
    res.status(500).send("Google account connect नहीं हुआ। OAuth settings जाँचें।");
  }
});
app.post("/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get("/api/me", needYoutube, async (req, res) => {
  try {
    const out = await req.yt.channels.list({ part: ["snippet", "statistics", "contentDetails"], mine: true });
    const c = out.data.items?.[0];
    if (!c) return res.json({ channel: null });
    res.json({ channel: {
      id: c.id, title: c.snippet?.title, thumbnail: c.snippet?.thumbnails?.default?.url,
      subscribers: c.statistics?.subscriberCount ?? null,
      views: c.statistics?.viewCount ?? null,
      videos: c.statistics?.videoCount ?? null
    }});
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Channel data नहीं मिल पाया। API access जाँचें।" }); }
});

app.get("/api/broadcasts", needYoutube, async (req, res) => {
  try {
    const out = await req.yt.liveBroadcasts.list({ part: ["snippet", "status", "contentDetails"], broadcastStatus: "all", maxResults: 25 });
    res.json({ items: out.data.items || [] });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Broadcast list नहीं मिली। Live eligibility और API quota जाँचें।" }); }
});

app.post("/api/broadcasts", needYoutube, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim().slice(0, 100);
    const description = String(req.body.description || "").trim().slice(0, 5000);
    const start = String(req.body.scheduledStartTime || "");
    if (!title || !start || !Number.isFinite(Date.parse(start))) return res.status(400).json({ error: "Title और valid start time जरूरी हैं।" });
    if (Date.parse(start) < Date.now() + 60000) return res.status(400).json({ error: "कम-से-कम एक मिनट आगे का समय चुनें।" });
    const out = await req.yt.liveBroadcasts.insert({
      part: ["snippet", "status", "contentDetails"],
      requestBody: {
        snippet: { title, description, scheduledStartTime: start },
        status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: false, enableAutoStop: false }
      }
    });
    res.status(201).json({ item: out.data });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Broadcast create नहीं हुआ। Channel live eligibility/API quota जाँचें।" }); }
});

app.get("/api/playlists/:id", needYoutube, async (req, res) => {
  try {
    const id = String(req.params.id).slice(0, 100);
    const [p, items] = await Promise.all([
      req.yt.playlists.list({ part: ["snippet", "contentDetails"], id }),
      req.yt.playlistItems.list({ part: ["snippet", "contentDetails"], playlistId: id, maxResults: 50 })
    ]);
    res.json({ playlist: p.data.items?.[0] || null, items: items.data.items || [] });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Playlist नहीं मिली। ID और permissions जाँचें।" }); }
});

app.get("/health", (_req, res) => res.json({ ok: true, app: "YT Live 24 by 7" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`YT Live 24 by 7 listening on ${PORT}; missing env: ${missing.join(", ")}`));
