(() => {
  const STORAGE_KEY="jenVisitPlanner.v2";
  const LEGACY_KEY="jenVisitPlanner.v1";

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
    "2026-11-07":{key:"edmonton",label:"Edmonton · Day 1",type:"trip"},
    "2026-11-08":{key:"edmonton",label:"Edmonton · Day 2",type:"trip"},
    "2026-11-11":{key:"remembrance",label:"Both off",type:"local"},
    "2026-11-16":{key:"toronto",label:"Toronto · Niagara",type:"trip"},
    "2026-11-17":{key:"toronto",label:"Toronto · Markham",type:"trip"},
    "2026-11-18":{key:"toronto",label:"Toronto · Downtown",type:"trip"},
    "2026-11-24":{key:"spa",label:"Everwild spa",type:"activity"},
    "2026-12-01":{key:"ski1",label:"WinSport ski",type:"activity"},
    "2026-12-07":{key:"final",label:"PTO · final block",type:"trip"},
    "2026-12-08":{key:"ski2",label:"PTO + WinSport",type:"activity"},
    "2026-12-09":{key:"final",label:"PTO · open day",type:"trip"},
    "2026-12-10":{key:"final",label:"Airport day",type:"trip"}
  };

  const blocked=new Set();
  const addRange=(a,b)=>{let d=new Date(a+"T00:00:00Z"),e=new Date(b+"T00:00:00Z");while(d<=e){blocked.add(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}};
  addRange("2026-11-09","2026-11-10"); addRange("2026-11-12","2026-11-15"); addRange("2026-11-20","2026-11-22"); addRange("2026-11-27","2026-11-29"); addRange("2026-12-04","2026-12-06");

  const clone=o=>JSON.parse(JSON.stringify(o));
  let state=loadState();

  function loadState(){
    try{
      const current=localStorage.getItem(STORAGE_KEY);
      if(current){
        const parsed=JSON.parse(current);
        return {
          trips:{...clone(defaults),...(parsed.trips||{})},
          customEvents:parsed.customEvents||{}
        };
      }
      const legacy=localStorage.getItem(LEGACY_KEY);
      if(legacy){
        return {trips:{...clone(defaults),...JSON.parse(legacy)},customEvents:{}};
      }
    }catch{}
    return {trips:clone(defaults),customEvents:{}};
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  }

  const calendar=document.getElementById("calendar");
  const tripCards=document.getElementById("tripCards");
  const detailDate=document.getElementById("detailDate");
  const detailTitle=document.getElementById("detailTitle");
  const detailBadge=document.getElementById("detailBadge");
  const detailSummary=document.getElementById("detailSummary");
  const detailItems=document.getElementById("detailItems");
  const detailForm=document.getElementById("detailForm");
  const editKey=document.getElementById("editKey");
  const editTitle=document.getElementById("editTitle");
  const editSummary=document.getElementById("editSummary");
  const saveMsg=document.getElementById("saveMsg");
  const deletePlanBtn=document.getElementById("deletePlanBtn");

  const addForm=document.getElementById("addForm");
  const addDate=document.getElementById("addDate");
  const addType=document.getElementById("addType");
  const addTitle=document.getElementById("addTitle");
  const addSummary=document.getElementById("addSummary");
  const addPto=document.getElementById("addPto");
  const addMsg=document.getElementById("addMsg");

  function dayEvents(){
    const merged={...baseDayEvents};
    Object.entries(state.customEvents).forEach(([date,event])=>{
      merged[date]={key:event.key,label:event.label,type:event.type,custom:true};
    });
    return merged;
  }

  function prettyDate(iso){
    return new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));
  }

  function openDetail(key){
    const t=state.trips[key];
    if(!t)return;
    closeAdd();
    detailDate.textContent=t.date.toUpperCase();
    detailTitle.textContent=t.title;
    detailBadge.textContent=t.badge;
    detailSummary.textContent=t.summary;
    detailItems.innerHTML="";
    (t.items||[]).forEach(([head,text])=>{
      const row=document.createElement("div");
      row.className="detail-item";
      const h=document.createElement("strong");h.textContent=head;
      const s=document.createElement("span");s.textContent=text;
      row.append(h,s);detailItems.appendChild(row);
    });
    editKey.value=key;
    editTitle.value=t.title;
    editSummary.value=t.summary;
    detailForm.classList.remove("hidden");
    deletePlanBtn.classList.toggle("hidden",!t.customDate);
    saveMsg.textContent="";
  }

  function openAdd(date=""){
    detailForm.classList.add("hidden");
    detailItems.innerHTML="";
    detailDate.textContent=date?prettyDate(date).toUpperCase():"NEW PLAN";
    detailTitle.textContent="Add something to the calendar";
    detailBadge.textContent="New";
    detailSummary.textContent="Create a one-day plan. You can edit or delete it later.";
    addDate.value=date;
    addType.value="activity";
    addTitle.value="";
    addSummary.value="";
    addPto.checked=false;
    addMsg.textContent="";
    addForm.classList.remove("hidden");
    if(!date)addDate.focus(); else addTitle.focus();
  }

  function closeAdd(){
    addForm.classList.add("hidden");
    addMsg.textContent="";
  }

  function renderCalendar(){
    calendar.innerHTML="";
    const events=dayEvents();
    const start=new Date("2026-11-02T00:00:00Z"),end=new Date("2026-12-13T00:00:00Z");
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=d.toISOString().slice(0,10),inRange=iso>="2026-11-04"&&iso<="2026-12-10";
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="day";
      if(!inRange){btn.disabled=true;btn.classList.add("out")}
      else if(blocked.has(iso)){btn.disabled=true;btn.classList.add("workday")}
      else if(events[iso]){btn.addEventListener("click",()=>openDetail(events[iso].key))}
      else{
        btn.classList.add("empty-day");
        btn.setAttribute("aria-label","Add plan on "+prettyDate(iso));
        btn.addEventListener("click",()=>openAdd(iso));
      }

      const n=document.createElement("div");n.className="day-num";n.textContent=d.getUTCDate();btn.appendChild(n);
      if(blocked.has(iso)&&inRange){
        const w=document.createElement("div");w.className="work-note";w.textContent="Jen working";btn.appendChild(w);
      }
      const ev=events[iso];
      if(ev&&inRange){
        const p=document.createElement("div");p.className="event-pill "+ev.type;p.textContent=ev.label;btn.appendChild(p);
      }else if(inRange&&!blocked.has(iso)){
        const hint=document.createElement("div");hint.className="add-hint";hint.textContent="+ Add";btn.appendChild(hint);
      }
      calendar.appendChild(btn);
    }
  }

  function renderCards(){
    tripCards.innerHTML="";
    ["edmonton","toronto","final"].forEach(key=>{
      const t=state.trips[key],b=document.createElement("button");
      b.type="button";b.className="trip-card";
      const date=document.createElement("div");date.className="date";date.textContent=t.date.toUpperCase();
      const title=document.createElement("div");title.className="title";title.textContent=t.title;
      const sub=document.createElement("div");sub.className="sub";sub.textContent=t.summary;
      b.append(date,title,sub);
      b.addEventListener("click",()=>openDetail(key));
      tripCards.appendChild(b);
    });
  }

  detailForm.addEventListener("submit",e=>{
    e.preventDefault();
    const key=editKey.value;
    if(!state.trips[key])return;
    const title=editTitle.value.trim(),summary=editSummary.value.trim();
    if(!title||!summary){saveMsg.textContent="Title and notes are required.";return}
    state.trips[key].title=title;
    state.trips[key].summary=summary;
    if(state.trips[key].customDate){
      const date=state.trips[key].customDate;
      state.customEvents[date].label=title;
    }
    saveState();
    renderCalendar();
    renderCards();
    openDetail(key);
    saveMsg.textContent="Saved locally.";
  });

  addForm.addEventListener("submit",e=>{
    e.preventDefault();
    const date=addDate.value;
    const title=addTitle.value.trim();
    const summary=addSummary.value.trim();
    if(!date||date<"2026-11-04"||date>"2026-12-10"){addMsg.textContent="Choose a date during the visit.";return}
    if(blocked.has(date)){addMsg.textContent="That day is currently marked as Jen working.";return}
    if(dayEvents()[date]){addMsg.textContent="There is already a plan on that date.";return}
    if(!title){addMsg.textContent="Add a title.";return}
    const key="custom_"+date.replaceAll("-","_")+"_"+Date.now();
    const badge=addPto.checked?"PTO":(addType.value==="trip"?"Trip":addType.value==="local"?"Local":"Activity");
    state.trips[key]={date:prettyDate(date).replace(", 2026",""),badge,title,summary:summary||"No notes yet.",items:[],customDate:date};
    state.customEvents[date]={key,label:title,type:addType.value,pto:addPto.checked};
    saveState();
    renderCalendar();
    openDetail(key);
  });

  deletePlanBtn.addEventListener("click",()=>{
    const key=editKey.value;
    const t=state.trips[key];
    if(!t||!t.customDate)return;
    if(!confirm("Delete this plan from the calendar?"))return;
    delete state.customEvents[t.customDate];
    delete state.trips[key];
    saveState();
    renderCalendar();
    detailForm.classList.add("hidden");
    detailItems.innerHTML="";
    detailDate.textContent="SELECT A PLAN";
    detailTitle.textContent="Trip & event details";
    detailBadge.textContent="Planner";
    detailSummary.textContent="Choose a trip card or planned date to see the itinerary.";
  });

  document.getElementById("addPlanBtn").addEventListener("click",()=>openAdd(""));
  document.getElementById("cancelAddBtn").addEventListener("click",()=>{closeAdd();openDetail("edmonton")});

  document.getElementById("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({version:2,...state},null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="jen-visit-planner-backup.json";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  });

  document.getElementById("importInput").addEventListener("change",async e=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    try{
      const data=JSON.parse(await f.text());
      if(data.trips){
        state={trips:{...clone(defaults),...data.trips},customEvents:data.customEvents||{}};
      }else{
        throw new Error();
      }
      saveState();
      renderCalendar();
      renderCards();
      openDetail("edmonton");
    }catch{
      alert("Could not import that backup file.");
    }
    e.target.value="";
  });

  document.getElementById("resetBtn").addEventListener("click",()=>{
    if(!confirm("Reset all edited details and added plans?"))return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    state={trips:clone(defaults),customEvents:{}};
    saveState();
    renderCalendar();
    renderCards();
    openDetail("edmonton");
  });

  renderCalendar();
  renderCards();
  openDetail("edmonton");
})();