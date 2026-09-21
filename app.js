(() => {
  const STORAGE_KEY="jenVisitPlanner.v1";
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

  const dayEvents={
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

  let trips=load();
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function load(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?{...clone(defaults),...JSON.parse(raw)}:clone(defaults)}catch{return clone(defaults)}}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(trips))}

  const calendar=document.getElementById("calendar"),tripCards=document.getElementById("tripCards"),detailDate=document.getElementById("detailDate"),
  detailTitle=document.getElementById("detailTitle"),detailBadge=document.getElementById("detailBadge"),detailSummary=document.getElementById("detailSummary"),
  detailItems=document.getElementById("detailItems"),detailForm=document.getElementById("detailForm"),editKey=document.getElementById("editKey"),
  editTitle=document.getElementById("editTitle"),editSummary=document.getElementById("editSummary"),saveMsg=document.getElementById("saveMsg");

  function openDetail(key){
    const t=trips[key]; if(!t)return;
    detailDate.textContent=t.date.toUpperCase(); detailTitle.textContent=t.title; detailBadge.textContent=t.badge; detailSummary.textContent=t.summary; detailItems.innerHTML="";
    (t.items||[]).forEach(([head,text])=>{const row=document.createElement("div");row.className="detail-item";const h=document.createElement("strong");h.textContent=head;const s=document.createElement("span");s.textContent=text;row.append(h,s);detailItems.appendChild(row)});
    editKey.value=key;editTitle.value=t.title;editSummary.value=t.summary;detailForm.classList.remove("hidden");saveMsg.textContent="";
  }

  function renderCalendar(){
    calendar.innerHTML="";
    const start=new Date("2026-11-02T00:00:00Z"),end=new Date("2026-12-13T00:00:00Z");
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=d.toISOString().slice(0,10),inRange=iso>="2026-11-04"&&iso<="2026-12-10";
      const btn=document.createElement("button");btn.type="button";btn.className="day";
      if(!inRange){btn.disabled=true;btn.classList.add("out")}
      else if(blocked.has(iso)){btn.disabled=true;btn.classList.add("workday")}
      else if(dayEvents[iso])btn.addEventListener("click",()=>openDetail(dayEvents[iso].key));
      const n=document.createElement("div");n.className="day-num";n.textContent=d.getUTCDate();btn.appendChild(n);
      if(blocked.has(iso)&&inRange){const w=document.createElement("div");w.className="work-note";w.textContent="Jen working";btn.appendChild(w)}
      const ev=dayEvents[iso]; if(ev&&inRange){const p=document.createElement("div");p.className="event-pill "+ev.type;p.textContent=ev.label;btn.appendChild(p)}
      calendar.appendChild(btn);
    }
  }

  function renderCards(){
    tripCards.innerHTML="";
    ["edmonton","toronto","final"].forEach(key=>{const t=trips[key],b=document.createElement("button");b.type="button";b.className="trip-card";
      const date=document.createElement("div");date.className="date";date.textContent=t.date.toUpperCase();
      const title=document.createElement("div");title.className="title";title.textContent=t.title;
      const sub=document.createElement("div");sub.className="sub";sub.textContent=t.summary;
      b.append(date,title,sub);b.addEventListener("click",()=>openDetail(key));tripCards.appendChild(b);
    });
  }

  detailForm.addEventListener("submit",e=>{e.preventDefault();const key=editKey.value;if(!trips[key])return;const title=editTitle.value.trim(),summary=editSummary.value.trim();if(!title||!summary){saveMsg.textContent="Title and notes are required.";return}trips[key].title=title;trips[key].summary=summary;save();renderCards();openDetail(key);saveMsg.textContent="Saved locally."});

  document.getElementById("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:1,trips},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="jen-visit-planner-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});
  document.getElementById("importInput").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.trips)throw new Error();trips={...clone(defaults),...data.trips};save();renderCards();openDetail("edmonton")}catch{alert("Could not import that backup file.")}e.target.value=""});
  document.getElementById("resetBtn").addEventListener("click",()=>{if(!confirm("Reset all edited trip details?"))return;localStorage.removeItem(STORAGE_KEY);trips=clone(defaults);renderCards();openDetail("edmonton")});

  renderCalendar(); renderCards(); openDetail("edmonton");
})();