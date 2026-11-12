/* OPIUM WEALTH BOT: TITAN EDITION — client app. Uses Supabase Auth, Postgres and Realtime. */
(() => {
 const cfg=window.TITAN_CONFIG||{};
 const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("YOUR_")&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_");
 const $=id=>document.getElementById(id);
 const authView=$("authView"),appView=$("appView"),warning=$("configWarning");
 let sb=null,user=null,profile=null,authMode="login",activeAdmin=null,channel=null,dmChannel=null;
 if(!configured){warning.classList.remove("hidden");$("connection").textContent="Setup required";return}
 sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 $("connection").textContent="Connecting…";
 document.querySelectorAll("[data-auth]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.auth)));
 function setAuthMode(mode){authMode=mode;document.querySelectorAll("[data-auth]").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));$("nickname").classList.toggle("hidden",mode!=="signup");$("nicknameLabel").classList.toggle("hidden",mode!=="signup");$("authSubmit").textContent=mode==="signup"?"Create account":"Log in";$("password").autocomplete=mode==="signup"?"new-password":"current-password"}
 $("authForm").addEventListener("submit",async e=>{e.preventDefault();$("authMessage").textContent="Please wait…";const email=$("email").value.trim(),password=$("password").value;let res;
  if(authMode==="signup"){const nickname=$("nickname").value.trim();if(!nickname){$("authMessage").textContent="Choose a nickname.";return}res=await sb.auth.signUp({email,password,options:{data:{nickname}}})}
  else res=await sb.auth.signInWithPassword({email,password});
  if(res.error){$("authMessage").textContent=res.error.message;return}
  $("authMessage").textContent=authMode==="signup"?"Account created. Check your email if confirmation is required.":"Signed in.";
  if(res.data.session)await loadSession(res.data.session.user);
 });
 $("logoutBtn").addEventListener("click",()=>sb.auth.signOut());
 sb.auth.onAuthStateChange(async(_event,session)=>{if(session)await loadSession(session.user);else showLoggedOut()});
 sb.auth.getSession().then(({data})=>data.session?loadSession(data.session.user):showLoggedOut());
 async function loadSession(u){user=u;let {data,error}=await sb.from("profiles").select("*").eq("id",u.id).maybeSingle();if(error){console.error(error);return}
  if(!data){const nick=u.user_metadata?.nickname||u.email.split("@")[0];const ins=await sb.from("profiles").insert({id:u.id,nickname:nick}).select().single();data=ins.data}
  profile=data;showLoggedIn();await Promise.all([loadPosts(),loadPublicMessages(),loadAdmins()]);subscribePublic();
 }
 function showLoggedOut(){authView.classList.remove("hidden");appView.classList.add("hidden");$("logoutBtn").classList.add("hidden");$("connection").textContent="Offline / signed out";user=null;profile=null;if(channel){sb.removeChannel(channel);channel=null}}
 function showLoggedIn(){authView.classList.add("hidden");appView.classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("connection").textContent="Online account";$("welcomeName").textContent=profile.nickname;$("roleBadge").textContent=profile.role.toUpperCase();$("roleValue").textContent=profile.role;$("rankValue").textContent=profile.rank;
  document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",!["owner","admin"].includes(profile.role)));
 }
 document.querySelectorAll(".navbtn").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".navbtn").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+b.dataset.view));if(b.dataset.view==="private")loadAdmins();if(b.dataset.view==="admin")loadMembers()}));
 function escape(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
 async function loadPosts(){const {data,error}=await sb.from("posts").select("*,profiles(nickname)").order("created_at",{ascending:false}).limit(30);if(error){console.warn(error);return}
  const ideas=(data||[]).filter(p=>p.kind==="idea"),all=(data||[]);
  $("ideaFeed").innerHTML=ideas.length?ideas.map(postHTML).join(""):'<p class="muted">No published ideas yet.</p>';
  $("analysisFeed").innerHTML=all.length?all.map(postHTML).join(""):'<p class="muted">No analysis published yet.</p>';
 }
 function postHTML(p){return `<article class="post"><div class="meta">${escape(p.kind.toUpperCase())} · ${escape(p.profiles?.nickname||"TITAN Admin")} · ${new Date(p.created_at).toLocaleString()}</div><h3>${escape(p.title)} ${p.symbol?`— ${escape(p.symbol)}`:""}</h3><div>${escape(p.body).replace(/\n/g,"<br>")}</div>${p.source?`<p class="muted">Source: ${escape(p.source)}</p>`:""}</article>`}
 $("publishForm").addEventListener("submit",async e=>{e.preventDefault();if(!["owner","admin"].includes(profile.role))return;const payload={author_id:user.id,kind:$("postType").value,title:$("postTitle").value.trim(),symbol:$("postSymbol").value.trim()||null,body:$("postBody").value.trim(),source:$("postSource").value.trim()||null};const {error}=await sb.from("posts").insert(payload);$("adminStatus").textContent=error?error.message:"Published.";if(!error){e.target.reset();loadPosts()}});
 async function loadPublicMessages(){const {data,error}=await sb.from("public_messages").select("id,body,created_at,user_id,profiles(nickname,role)").order("created_at",{ascending:true}).limit(100);if(error){console.warn(error);return}$("publicMessages").innerHTML=(data||[]).map(messageHTML).join("");scrollBottom("publicMessages")}
 function messageHTML(m){return `<div class="message"><div class="meta">${escape(m.profiles?.nickname||"Member")} ${m.profiles?.role==="admin"||m.profiles?.role==="owner"?"♛":""} · ${new Date(m.created_at).toLocaleTimeString()}</div>${escape(m.body)}</div>`}
 function subscribePublic(){if(channel)sb.removeChannel(channel);channel=sb.channel("titan-public-chat").on("postgres_changes",{event:"INSERT",schema:"public",table:"public_messages"},async payload=>{const {data}=await sb.from("public_messages").select("id,body,created_at,user_id,profiles(nickname,role)").eq("id",payload.new.id).single();if(data){const el=document.createElement("div");el.innerHTML=messageHTML(data);$("publicMessages").append(el.firstElementChild);scrollBottom("publicMessages")}}).subscribe()}
 $("publicChatForm").addEventListener("submit",async e=>{e.preventDefault();const body=$("publicMessage").value.trim();if(!body)return;const {error}=await sb.from("public_messages").insert({user_id:user.id,body});if(error)alert(error.message);else $("publicMessage").value=""});
 function scrollBottom(id){const el=$(id);el.scrollTop=el.scrollHeight}
 async function loadAdmins(){const {data,error}=await sb.from("profiles").select("id,nickname,role").in("role",["owner","admin"]).order("nickname");if(error){$("adminList").textContent="Could not load administrators.";return}
  $("adminList").innerHTML=(data||[]).map(a=>`<button class="admin-choice ${activeAdmin===a.id?"active":""}" data-id="${a.id}">♛ ${escape(a.nickname)} · ${a.role}</button>`).join("")||'<p class="muted">No administrators listed yet.</p>';
  document.querySelectorAll(".admin-choice").forEach(b=>b.addEventListener("click",()=>selectAdmin(b.dataset.id,data.find(x=>x.id===b.dataset.id))));
 }
 async function selectAdmin(id,admin){activeAdmin=id;document.querySelectorAll(".admin-choice").forEach(b=>b.classList.toggle("active",b.dataset.id===id));$("dmHeading").textContent="Private conversation with "+admin.nickname;$("dmMessage").disabled=false;$("dmSend").disabled=false;await loadDM();if(dmChannel)sb.removeChannel(dmChannel);dmChannel=sb.channel("titan-dm-"+[user.id,id].sort().join("-")).on("postgres_changes",{event:"INSERT",schema:"public",table:"private_messages",filter:`recipient_id=eq.${user.id}`},loadDM).subscribe()}
 async function loadDM(){if(!activeAdmin)return;const {data,error}=await sb.from("private_messages").select("id,sender_id,recipient_id,body,created_at").or(`and(sender_id.eq.${user.id},recipient_id.eq.${activeAdmin}),and(sender_id.eq.${activeAdmin},recipient_id.eq.${user.id})`).order("created_at").limit(150);if(error){$("dmMessages").innerHTML='<p class="muted">Private messages are unavailable.</p>';return}
  $("dmMessages").innerHTML=(data||[]).map(m=>`<div class="message"><div class="meta">${m.sender_id===user.id?"You":"Administrator"} · ${new Date(m.created_at).toLocaleTimeString()}</div>${escape(m.body)}</div>`).join("");scrollBottom("dmMessages")}
 $("dmForm").addEventListener("submit",async e=>{e.preventDefault();const body=$("dmMessage").value.trim();if(!body||!activeAdmin)return;const {error}=await sb.from("private_messages").insert({sender_id:user.id,recipient_id:activeAdmin,body});if(error)alert(error.message);else{$("dmMessage").value="";loadDM()}});
 async function loadMembers(){if(!["owner","admin"].includes(profile.role))return;const {data,error}=await sb.from("profiles").select("nickname,role,rank,created_at").order("created_at",{ascending:false}).limit(100);$("memberDirectory").innerHTML=error?escape(error.message):(data||[]).map(p=>`<div class="post"><b>${escape(p.nickname)}</b><div class="meta">${escape(p.role)} · ${escape(p.rank)}</div></div>`).join("")}
 $("chartSymbol").addEventListener("change",renderChart);$("chartInterval").addEventListener("change",renderChart);renderChart();
 function renderChart(){const symbol=$("chartSymbol").value,interval=$("chartInterval").value,el=$("chartContainer");el.innerHTML="";const iframe=document.createElement("iframe");iframe.title="TradingView chart";iframe.loading="lazy";iframe.src="https://s.tradingview.com/widgetembed/?frameElementId=titan_chart&symbol="+encodeURIComponent(symbol)+"&interval="+encodeURIComponent(interval)+"&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0f0f0f&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&locale=en";iframe.allowFullscreen=true;el.appendChild(iframe)}
})();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) { window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn)); }
