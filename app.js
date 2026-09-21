(() => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.APP_CONFIG;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  const seededTrips = {
    edmonton:{date:"Nov 7–8",badge:"Road trip",title:"Edmonton Staycation",summary:"Low-effort first weekend while Jen adjusts to jet lag. Hotel, spa and shopping are the main point.",items:[["Pura Botanicals","Make-your-own perfume session for two."],["Hotel + spa","JW Marriott preferred; Fairmont Hotel Macdonald as the classic option."],["Sunday · WEM","West Edmonton Mall, MUJI and relaxed shopping."]]},
    toronto:{date:"Nov 16–18",badge:"3 PTO days",title:"Toronto + Niagara Falls",summary:"Niagara overnight, Markham Chinese food and half a day downtown.",items:[["Mon","YYZ → Niagara"],["Tue","Niagara → Markham → downtown"],["Wed","Half-day downtown → UP Express → YYZ"]]},
    remembrance:{date:"Nov 11",badge:"Both off",title:"Remembrance Day",summary:"Keep flexible because Jen may work late Nov 10.",items:[["Option A","Everwild Canmore day trip."],["Option B","UCalgary skating or easy Calgary date day."]]},
    spa:{date:"Nov 24",badge:"Evening",title:"Everwild Nordic Spa",summary:"Placeholder after-work spa night.",items:[]},
    ski1:{date:"Dec 1",badge:"Evening",title:"WinSport Ski Night",summary:"Tentative after-work ski evening.",items:[]},
    final:{date:"Dec 7–10",badge:"4 PTO days",title:"Final Days Together",summary:"Keep the final four days flexible for weather, ski conditions, Canmore and departure.",items:[]},
    ski2:{date:"Dec 8",badge:"PTO",title:"WinSport Ski Day",summary:"Second ski slot inside the final PTO block.",items:[]}
  };

  const seededEvents = {
    "2026-11-07":[{key:"seed:edmonton",label:"Edmonton · Day 1",type:"trip"}],
    "2026-11-08":[{key:"seed:edmonton",label:"Edmonton · Day 2",type:"trip"}],
    "2026-11-11":[{key:"seed:remembrance",label:"Both off",type:"local"}],
    "2026-11-16":[{key:"seed:toronto",label:"Toronto · Niagara",type:"trip"}],
    "2026-11-17":[{key:"seed:toronto",label:"Toronto · Markham",type:"trip"}],
    "2026-11-18":[{key:"seed:toronto",label:"Toronto · Downtown",type:"trip"}],
    "2026-11-24":[{key:"seed:spa",label:"Everwild spa",type:"activity"}],
    "2026-12-01":[{key:"seed:ski1",label:"WinSport ski",type:"activity"}],
    "2026-12-07":[{key:"seed:final",label:"PTO · final block",type:"trip"}],
    "2026-12-08":[{key:"seed:ski2",label:"PTO + WinSport",type:"activity"}],
    "2026-12-09":[{key:"seed:final",label:"PTO · open day",type:"trip"}],
    "2026-12-10":[{key:"seed:final",label:"Airport day",type:"trip"}]
  };

  const blocked = new Set();
  const addRange=(a,b)=>{let d=new Date(a+"T00:00:00Z"),e=new Date(b+"T00:00:00Z");while(d<=e){blocked.add(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}};
  addRange("2026-11-09","2026-11-10"); addRange("2026-11-12","2026-11-15"); addRange("2026-11-20","2026-11-22"); addRange("2026-11-27","2026-11-29"); addRange("2026-12-04","2026-12-06");

  let session=null, planner=null, events=[], wishes=[], wishFilter="open", selectedEvent=null;

  const $=id=>document.getElementById(id);
  const authPanel=$("authPanel"),plannerSetup=$("plannerSetup"),appShell=$("appShell"),syncStatus=$("syncStatus"),
  authForm=$("authForm"),authEmail=$("authEmail"),authMsg=$("authMsg"),setupMsg=$("setupMsg"),
  calendar=$("calendar"),tripCards=$("tripCards"),wishList=$("wishList"),openWishCount=$("openWishCount"),
  detailForm=$("detailForm"),addForm=$("addForm"),deletePlanBtn=$("deletePlanBtn");

  const prettyDate=iso=>new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));

  function setSync(text,ok=false){syncStatus.textContent=text;syncStatus.classList.toggle("ok",ok)}

  authForm.addEventListener("submit", async e=>{
    e.preventDefault();authMsg.textContent="Sending…";
    const {error}=await db.auth.signInWithOtp({email:authEmail.value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});
    authMsg.textContent=error?error.message:"Magic link sent. Check your email.";
  });

  $("signOutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.reload()});

  $("createPlannerForm").addEventListener("submit",async e=>{
    e.preventDefault();setupMsg.textContent="Creating…";
    const {data,error}=await db.from("planners").insert({name:$("plannerName").value.trim(),created_by:session.user.id}).select().single();
    if(error){setupMsg.textContent=error.message;return}
    planner=data;await loadPlannerData();showApp();
  });

  $("joinPlannerForm").addEventListener("submit",async e=>{
    e.preventDefault();setupMsg.textContent="Joining…";
    const {data,error}=await db.rpc("join_planner_by_code",{code:$("inviteCode").value.trim()});
    if(error){setupMsg.textContent=error.message;return}
    await loadMemberships(data);showApp();
  });

  async function boot(){
    const {data:{session:s}}=await db.auth.getSession();session=s;
    db.auth.onAuthStateChange(async(_,s2)=>{session=s2;if(session)await afterLogin()});
    if(session)await afterLogin(); else showAuth();
  }

  function showAuth(){authPanel.classList.remove("hidden");appShell.classList.add("hidden");$("signOutBtn").classList.add("hidden");setSync("Not connected")}

  async function afterLogin(){
    $("signOutBtn").classList.remove("hidden");
    authPanel.classList.remove("hidden");
    const found=await loadMemberships();
    if(!found){plannerSetup.classList.remove("hidden");authForm.parentElement.classList.add("hidden");setSync("Signed in");return}
    showApp();
  }

  async function loadMemberships(preferredId=null){
    const {data,error}=await db.from("planner_members").select("planner_id, role, planners(id,name,invite_code)").eq("user_id",session.user.id);
    if(error){setupMsg.textContent=error.message;return false}
    if(!data?.length)return false;
    const row=preferredId?data.find(x=>x.planner_id===preferredId)||data[0]:data[0];
    planner=row.planners;await loadPlannerData();return true;
  }

  async function loadPlannerData(){
    setSync("Syncing…");
    const [{data:e,error:ee},{data:w,error:we}] = await Promise.all([
      db.from("events").select("*").eq("planner_id",planner.id).order("event_date"),
      db.from("wishes").select("*").eq("planner_id",planner.id).order("created_at")
    ]);
    if(ee||we){setSync("Sync error");setupMsg.textContent=(ee||we).message;return}
    events=e||[];wishes=w||[];
    renderCalendar();renderCards();renderWishes();
    setSync("Synced",true);
  }

  function showApp(){
    authPanel.classList.add("hidden");plannerSetup.classList.add("hidden");appShell.classList.remove("hidden");
    $("plannerDisplayName").textContent=planner.name;$("plannerInviteCode").textContent=planner.invite_code;
    renderCalendar();renderCards();renderWishes();setSync("Synced",true);
  }

  function remoteEventsForDate(date){return events.filter(e=>e.event_date===date)}

  function renderCalendar(){
    calendar.innerHTML="";
    const start=new Date("2026-11-02T00:00:00Z"),end=new Date("2026-12-13T00:00:00Z");
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=d.toISOString().slice(0,10),inRange=iso>="2026-11-04"&&iso<="2026-12-10";
      const cell=document.createElement("div");cell.className="day";if(!inRange)cell.classList.add("out");else if(blocked.has(iso))cell.classList.add("workday");
      const top=document.createElement("div");top.className="day-top";const n=document.createElement("div");n.className="day-num";n.textContent=d.getUTCDate();top.appendChild(n);
      if(inRange&&!blocked.has(iso)){const add=document.createElement("button");add.type="button";add.className="day-add";add.textContent="+";add.onclick=()=>openAdd(iso);top.appendChild(add)}
      cell.appendChild(top);
      if(blocked.has(iso)&&inRange){const w=document.createElement("div");w.className="work-note";w.textContent="Jen working";cell.appendChild(w)}
      if(inRange){
        (seededEvents[iso]||[]).forEach(ev=>{const p=document.createElement("button");p.className="event-pill "+ev.type;p.textContent=ev.label;p.onclick=()=>openSeed(ev.key);cell.appendChild(p)});
        remoteEventsForDate(iso).forEach(ev=>{const p=document.createElement("button");p.className="event-pill "+ev.event_type;p.textContent=ev.title;p.onclick=()=>openRemoteEvent(ev);cell.appendChild(p)});
      }
      calendar.appendChild(cell);
    }
  }

  function renderCards(){
    tripCards.innerHTML="";
    ["edmonton","toronto","final"].forEach(key=>{const t=seededTrips[key],b=document.createElement("button");b.className="trip-card";
      b.innerHTML='<div class="date">'+t.date.toUpperCase()+'</div><div class="title">'+t.title+'</div><div class="sub">'+t.summary+'</div>';b.onclick=()=>openSeed("seed:"+key);tripCards.appendChild(b)
    });
  }

  function openSeed(key){
    selectedEvent=null;const k=key.replace("seed:",""),t=seededTrips[k];if(!t)return;
    $("detailDate").textContent=t.date.toUpperCase();$("detailTitle").textContent=t.title;$("detailBadge").textContent=t.badge;$("detailSummary").textContent=t.summary;
    $("detailItems").innerHTML="";(t.items||[]).forEach(([h,s])=>{$("detailItems").insertAdjacentHTML("beforeend",'<div class="detail-item"><strong>'+h+'</strong><span>'+s+'</span></div>')});
    detailForm.classList.add("hidden");addForm.classList.add("hidden");
  }

  function openRemoteEvent(ev){
    selectedEvent=ev;
    $("detailDate").textContent=prettyDate(ev.event_date).toUpperCase();$("detailTitle").textContent=ev.title;$("detailBadge").textContent=ev.is_pto?"PTO":ev.event_type;$("detailSummary").textContent=ev.summary||"No notes yet.";$("detailItems").innerHTML="";
    $("editKey").value=ev.id;$("editTitle").value=ev.title;$("editSummary").value=ev.summary||"";detailForm.classList.remove("hidden");addForm.classList.add("hidden");$("saveMsg").textContent="";
  }

  function openAdd(date="",prefill=null){
    selectedEvent=null;detailForm.classList.add("hidden");$("detailItems").innerHTML="";
    $("detailDate").textContent=date?prettyDate(date).toUpperCase():"NEW PLAN";$("detailTitle").textContent="Add something to the calendar";$("detailBadge").textContent="New";$("detailSummary").textContent=prefill?"Schedule this wish on the calendar.":"Create a shared event.";
    $("addDate").value=date;$("addType").value=prefill?.type||"activity";$("addTitle").value=prefill?.title||"";$("addSummary").value=prefill?.notes||"";$("addPto").checked=false;$("sourceWishId").value=prefill?.id||"";$("addMsg").textContent="";addForm.classList.remove("hidden");
  }

  $("addPlanBtn").onclick=()=>openAdd("");
  $("cancelAddBtn").onclick=()=>{addForm.classList.add("hidden")};

  detailForm.addEventListener("submit",async e=>{
    e.preventDefault();if(!selectedEvent)return;$("saveMsg").textContent="Saving…";
    const {error}=await db.from("events").update({title:$("editTitle").value.trim(),summary:$("editSummary").value.trim()}).eq("id",selectedEvent.id);
    if(error){$("saveMsg").textContent=error.message;return}
    await loadPlannerData();const updated=events.find(x=>x.id===selectedEvent.id);if(updated)openRemoteEvent(updated);$("saveMsg").textContent="Saved.";
  });

  deletePlanBtn.addEventListener("click",async()=>{
    if(!selectedEvent)return;if(!confirm("Delete this shared plan?"))return;
    const {error}=await db.from("events").delete().eq("id",selectedEvent.id);
    if(error){$("saveMsg").textContent=error.message;return}
    await loadPlannerData();detailForm.classList.add("hidden");$("detailTitle").textContent="Trip & event details";$("detailSummary").textContent="Choose a planned date to see details.";
  });

  addForm.addEventListener("submit",async e=>{
    e.preventDefault();const date=$("addDate").value;if(blocked.has(date)){$("addMsg").textContent="That day is marked as Jen working.";return}
    $("addMsg").textContent="Saving…";
    const wishId=$("sourceWishId").value||null;
    const payload={planner_id:planner.id,event_date:date,title:$("addTitle").value.trim(),summary:$("addSummary").value.trim(),event_type:$("addType").value,is_pto:$("addPto").checked,source_wish_id:wishId,created_by:session.user.id};
    const {data,error}=await db.from("events").insert(payload).select().single();
    if(error){$("addMsg").textContent=error.message;return}
    if(wishId)await db.from("wishes").update({status:"planned",scheduled_event_id:data.id}).eq("id",wishId);
    await loadPlannerData();openRemoteEvent(data);
  });

  function renderWishes(){
    openWishCount.textContent=wishes.filter(w=>w.status==="open").length;
    const rows=wishes.filter(w=>wishFilter==="all"||(wishFilter==="open"?w.status==="open":w.status!=="open"));
    wishList.innerHTML="";
    if(!rows.length){wishList.innerHTML='<div class="wish-empty">Nothing here yet.</div>';return}
    rows.slice().reverse().forEach(w=>{
      const card=document.createElement("div");card.className="wish-card"+(w.status!=="open"?" resolved":"");
      const main=document.createElement("div");main.innerHTML='<div class="wish-title"></div><div class="wish-meta"><span class="wish-status"></span><span></span></div>'+(w.notes?'<div class="wish-notes"></div>':'');
      main.querySelector(".wish-title").textContent=w.title;main.querySelector(".wish-status").textContent=w.status;main.querySelector(".wish-meta span:last-child").textContent=w.category;if(w.notes)main.querySelector(".wish-notes").textContent=w.notes;
      const actions=document.createElement("div");actions.className="wish-actions";
      if(w.status==="open"){
        const schedule=document.createElement("button");schedule.className="schedule";schedule.textContent="Schedule";schedule.onclick=()=>openAdd("",{id:w.id,title:w.title,notes:w.notes,type:w.category==="trip"?"trip":"activity"});
        const resolve=document.createElement("button");resolve.textContent="Resolve";resolve.onclick=async()=>{await db.from("wishes").update({status:"resolved"}).eq("id",w.id);await loadPlannerData()};
        actions.append(schedule,resolve);
      } else {
        const reopen=document.createElement("button");reopen.textContent="Reopen";reopen.onclick=async()=>{await db.from("wishes").update({status:"open",scheduled_event_id:null}).eq("id",w.id);await loadPlannerData()};actions.append(reopen);
      }
      const del=document.createElement("button");del.className="delete";del.textContent="Delete";del.onclick=async()=>{if(!confirm("Delete this wish?"))return;await db.from("wishes").delete().eq("id",w.id);await loadPlannerData()};actions.append(del);
      card.append(main,actions);wishList.appendChild(card);
    });
  }

  $("wishForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const payload={planner_id:planner.id,title:$("wishTitle").value.trim(),notes:$("wishNotes").value.trim(),category:$("wishCategory").value,status:"open",created_by:session.user.id};
    const {error}=await db.from("wishes").insert(payload);if(error){alert(error.message);return}
    e.target.reset();$("wishCategory").value="activity";wishFilter="open";await loadPlannerData();
  });

  function setWishFilter(f){wishFilter=f;["showOpenWishes","showResolvedWishes","showAllWishes"].forEach(id=>$(id).classList.remove("active"));$(f==="open"?"showOpenWishes":f==="planned"?"showResolvedWishes":"showAllWishes").classList.add("active");renderWishes()}
  $("showOpenWishes").onclick=()=>setWishFilter("open");$("showResolvedWishes").onclick=()=>setWishFilter("planned");$("showAllWishes").onclick=()=>setWishFilter("all");

  boot();
})();