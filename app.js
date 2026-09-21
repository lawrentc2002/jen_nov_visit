(() => {
  const STORAGE_KEY="jenVisitPlanner.v4";
  const PREVIOUS_KEYS=["jenVisitPlanner.v3","jenVisitPlanner.v2","jenVisitPlanner.v1"];

  const defaults={
    edmonton:{date:"Nov 7–8",badge:"Road trip",title:"Edmonton Staycation",summary:"Low-effort first weekend while Jen adjusts to jet lag. Hotel, spa and shopping are the main point.",items:[
      ["Saturday · Drive","Leave Calgary late morning and keep the schedule relaxed."],
      ["Pura Botanicals","Make-your-own perfume session for two."],
      ["Hotel + spa","JW Marriott preferred for modern luxury/spa; Fairmont Hotel Macdonald as the classic option."],
      ["Sunday · WEM","West Edmonton Mall, MUJI and relaxed shopping."],
      ["Optional","Muttart Conservatory if energy and weather are good."]
    ]},
    toronto:{date:"Nov 16–18",badge:"3 PTO days",title:"Toronto + Niagara Falls",summary:"Niagara overnight, Markham Chinese food and half a day downtown without keeping a car downtown.",items:[
      ["Mon · YYZ → Niagara","Pick up Avis at Pearson, drive to Niagara and stay in a Fallsview room."],
      ["Hotel target","Niagara Falls Marriott Fallsview; use Marriott Gold and book the actual view."],
      ["Tue · Niagara → Markham","Slow morning at the Falls, then Markham food run."],
      ["Tue evening","Return Avis downtown and stay near Union/Fairmont or compare a one-night FHR hotel."],
      ["Wed · Downtown","Half-day downtown on foot/TTC, then UP Express to YYZ."]
    ]},
    remembrance:{date:"Nov 11",badge:"Both off",title:"Remembrance Day",summary:"Both off. Keep this flexible because Jen may work late Nov 10.",items:[
      ["Option A","Everwild Canmore day trip."],["Option B","UCalgary skating or an easy Calgary date day."]
    ]},
    spa:{date:"Nov 24",badge:"Evening",title:"Everwild Nordic Spa",summary:"Placeholder after-work spa night. Move this if Dec 7–10 becomes an overnight Canmore stay.",items:[["Plan","Drive to Canmore after work → spa → dinner → home."]]},
    ski1:{date:"Dec 1",badge:"Evening",title:"WinSport Ski Night",summary:"Tentative after-work ski evening, weather and hill opening permitting.",items:[["Plan","Quick dinner → WinSport → 2–3 hours skiing."]]},
    final:{date:"Dec 7–10",badge:"4 PTO days",title:"Final Days Together",summary:"Keep the final four days flexible for weather, ski conditions, Canmore and departure.",items:[
      ["Dec 7","Open full day; good candidate for Canmore / Everwild overnight."],["Dec 8","Tentative WinSport ski day or evening."],["Dec 9","Open final full day together."],["Dec 10","Departure / airport day."]
    ]},
    ski2:{date:"Dec 8",badge:"PTO",title:"WinSport Ski Day",summary:"Second ski slot inside the final PTO block.",items:[["Plan","Flexible full ski day or evening session."]]}
  };

  const baseDayEvents={
    "2026-11-07":[{key:"edmonton",label:"Edmonton · Day 1",type:"trip"}],
    "2026-11-08":[{key:"edmonton",label:"Edmonton · Day 2",type:"trip"}],
    "2026-11-11":[{key:"remembrance",label:"Both off",type:"local"}],
    "2026-11-16":[{key:"toronto",label:"Toronto · Niagara",type:"trip"}],
    "2026-11-17":[{key:"toronto",label:"Toronto · Markham",type:"trip"}],
    "2026-11-18":[{key:"toronto",label:"Toronto · Downtown",type:"trip"}],
    "2026-11-24":[{key:"spa",label:"Everwild spa",type:"activity"}],
    "2026-12-01":[{key:"ski1",label:"WinSport ski",type:"activity"}],
    "2026-12-07":[{key:"final",label:"PTO · final block",type:"trip"}],
    "2026-12-08":[{key:"ski2",label:"PTO + WinSport",type:"activity"}],
    "2026-12-09":[{key:"final",label:"PTO · open day",type:"trip"}],
    "2026-12-10":[{key:"final",label:"Airport day",type:"trip"}]
  };

  const blocked=new Set();
  const addRange=(a,b)=>{let d=new Date(a+"T00:00:00Z"),e=new Date(b+"T00:00:00Z");while(d<=e){blocked.add(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}};
  addRange("2026-11-09","2026-11-10"); addRange("2026-11-12","2026-11-15"); addRange("2026-11-20","2026-11-22"); addRange("2026-11-27","2026-11-29"); addRange("2026-12-04","2026-12-06");

  const clone=o=>JSON.parse(JSON.stringify(o));

  function normalizeCustomEvents(raw){
    const out={};
    Object.entries(raw||{}).forEach(([date,value])=>{
      if(Array.isArray(value)) out[date]=value;
      else if(value&&typeof value==="object") out[date]=[value];
    });
    return out;
  }

  function loadState(){
    try{
      const current=localStorage.getItem(STORAGE_KEY);
      if(current){
        const p=JSON.parse(current);
        return {trips:{...clone(defaults),...(p.trips||{})},customEvents:normalizeCustomEvents(p.customEvents),wishes:Array.isArray(p.wishes)?p.wishes:[]};
      }
      for(const key of PREVIOUS_KEYS){
        const raw=localStorage.getItem(key);
        if(!raw)continue;
        const p=JSON.parse(raw);
        if(key==="jenVisitPlanner.v1") return {trips:{...clone(defaults),...p},customEvents:{},wishes:[]};
        return {trips:{...clone(defaults),...(p.trips||{})},customEvents:normalizeCustomEvents(p.customEvents),wishes:[]};
      }
    }catch{}
    return {trips:clone(defaults),customEvents:{},wishes:[]};
  }

  let state=loadState(),wishFilter="open";
  const saveState=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(state));

  const calendar=document.getElementById("calendar"),tripCards=document.getElementById("tripCards"),
  detailDate=document.getElementById("detailDate"),detailTitle=document.getElementById("detailTitle"),
  detailBadge=document.getElementById("detailBadge"),detailSummary=document.getElementById("detailSummary"),
  detailItems=document.getElementById("detailItems"),detailForm=document.getElementById("detailForm"),
  editKey=document.getElementById("editKey"),editTitle=document.getElementById("editTitle"),
  editSummary=document.getElementById("editSummary"),saveMsg=document.getElementById("saveMsg"),
  deletePlanBtn=document.getElementById("deletePlanBtn"),addForm=document.getElementById("addForm"),
  addDate=document.getElementById("addDate"),addType=document.getElementById("addType"),
  addTitle=document.getElementById("addTitle"),addSummary=document.getElementById("addSummary"),
  addPto=document.getElementById("addPto"),addMsg=document.getElementById("addMsg"),
  sourceWishId=document.getElementById("sourceWishId"),wishForm=document.getElementById("wishForm"),
  wishTitle=document.getElementById("wishTitle"),wishCategory=document.getElementById("wishCategory"),
  wishNotes=document.getElementById("wishNotes"),wishList=document.getElementById("wishList"),
  openWishCount=document.getElementById("openWishCount");

  const eventsForDate=date=>[...(baseDayEvents[date]||[]),...(state.customEvents[date]||[])];
  const prettyDate=iso=>new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));

  function openDetail(key){
    const t=state.trips[key];if(!t)return;closeAdd();
    detailDate.textContent=t.date.toUpperCase();detailTitle.textContent=t.title;detailBadge.textContent=t.badge;detailSummary.textContent=t.summary;detailItems.innerHTML="";
    (t.items||[]).forEach(([head,text])=>{const row=document.createElement("div");row.className="detail-item";const h=document.createElement("strong");h.textContent=head;const s=document.createElement("span");s.textContent=text;row.append(h,s);detailItems.appendChild(row)});
    editKey.value=key;editTitle.value=t.title;editSummary.value=t.summary;detailForm.classList.remove("hidden");
    deletePlanBtn.classList.toggle("hidden",!t.customDate);saveMsg.textContent="";
  }

  function openAdd(date="",prefill=null){
    detailForm.classList.add("hidden");detailItems.innerHTML="";
    detailDate.textContent=date?prettyDate(date).toUpperCase():"NEW PLAN";detailTitle.textContent="Add something to the calendar";detailBadge.textContent="New";
    detailSummary.textContent=prefill?"Schedule this wish on the calendar.":"Add another event to this day, or create the first one.";
    addDate.value=date;addType.value=(prefill&&prefill.type)||"activity";addTitle.value=(prefill&&prefill.title)||"";addSummary.value=(prefill&&prefill.notes)||"";addPto.checked=false;
    sourceWishId.value=(prefill&&prefill.id)||"";addMsg.textContent="";addForm.classList.remove("hidden");
    if(!date)addDate.focus();else addTitle.focus();
  }

  function closeAdd(){addForm.classList.add("hidden");addMsg.textContent="";sourceWishId.value=""}

  function renderCalendar(){
    calendar.innerHTML="";
    const start=new Date("2026-11-02T00:00:00Z"),end=new Date("2026-12-13T00:00:00Z");
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=d.toISOString().slice(0,10),inRange=iso>="2026-11-04"&&iso<="2026-12-10";
      const cell=document.createElement("div");cell.className="day";if(!inRange)cell.classList.add("out");else if(blocked.has(iso))cell.classList.add("workday");
      const top=document.createElement("div");top.className="day-top";const n=document.createElement("div");n.className="day-num";n.textContent=d.getUTCDate();top.appendChild(n);
      if(inRange&&!blocked.has(iso)){const add=document.createElement("button");add.type="button";add.className="day-add";add.textContent="+";add.addEventListener("click",()=>openAdd(iso));top.appendChild(add)}
      cell.appendChild(top);
      if(blocked.has(iso)&&inRange){const w=document.createElement("div");w.className="work-note";w.textContent="Jen working";cell.appendChild(w)}
      if(inRange)eventsForDate(iso).forEach(ev=>{const p=document.createElement("button");p.type="button";p.className="event-pill "+ev.type;p.textContent=ev.label;p.addEventListener("click",()=>openDetail(ev.key));cell.appendChild(p)});
      if(inRange&&!blocked.has(iso)&&eventsForDate(iso).length===0){const empty=document.createElement("button");empty.type="button";empty.className="empty-add";empty.textContent="+ Add plan";empty.addEventListener("click",()=>openAdd(iso));cell.appendChild(empty)}
      calendar.appendChild(cell);
    }
  }

  function renderCards(){
    tripCards.innerHTML="";
    ["edmonton","toronto","final"].forEach(key=>{const t=state.trips[key],b=document.createElement("button");b.type="button";b.className="trip-card";
      const date=document.createElement("div");date.className="date";date.textContent=t.date.toUpperCase();
      const title=document.createElement("div");title.className="title";title.textContent=t.title;
      const sub=document.createElement("div");sub.className="sub";sub.textContent=t.summary;b.append(date,title,sub);b.addEventListener("click",()=>openDetail(key));tripCards.appendChild(b)
    });
  }

  function mapWishType(category){
    if(category==="trip")return"trip";
    return"activity";
  }

  function renderWishes(){
    const open=state.wishes.filter(w=>!w.resolved).length;openWishCount.textContent=open;
    const rows=state.wishes.filter(w=>wishFilter==="all"||(wishFilter==="open"?!w.resolved:w.resolved));
    wishList.innerHTML="";
    if(rows.length===0){const empty=document.createElement("div");empty.className="wish-empty";empty.textContent=wishFilter==="open"?"No open wishes yet. Add anything that sounds fun.":"Nothing here yet.";wishList.appendChild(empty);return}
    rows.slice().reverse().forEach(w=>{
      const card=document.createElement("div");card.className="wish-card"+(w.resolved?" resolved":"");
      const main=document.createElement("div"),title=document.createElement("div");title.className="wish-title";title.textContent=w.title;
      const meta=document.createElement("div");meta.className="wish-meta";
      const status=document.createElement("span");status.className="wish-status";status.textContent=w.resolved?(w.scheduledDate?"Planned · "+prettyDate(w.scheduledDate).replace(", 2026",""):"Resolved"):"Open";
      const cat=document.createElement("span");cat.textContent=w.category;meta.append(status,cat);main.append(title,meta);
      if(w.notes){const notes=document.createElement("div");notes.className="wish-notes";notes.textContent=w.notes;main.appendChild(notes)}
      const actions=document.createElement("div");actions.className="wish-actions";
      if(!w.resolved){
        const schedule=document.createElement("button");schedule.type="button";schedule.className="schedule";schedule.textContent="Schedule";schedule.addEventListener("click",()=>{openAdd("",{id:w.id,title:w.title,notes:w.notes,type:mapWishType(w.category)});window.scrollTo({top:0,behavior:"smooth"})});
        const resolve=document.createElement("button");resolve.type="button";resolve.textContent="Resolve";resolve.addEventListener("click",()=>{w.resolved=true;saveState();renderWishes()});actions.append(schedule,resolve);
      }else{
        const reopen=document.createElement("button");reopen.type="button";reopen.textContent="Reopen";reopen.addEventListener("click",()=>{w.resolved=false;w.scheduledDate="";saveState();renderWishes()});actions.appendChild(reopen);
      }
      const del=document.createElement("button");del.type="button";del.className="delete";del.textContent="Delete";del.addEventListener("click",()=>{if(!confirm("Delete this wish?"))return;state.wishes=state.wishes.filter(x=>x.id!==w.id);saveState();renderWishes()});actions.appendChild(del);
      card.append(main,actions);wishList.appendChild(card);
    });
  }

  function setWishFilter(filter){
    wishFilter=filter;
    ["showOpenWishes","showResolvedWishes","showAllWishes"].forEach(id=>document.getElementById(id).classList.remove("active"));
    document.getElementById(filter==="open"?"showOpenWishes":filter==="resolved"?"showResolvedWishes":"showAllWishes").classList.add("active");
    renderWishes();
  }

  detailForm.addEventListener("submit",e=>{
    e.preventDefault();const key=editKey.value;if(!state.trips[key])return;
    const title=editTitle.value.trim(),summary=editSummary.value.trim();if(!title||!summary){saveMsg.textContent="Title and notes are required.";return}
    state.trips[key].title=title;state.trips[key].summary=summary;
    if(state.trips[key].customDate){const date=state.trips[key].customDate;const ev=(state.customEvents[date]||[]).find(x=>x.key===key);if(ev)ev.label=title}
    saveState();renderCalendar();renderCards();openDetail(key);saveMsg.textContent="Saved locally.";
  });

  addForm.addEventListener("submit",e=>{
    e.preventDefault();const date=addDate.value,title=addTitle.value.trim(),summary=addSummary.value.trim();
    if(!date||date<"2026-11-04"||date>"2026-12-10"){addMsg.textContent="Choose a date during the visit.";return}
    if(blocked.has(date)){addMsg.textContent="That day is currently marked as Jen working.";return}
    if(!title){addMsg.textContent="Add a title.";return}
    const key="custom_"+date.replaceAll("-","_")+"_"+Date.now(),badge=addPto.checked?"PTO":(addType.value==="trip"?"Trip":addType.value==="local"?"Local":"Activity");
    state.trips[key]={date:prettyDate(date).replace(", 2026",""),badge,title,summary:summary||"No notes yet.",items:[],customDate:date};
    if(!state.customEvents[date])state.customEvents[date]=[];state.customEvents[date].push({key,label:title,type:addType.value,pto:addPto.checked});
    if(sourceWishId.value){const wish=state.wishes.find(w=>w.id===sourceWishId.value);if(wish){wish.resolved=true;wish.scheduledDate=date;wish.planKey=key}}
    saveState();renderCalendar();renderWishes();openDetail(key);
  });

  deletePlanBtn.addEventListener("click",()=>{
    const key=editKey.value,t=state.trips[key];if(!t||!t.customDate)return;if(!confirm("Delete this plan from the calendar?"))return;
    const date=t.customDate;state.customEvents[date]=(state.customEvents[date]||[]).filter(x=>x.key!==key);if(state.customEvents[date].length===0)delete state.customEvents[date];
    state.wishes.forEach(w=>{if(w.planKey===key){w.resolved=false;w.scheduledDate="";w.planKey=""}});
    delete state.trips[key];saveState();renderCalendar();renderWishes();detailForm.classList.add("hidden");detailItems.innerHTML="";
    detailDate.textContent="SELECT A PLAN";detailTitle.textContent="Trip & event details";detailBadge.textContent="Planner";detailSummary.textContent="Choose a trip card or planned date to see the itinerary.";
  });

  wishForm.addEventListener("submit",e=>{
    e.preventDefault();const title=wishTitle.value.trim(),notes=wishNotes.value.trim();if(!title)return;
    state.wishes.push({id:"wish_"+Date.now(),title,notes,category:wishCategory.value,resolved:false,createdAt:new Date().toISOString(),scheduledDate:"",planKey:""});
    saveState();wishForm.reset();wishCategory.value="activity";setWishFilter("open");
  });

  document.getElementById("showOpenWishes").addEventListener("click",()=>setWishFilter("open"));
  document.getElementById("showResolvedWishes").addEventListener("click",()=>setWishFilter("resolved"));
  document.getElementById("showAllWishes").addEventListener("click",()=>setWishFilter("all"));
  document.getElementById("addPlanBtn").addEventListener("click",()=>openAdd(""));
  document.getElementById("cancelAddBtn").addEventListener("click",()=>{closeAdd();openDetail("edmonton")});

  document.getElementById("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:4,...state},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="jen-visit-planner-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});
  document.getElementById("importInput").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.trips)throw new Error();state={trips:{...clone(defaults),...data.trips},customEvents:normalizeCustomEvents(data.customEvents),wishes:Array.isArray(data.wishes)?data.wishes:[]};saveState();renderCalendar();renderCards();renderWishes();openDetail("edmonton")}catch{alert("Could not import that backup file.")}e.target.value=""});
  document.getElementById("resetBtn").addEventListener("click",()=>{if(!confirm("Reset all edited details, added plans and wishes?"))return;localStorage.removeItem(STORAGE_KEY);PREVIOUS_KEYS.forEach(k=>localStorage.removeItem(k));state={trips:clone(defaults),customEvents:{},wishes:[]};saveState();renderCalendar();renderCards();renderWishes();openDetail("edmonton")});

  renderCalendar();renderCards();renderWishes();openDetail("edmonton");
})();