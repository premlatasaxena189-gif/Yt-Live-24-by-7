const $ = id => document.getElementById(id);
const note = (text, ok=false) => { $("notice").textContent=text; $("notice").className=ok?"notice ok":"notice"; };
async function api(url, options={}) {
  const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Request failed");
  return d;
}
const fmt = n => n==null?"Hidden":Number(n).toLocaleString();
async function loadBroadcasts(){
  try{
    const d=await api("/api/broadcasts"), box=$("broadcastlist"); box.innerHTML="";
    if(!d.items.length){box.textContent="अभी कोई broadcast नहीं है।";return;}
    d.items.forEach(item=>{
      const row=document.createElement("div");row.className="playlistrow";
      const title=document.createElement("b");title.textContent=item.snippet?.title||"Untitled";
      const meta=document.createElement("div");meta.className="hint";
      meta.textContent=(item.status?.lifeCycleStatus||"Status") + " · " + new Date(item.snippet?.scheduledStartTime||Date.now()).toLocaleString();
      row.append(title,meta);box.append(row);
    });
  }catch(e){note(e.message);}
}
async function loadChannel(){
  try{
    const d=await api("/api/me");
    if(!d.channel){note("Google account connected, लेकिन channel नहीं मिला।");return;}
    $("channel").textContent=d.channel.title||"Channel";
    $("channelid").textContent=d.channel.id;
    $("subs").textContent=fmt(d.channel.subscribers);
    $("views").textContent=fmt(d.channel.views);
    $("videos").textContent=fmt(d.channel.videos);
    $("connect").textContent="Connected";
    note("YouTube channel सफलतापूर्वक connect हो गया।",true);
    await loadBroadcasts();
  }catch(e){note(e.message);}
}
$("connect").onclick=()=>location.href="/auth/google";
$("refresh").onclick=loadBroadcasts;
$("broadcastform").onsubmit=async e=>{
  e.preventDefault();
  try{
    const dt=new Date($("start").value);
    if(!Number.isFinite(dt.getTime()))throw new Error("सही start date/time चुनें।");
    await api("/api/broadcasts",{method:"POST",body:JSON.stringify({title:$("title").value,description:$("description").value,scheduledStartTime:dt.toISOString()})});
    note("Private broadcast बन गया। Video भेजने के लिए encoder connect करें।",true);
    e.target.reset();await loadBroadcasts();
  }catch(err){note(err.message);}
};
$("playlistform").onsubmit=async e=>{
  e.preventDefault();
  try{
    const d=await api("/api/playlists/"+encodeURIComponent($("playlistid").value.trim()));
    const box=$("playlistresult");box.innerHTML="";
    const h=document.createElement("b");h.textContent=d.playlist?.snippet?.title||"Playlist";box.append(h);
    (d.items||[]).forEach(i=>{const row=document.createElement("div");row.className="playlistrow";row.textContent=i.snippet?.title||"Untitled video";box.append(row);});
  }catch(err){$("playlistresult").textContent=err.message;}
};
(async()=>{try{const c=await api("/api/config");if(!c.configured){note("Setup बाकी है: Hosting में Google OAuth credentials और SESSION_SECRET भरें।");return;}await loadChannel();}catch(e){note(e.message);}})();
