(() => {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.APP_CONFIG;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  let session=null, planner=null, events=[], wishes=[], itineraries=[], availability=[], tasks=[], wishFilter="open", taskFilter="open", selectedEvent=null, selectedItinerary=null;

  const $=id=>document.getElementById(id);
  const authPanel=$("authPanel"),plannerSetup=$("plannerSetup"),appShell=$("appShell"),syncStatus=$("syncStatus"),
  authForm=$("authForm"),authEmail=$("authEmail"),authMsg=$("authMsg"),setupMsg=$("setupMsg"),
  calendar=$("calendar"),tripCards=$("tripCards"),wishList=$("wishList"),openWishCount=$("openWishCount"),
  detailForm=$("detailForm"),addForm=$("addForm"),itineraryForm=$("itineraryForm"),deletePlanBtn=$("deletePlanBtn"),
  detailPanel=$("detailPanel"),detailBackdrop=$("detailBackdrop");

  const prettyDate=iso=>new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));
  const shortDate=iso=>new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));
  const isoDate=d=>d.toISOString().slice(0,10);
  const setSync=(text,ok=false)=>{syncStatus.textContent=text;syncStatus.classList.toggle("ok",ok)};

  authForm.addEventListener("submit", async e=>{
    e.preventDefault();authMsg.textContent="Sending…";
    const {error}=await db.auth.signInWithOtp({email:authEmail.value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});
    authMsg.textContent=error?error.message:"Magic link sent. Check your email.";
  });

  $("signOutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.reload()});

  $("createPlannerForm").addEventListener("submit",async e=>{
    e.preventDefault();setupMsg.textContent="Creating…";
    const {data,error}=await db.rpc("create_planner",{
      planner_name:$("plannerName").value.trim(),
      planner_start_date:$("plannerStartDate").value,
      planner_end_date:$("plannerEndDate").value,
      planner_pto_allowance:Number($("plannerPtoAllowance").value||0)
    });
    if(error){setupMsg.textContent=error.message;return}
    planner=Array.isArray(data)?data[0]:data;
    await loadPlannerData();showApp();
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
    if(session)await afterLogin();else showAuth();
  }

  function showAuth(){
    authPanel.classList.remove("hidden");appShell.classList.add("hidden");$("signOutBtn").classList.add("hidden");setSync("Not connected");
  }

  async function afterLogin(){
    $("signOutBtn").classList.remove("hidden");authPanel.classList.remove("hidden");
    const found=await loadMemberships();
    if(!found){plannerSetup.classList.remove("hidden");authForm.parentElement.classList.add("hidden");setSync("Signed in");return}
    showApp();
  }

  async function loadMemberships(preferredId=null){
    const {data,error}=await db.from("planner_members")
      .select("planner_id, role, planners(id,name,invite_code,start_date,end_date,pto_allowance)")
      .eq("user_id",session.user.id);
    if(error){setupMsg.textContent=error.message;return false}
    if(!data?.length)return false;
    const row=preferredId?data.find(x=>x.planner_id===preferredId)||data[0]:data[0];
    planner=row.planners;
    await loadPlannerData();
    return true;
  }

  async function loadPlannerData(){
    setSync("Syncing…");
    const [er,wr,ir,ar,tr] = await Promise.all([
      db.from("events").select("*").eq("planner_id",planner.id).order("event_date"),
      db.from("wishes").select("*").eq("planner_id",planner.id).order("created_at"),
      db.from("itineraries").select("*").eq("planner_id",planner.id).order("start_date"),
      db.from("availability").select("*").eq("planner_id",planner.id).order("availability_date"),
      db.from("itinerary_tasks").select("*").eq("planner_id",planner.id).order("sort_order").order("created_at")
    ]);
    const error=er.error||wr.error||ir.error||ar.error||tr.error;
    if(error){setSync("Sync error");setupMsg.textContent=error.message;return}
    events=er.data||[];wishes=wr.data||[];itineraries=ir.data||[];availability=ar.data||[];tasks=tr.data||[];
    renderAll();setSync("Synced",true);
  }

  function renderAll(){
    renderHeader();renderCalendar();renderCards();renderWishes();renderPto();renderItineraryOptions();renderTasks();
  }

  function renderItineraryOptions(){
    ["addItinerary","editItinerary","taskItinerary"].forEach(id=>{
      const select=$(id),current=select.value;
      select.innerHTML='<option value="">'+(id==="taskItinerary"?"General":"None")+'</option>';
      itineraries.forEach(it=>{
        const option=document.createElement("option");
        option.value=it.id;option.textContent=it.title;select.appendChild(option);
      });
      if([...select.options].some(o=>o.value===current))select.value=current;
    });
    $("itineraryCount").textContent=itineraries.length;
  }

  function hideDrawerForms(){
    detailForm.classList.add("hidden");
    addForm.classList.add("hidden");
    itineraryForm.classList.add("hidden");
    $("itineraryTasksPanel").classList.add("hidden");
  }

  function openDrawer(){
    detailPanel.classList.add("open");
    detailPanel.setAttribute("aria-hidden","false");
    detailBackdrop.classList.remove("hidden");
    document.body.style.overflow="hidden";
  }

  function closeDrawer(){
    detailPanel.classList.remove("open");
    detailPanel.setAttribute("aria-hidden","true");
    detailBackdrop.classList.add("hidden");
    document.body.style.overflow="";
  }

  $("closeDetailBtn").addEventListener("click",closeDrawer);
  detailBackdrop.addEventListener("click",closeDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer()});

  function showApp(){
    authPanel.classList.add("hidden");plannerSetup.classList.add("hidden");appShell.classList.remove("hidden");
    $("plannerDisplayName").textContent=planner.name;$("plannerInviteCode").textContent=planner.invite_code;
    $("addDate").min=planner.start_date;$("addDate").max=planner.end_date;
    renderAll();setSync("Synced",true);
  }

  function renderHeader(){
    $("pageTitle").textContent=planner.name;
    $("plannerDateRange").textContent=prettyDate(planner.start_date)+" – "+prettyDate(planner.end_date)+" · shared planner";
  }

  function availabilityForDate(date){return availability.filter(a=>a.availability_date===date)}
  function eventsForDate(date){return events.filter(e=>e.event_date===date)}

  function calendarBounds(){
    const start=new Date(planner.start_date+"T00:00:00Z");
    const end=new Date(planner.end_date+"T00:00:00Z");
    const startOffset=(start.getUTCDay()+6)%7;
    const endOffset=6-((end.getUTCDay()+6)%7);
    start.setUTCDate(start.getUTCDate()-startOffset);
    end.setUTCDate(end.getUTCDate()+endOffset);
    return {start,end};
  }

  function renderCalendar(){
    calendar.innerHTML="";
    const {start,end}=calendarBounds();
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=isoDate(d),inRange=iso>=planner.start_date&&iso<=planner.end_date;
      const av=availabilityForDate(iso),working=av.some(a=>a.status==="working");
      const cell=document.createElement("div");cell.className="day";
      if(!inRange)cell.classList.add("out");if(working)cell.classList.add("workday");

      const top=document.createElement("div");top.className="day-top";
      const n=document.createElement("div");n.className="day-num";n.textContent=d.getUTCDate();top.appendChild(n);
      if(inRange){const add=document.createElement("button");add.type="button";add.className="day-add";add.textContent="+";add.onclick=()=>openAdd(iso);top.appendChild(add)}
      cell.appendChild(top);

      av.forEach(a=>{const note=document.createElement("div");note.className="work-note";note.textContent=a.note||((a.person_name||"Someone")+" · "+a.status);cell.appendChild(note)});
      if(inRange)eventsForDate(iso).forEach(ev=>{const p=document.createElement("button");p.className="event-pill "+ev.event_type;p.textContent=ev.title;p.onclick=()=>openRemoteEvent(ev);cell.appendChild(p)});
      calendar.appendChild(cell);
    }
  }

  function renderCards(){
    tripCards.innerHTML="";
    $("itineraryCount").textContent=itineraries.length;
    if(!itineraries.length){
      tripCards.innerHTML='<div class="wish-empty">No itineraries yet. Create one for a major trip or multi-day plan.</div>';
      return;
    }
    itineraries.forEach(it=>{
      const b=document.createElement("button");b.className="trip-card";
      const range=it.start_date===it.end_date?shortDate(it.start_date):shortDate(it.start_date)+"–"+shortDate(it.end_date);
      const count=events.filter(e=>e.itinerary_id===it.id).length;
      b.innerHTML='<div class="date">'+range.toUpperCase()+'</div><div class="title"></div><div class="sub"></div>'+(it.is_featured?'<span class="featured-tag">Featured</span>':'')+'<span class="event-count"></span>';
      b.querySelector(".title").textContent=it.title;
      b.querySelector(".sub").textContent=it.summary||"No summary yet.";
      b.querySelector(".event-count").textContent=count+" event"+(count===1?"":"s");
      b.onclick=()=>openItinerary(it);tripCards.appendChild(b);
    });
  }

  function openItinerary(it){
    selectedEvent=null;selectedItinerary=it;hideDrawerForms();
    const range=it.start_date===it.end_date?prettyDate(it.start_date):shortDate(it.start_date)+" – "+prettyDate(it.end_date);
    $("detailDate").textContent=range.toUpperCase();$("detailTitle").textContent=it.title;$("detailBadge").textContent=it.badge||"Itinerary";$("detailSummary").textContent=it.summary||"No summary yet.";$("detailItems").innerHTML="";openDrawer();
    const linked=events.filter(e=>e.itinerary_id===it.id);
    renderItineraryTasks(it.id);
    $("itineraryTasksPanel").classList.remove("hidden");
    if(!linked.length){
      const empty=document.createElement("div");empty.className="detail-item";empty.innerHTML="<strong>No events yet</strong><span>Add calendar events and link them to this itinerary.</span>";$("detailItems").appendChild(empty);
    }else linked.forEach(ev=>{
      const row=document.createElement("div");row.className="detail-item";
      const h=document.createElement("strong");h.textContent=shortDate(ev.event_date)+" · "+ev.title;
      const s=document.createElement("span");s.textContent=ev.summary||"No notes yet.";row.append(h,s);row.onclick=()=>openRemoteEvent(ev);$("detailItems").appendChild(row);
    });
    const actions=document.createElement("div");actions.className="detail-action-row";
    const add=document.createElement("button");add.type="button";add.className="primary-mini";add.textContent="＋ Add event";add.onclick=()=>openAdd(it.start_date,{itineraryId:it.id});
    const edit=document.createElement("button");edit.type="button";edit.textContent="Edit itinerary";edit.onclick=()=>openItineraryEditor(it);
    actions.append(add,edit);$("detailItems").appendChild(actions);
  }

  function openRemoteEvent(ev){
    selectedEvent=ev;selectedItinerary=null;hideDrawerForms();
    $("detailDate").textContent=prettyDate(ev.event_date).toUpperCase();$("detailTitle").textContent=ev.title;$("detailBadge").textContent=ev.is_pto?"PTO":ev.event_type;$("detailSummary").textContent=ev.summary||"No notes yet.";$("detailItems").innerHTML="";openDrawer();
    $("editKey").value=ev.id;$("editTitle").value=ev.title;$("editSummary").value=ev.summary||"";$("editItinerary").value=ev.itinerary_id||"";detailForm.classList.remove("hidden");$("saveMsg").textContent="";
  }

  function openAdd(date="",prefill=null){
    selectedEvent=null;selectedItinerary=null;hideDrawerForms();$("detailItems").innerHTML="";
    $("detailDate").textContent=date?prettyDate(date).toUpperCase():"NEW PLAN";$("detailTitle").textContent="Add something to the calendar";$("detailBadge").textContent="New";$("detailSummary").textContent=prefill?"Schedule this wish on the calendar.":"Create a shared event.";openDrawer();
    $("addDate").min=planner.start_date;$("addDate").max=planner.end_date;$("addDate").value=date;
    $("addType").value=prefill?.type||"activity";$("addItinerary").value=prefill?.itineraryId||"";$("addTitle").value=prefill?.title||"";$("addSummary").value=prefill?.notes||"";$("addPto").checked=false;$("sourceWishId").value=prefill?.id||"";$("addMsg").textContent="";addForm.classList.remove("hidden");
  }

  $("addPlanBtn").onclick=()=>openAdd("");
  $("cancelAddBtn").onclick=()=>{addForm.classList.add("hidden");closeDrawer()};

  detailForm.addEventListener("submit",async e=>{
    e.preventDefault();if(!selectedEvent)return;$("saveMsg").textContent="Saving…";
    const {error}=await db.from("events").update({title:$("editTitle").value.trim(),summary:$("editSummary").value.trim(),itinerary_id:$("editItinerary").value||null}).eq("id",selectedEvent.id);
    if(error){$("saveMsg").textContent=error.message;return}
    await loadPlannerData();const updated=events.find(x=>x.id===selectedEvent.id);if(updated)openRemoteEvent(updated);$("saveMsg").textContent="Saved.";
  });

  deletePlanBtn.addEventListener("click",async()=>{
    if(!selectedEvent)return;if(!confirm("Delete this shared plan?"))return;
    const {error}=await db.from("events").delete().eq("id",selectedEvent.id);
    if(error){$("saveMsg").textContent=error.message;return}
    await loadPlannerData();detailForm.classList.add("hidden");$("detailTitle").textContent="Trip & event details";$("detailSummary").textContent="Choose a planned date to see details.";closeDrawer();
  });

  addForm.addEventListener("submit",async e=>{
    e.preventDefault();const date=$("addDate").value;
    if(!date||date<planner.start_date||date>planner.end_date){$("addMsg").textContent="Choose a date inside this planner.";return}
    $("addMsg").textContent="Saving…";
    const wishId=$("sourceWishId").value||null;
    const payload={planner_id:planner.id,event_date:date,title:$("addTitle").value.trim(),summary:$("addSummary").value.trim(),event_type:$("addType").value,is_pto:$("addPto").checked,source_wish_id:wishId,itinerary_id:$("addItinerary").value||null,created_by:session.user.id};
    const {data,error}=await db.from("events").insert(payload).select().single();
    if(error){$("addMsg").textContent=error.message;return}
    if(wishId)await db.from("wishes").update({status:"planned",scheduled_event_id:data.id}).eq("id",wishId);
    await loadPlannerData();openRemoteEvent(data);
  });

  function openItineraryEditor(it=null){
    selectedEvent=null;selectedItinerary=it;hideDrawerForms();$("detailItems").innerHTML="";
    const creating=!it;
    $("detailDate").textContent=creating?"NEW ITINERARY":(shortDate(it.start_date)+" – "+prettyDate(it.end_date)).toUpperCase();
    $("detailTitle").textContent=creating?"Create an itinerary":it.title;
    $("detailBadge").textContent="Itinerary";
    $("detailSummary").textContent=creating?"Create a major plan, then attach calendar events to it.":"Edit the major plan and how it appears.";
    $("itineraryFormTitle").textContent=creating?"New itinerary":"Edit itinerary";
    $("itineraryId").value=it?.id||"";
    $("itineraryTitle").value=it?.title||"";
    $("itineraryStart").min=planner.start_date;$("itineraryStart").max=planner.end_date;$("itineraryStart").value=it?.start_date||planner.start_date;
    $("itineraryEnd").min=planner.start_date;$("itineraryEnd").max=planner.end_date;$("itineraryEnd").value=it?.end_date||planner.start_date;
    $("itineraryBadge").value=it?.badge||"";
    $("itinerarySummary").value=it?.summary||"";
    $("itineraryFeatured").checked=it?.is_featured??true;
    $("deleteItineraryBtn").classList.toggle("hidden",creating);
    $("itineraryMsg").textContent="";
    itineraryForm.classList.remove("hidden");openDrawer();
  }

  $("newItineraryBtn").addEventListener("click",()=>openItineraryEditor());
  $("cancelItineraryBtn").addEventListener("click",closeDrawer);

  itineraryForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const start=$("itineraryStart").value,end=$("itineraryEnd").value;
    if(!start||!end||start>end){$("itineraryMsg").textContent="End date must be on or after start date.";return}
    if(start<planner.start_date||end>planner.end_date){$("itineraryMsg").textContent="Keep the itinerary inside the planner date range.";return}
    $("itineraryMsg").textContent="Saving…";
    const payload={
      planner_id:planner.id,
      title:$("itineraryTitle").value.trim(),
      start_date:start,
      end_date:end,
      badge:$("itineraryBadge").value.trim()||null,
      summary:$("itinerarySummary").value.trim(),
      is_featured:$("itineraryFeatured").checked
    };
    const id=$("itineraryId").value;
    let result;
    if(id) result=await db.from("itineraries").update(payload).eq("id",id).select().single();
    else result=await db.from("itineraries").insert({...payload,created_by:session.user.id}).select().single();
    if(result.error){$("itineraryMsg").textContent=result.error.message;return}
    await loadPlannerData();
    const saved=itineraries.find(x=>x.id===result.data.id)||result.data;
    openItinerary(saved);
  });

  $("deleteItineraryBtn").addEventListener("click",async()=>{
    const id=$("itineraryId").value;if(!id)return;
    const linkedCount=events.filter(e=>e.itinerary_id===id).length;
    const msg=linkedCount
      ?"Delete this itinerary? Its "+linkedCount+" linked event"+(linkedCount===1?"":"s")+" will stay on the calendar but become standalone."
      :"Delete this itinerary?";
    if(!confirm(msg))return;
    $("itineraryMsg").textContent="Deleting…";
    const {error}=await db.from("itineraries").delete().eq("id",id);
    if(error){$("itineraryMsg").textContent=error.message;return}
    await loadPlannerData();closeDrawer();
  });

  function taskItineraryName(id){
    return itineraries.find(it=>it.id===id)?.title||"General";
  }

  function taskMeta(task){
    const parts=[taskItineraryName(task.itinerary_id)];
    if(task.due_date)parts.push("Due "+shortDate(task.due_date));
    return parts.join(" · ");
  }

  function makeTaskRow(task){
    const row=document.createElement("div");row.className="task-row"+(task.status==="done"?" done":"");
    const check=document.createElement("input");check.type="checkbox";check.className="task-check";check.checked=task.status==="done";check.setAttribute("aria-label","Mark "+task.title+" complete");
    check.onchange=async()=>{await db.from("itinerary_tasks").update({status:check.checked?"done":"todo"}).eq("id",task.id);await loadPlannerData();if(selectedItinerary)openItinerary(itineraries.find(i=>i.id===selectedItinerary.id)||selectedItinerary)};
    const main=document.createElement("div");main.className="task-main";
    const title=document.createElement("div");title.className="task-title";title.textContent=task.title;
    const meta=document.createElement("div");meta.className="task-meta";meta.textContent=taskMeta(task);
    main.append(title,meta);
    const del=document.createElement("button");del.type="button";del.className="task-delete";del.textContent="×";del.setAttribute("aria-label","Delete "+task.title);
    del.onclick=async()=>{if(!confirm("Delete this task?"))return;await db.from("itinerary_tasks").delete().eq("id",task.id);await loadPlannerData();if(selectedItinerary)openItinerary(itineraries.find(i=>i.id===selectedItinerary.id)||selectedItinerary)};
    row.append(check,main,del);return row;
  }

  function renderTasks(){
    const open=tasks.filter(t=>t.status==="todo");
    $("openTaskCount").textContent=open.length;
    $("taskSummaryCompact").textContent=open.length+" left";
    const rows=taskFilter==="open"?open:tasks;
    const list=$("taskList");list.innerHTML="";
    if(!rows.length){list.innerHTML='<div class="wish-empty">'+(taskFilter==="open"?"Nothing left — you are caught up.":"No tasks yet.")+'</div>';return}
    rows.forEach(t=>list.appendChild(makeTaskRow(t)));
  }

  function renderItineraryTasks(itineraryId){
    const list=$("itineraryTaskList");list.innerHTML="";
    const rows=tasks.filter(t=>t.itinerary_id===itineraryId);
    if(!rows.length){list.innerHTML='<div class="wish-empty">No preparation tasks yet.</div>';return}
    rows.forEach(t=>list.appendChild(makeTaskRow(t)));
  }

  $("taskForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const payload={planner_id:planner.id,itinerary_id:$("taskItinerary").value||null,title:$("taskTitle").value.trim(),due_date:$("taskDueDate").value||null,status:"todo",created_by:session.user.id};
    const {error}=await db.from("itinerary_tasks").insert(payload);
    if(error){alert(error.message);return}
    e.target.reset();await loadPlannerData();
  });
  $("showOpenTasks").onclick=()=>{taskFilter="open";$("showOpenTasks").classList.add("active");$("showAllTasks").classList.remove("active");renderTasks()};
  $("showAllTasks").onclick=()=>{taskFilter="all";$("showAllTasks").classList.add("active");$("showOpenTasks").classList.remove("active");renderTasks()};
  $("taskMetricBtn").onclick=()=>{$("taskSection").open=true;$("taskSection").scrollIntoView({behavior:"smooth",block:"start"})};
  $("addItineraryTaskBtn").onclick=()=>{
    if(!selectedItinerary)return;
    closeDrawer();
    $("taskSection").open=true;
    $("taskItinerary").value=selectedItinerary.id;
    $("taskSection").scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(()=>$("taskTitle").focus(),250);
  };

  function renderPto(){
    const dates=[...new Set(events.filter(e=>e.is_pto).map(e=>e.event_date))].sort();
    const used=dates.length,allowance=planner.pto_allowance||0,remaining=Math.max(0,allowance-used);
    $("ptoDates").textContent=dates.length?"PTO dates: "+dates.map(shortDate).join(", "):"No PTO days planned yet.";
    $("ptoSummary").innerHTML="<strong>"+used+" / "+allowance+" days planned</strong>"+(allowance?(" · "+remaining+" remaining"):"");
    $("ptoSummaryCompact").textContent=allowance?used+" / "+allowance+" days":used+" days";
  }

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
        const resolve=document.createElement("button");resolve.textContent="Resolve";resolve.onclick=async()=>{await db.from("wishes").update({status:"resolved"}).eq("id",w.id);await loadPlannerData()};actions.append(schedule,resolve);
      }else{
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