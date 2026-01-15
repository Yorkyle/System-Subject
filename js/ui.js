function esc(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function render(state, els, dispatch){
  els.pillScreen.textContent = `SCREEN: ${state.screen.toUpperCase()}`;
  els.pillThreat.textContent = `THREAT: ${state.currentCase ? (state.threat + "%") : "—"}`;
  els.pillPulls.textContent = `PULLS: ${state.currentCase ? (state.pullsMax - state.pullsUsed) + "/" + state.pullsMax : "—"}`;
  els.pillRisk.textContent = `RISK: ${state.currentCase ? state.risk : "—"}`;

  els.footerHint.textContent = hintText(state);

  renderTabs(els.leftTabs, [
    ["dossier","DOSSIER"],
    ["clues","CLUES"]
  ], state.leftTab, (tab)=>dispatch({type:"SET_LEFT_TAB", tab}));

  renderTabs(els.rightTabs, [
    ["actions","ACTIONS"],
    ["team","TEAM"],
    ["asset","ASSET"]
  ], state.rightTab, (tab)=>dispatch({type:"SET_RIGHT_TAB", tab}));

  // FEED
  els.feed.innerHTML = "";
  state.feed.slice(-250).forEach((m)=>{
    if(m.kind === "divider"){
      const d = document.createElement("div");
      d.className = "divider";
      d.textContent = `— ${m.label} —`;
      els.feed.appendChild(d);
      return;
    }
    const box = document.createElement("div");
    box.className = "msg";
    const whoLine = `<div class="who">${esc(m.who)}${m.tag ? ` <span class="tag">${esc(m.tag)}</span>` : ""}</div>`;
    const textLine = `<div class="text">${esc(m.text)}</div>`;
    box.innerHTML = whoLine + textLine;
    els.feed.appendChild(box);
  });

  // highlight last message
  clearHighlight(els.feed);
  const msgs = els.feed.querySelectorAll(".msg");
  if(msgs.length) msgs[msgs.length-1].classList.add("highlight");
  els.feed.scrollTop = els.feed.scrollHeight;

  els.tinyStatus.textContent = tinyStatus(state);

  // LEFT
  els.leftPanel.innerHTML = "";
  if(state.screen === "home"){
    els.leftPanel.innerHTML = `<div class="small">No active subject.</div>`;
  }else if(state.leftTab === "clues"){
    renderClues(state, els.leftPanel);
  }else{
    renderDossier(state, els.leftPanel);
  }

  // RIGHT
  els.rightPanel.innerHTML = "";
  if(state.screen === "home"){
    els.rightTitle.textContent = "CASES";
    renderHome(state, els.rightPanel, dispatch);
  }else if(state.screen === "boot"){
    els.rightTitle.textContent = "CHANNEL";
    renderBoot(state, els.rightPanel, dispatch);
  }else if(state.screen === "case"){
    els.rightTitle.textContent = state.rightTab === "actions" ? "ACTIONS" : state.rightTab.toUpperCase();
    if(state.rightTab === "team") renderTeam(state, els.rightPanel);
    else if(state.rightTab === "asset") renderAsset(state, els.rightPanel);
    else renderActions(state, els.rightPanel, dispatch);
  }else if(state.screen === "results"){
    els.rightTitle.textContent = "RESULT";
    renderResults(state, els.rightPanel, dispatch);
  }

  // controls
  els.btnJumpNewest.onclick = ()=>{ els.feed.scrollTop = els.feed.scrollHeight; };
  els.btnClearHighlight.onclick = ()=>{ clearHighlight(els.feed); };
}

function renderTabs(container, tabs, active, onSelect){
  container.innerHTML = "";
  for(const [id,label] of tabs){
    const b = document.createElement("button");
    b.className = "tabBtn";
    b.setAttribute("role","tab");
    b.setAttribute("aria-selected", id === active ? "true" : "false");
    b.textContent = label;
    b.onclick = ()=>onSelect(id);
    container.appendChild(b);
  }
}

function renderHome(state, mount, dispatch){
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="cardTitle">AVAILABLE FILES</div><div class="small mono">Select a case file to open an observer channel.</div>`;
  mount.appendChild(box);

  const row = document.createElement("div");
  row.className = "btnRow";
  for(const c of state.caseList){
    const b = document.createElement("button");
    b.className = "actionBtn";
    b.textContent = `OPEN: ${c.title}`;
    b.onclick = ()=>dispatch({type:"OPEN_CASE", caseId:c.id});
    row.appendChild(b);
  }
  const reset = document.createElement("button");
  reset.className = "actionBtn";
  reset.textContent = "RESET SAVE";
  reset.onclick = ()=>dispatch({type:"RESET_SAVE"});
  row.appendChild(reset);

  mount.appendChild(row);
}

function renderBoot(state, mount, dispatch){
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="cardTitle">${esc(state.currentCase.title)}</div>
  <div class="small mono">POV: ${esc(state.currentCase.pov)} · Channel secured · Partial clearance</div>
  <hr class="sep"/>
  <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(state.currentCase.introText)}</div>`;
  mount.appendChild(box);

  const row = document.createElement("div");
  row.className = "btnRow";

  const b = document.createElement("button");
  b.className = "actionBtn";
  b.textContent = "ENTER CASE";
  b.onclick = ()=>dispatch({type:"ENTER_CASE"});
  row.appendChild(b);

  const back = document.createElement("button");
  back.className = "actionBtn";
  back.textContent = "RETURN";
  back.onclick = ()=>dispatch({type:"HOME"});
  row.appendChild(back);

  mount.appendChild(row);
}

function renderActions(state, mount, dispatch){
  const info = document.createElement("div");
  info.className = "card";
  info.innerHTML = `<div class="cardTitle">STATUS</div>
  <div class="small mono">Phase: ${state.phase} · Pulls remaining: ${state.pullsMax - state.pullsUsed} · Evidence tags: ${state.tags.size}</div>`;
  mount.appendChild(info);

  const leads = document.createElement("div");
  leads.className = "card";
  leads.innerHTML = `<div class="cardTitle">LEADS</div>`;
  const leadRow = document.createElement("div");
  leadRow.className = "btnRow";

  for(const lead of state.currentCase.leads){
    if(!state.canSeeLeadFn(lead)) continue;
    const used = state.usedLeads.has(lead.id);
    const b = document.createElement("button");
    b.className = "actionBtn";
    const risk = lead.risk ? ` · RISK +${lead.risk}` : "";
    b.textContent = `${used ? "USED" : "PULL"}: ${lead.title}${risk}`;
    b.disabled = used || state.pullsUsed >= state.pullsMax;
    b.onclick = ()=>dispatch({type:"LEAD", leadId:lead.id});
    leadRow.appendChild(b);
  }
  leads.appendChild(leadRow);
  mount.appendChild(leads);

  const intv = document.createElement("div");
  intv.className = "card";
  intv.innerHTML = `<div class="cardTitle">INTERVENTION</div>
  <div class="small mono">${state.phase < state.currentCase.rules.interventionPhase ? "Locked. Continue investigating." : "Unlocked. Choose one."}</div>`;

  const intvRow = document.createElement("div");
  intvRow.className = "btnRow";

  const list = state.interventionsUnlockedFn();
  for(const i of list){
    const b = document.createElement("button");
    b.className = "actionBtn";
    const risk = i.risk ? ` · RISK +${i.risk}` : "";
    const req = reqText(i.requires);
    b.textContent = `${i.title}${risk}${req ? ` · REQ ${req}` : ""}`;
    b.disabled = !i.unlocked;
    b.onclick = ()=>dispatch({type:"INTERVENTION", interventionId:i.id});
    intvRow.appendChild(b);
  }
  intv.appendChild(intvRow);
  mount.appendChild(intv);
}

function renderResults(state, mount, dispatch){
  const r = state.result;
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="cardTitle">INTERVENTION: ${esc(r.intervention)}</div>
  <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(r.endingText)}</div>
  <hr class="sep"/>
  <div class="kv">
    <div class="kvRow"><div class="k">EVIDENCE</div><div class="v">${r.evidence}</div></div>
    <div class="kvRow"><div class="k">RISK</div><div class="v">${r.risk}</div></div>
    <div class="kvRow"><div class="k">THREAT</div><div class="v">${r.threat}%</div></div>
  </div>`;
  mount.appendChild(box);

  const row = document.createElement("div");
  row.className = "btnRow";

  const replay = document.createElement("button");
  replay.className = "actionBtn";
  replay.textContent = "REPLAY CASE";
  replay.onclick = ()=>dispatch({type:"REPLAY"});
  row.appendChild(replay);

  const home = document.createElement("button");
  home.className = "actionBtn";
  home.textContent = "RETURN";
  home.onclick = ()=>dispatch({type:"HOME"});
  row.appendChild(home);

  mount.appendChild(row);
}

function renderDossier(state, mount){
  if(!state.dossier){
    mount.innerHTML = `<div class="small">Dossier unavailable.</div>`;
    return;
  }
  const d = state.dossier;

  const head = document.createElement("div");
  head.className = "card";
  head.innerHTML = `<div class="cardTitle">${esc(d.title)}</div>
  <div class="small mono">${esc(d.subjectName)}</div>
  <hr class="sep"/>
  <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(d.overview)}</div>`;
  mount.appendChild(head);

  const fields = document.createElement("div");
  fields.className = "card";
  fields.innerHTML = `<div class="cardTitle">FIELDS</div>`;
  const kv = document.createElement("div");
  kv.className = "kv";
  for(const f of d.fields){
    const locked = String(f.value).includes("REDACTED");
    const row = document.createElement("div");
    row.className = "kvRow";
    row.innerHTML = `<div class="k">${esc(f.label)}</div><div class="v ${locked ? "locked":""}">${esc(f.value)}</div>`;
    kv.appendChild(row);
  }
  fields.appendChild(kv);
  if(d.riskNote){
    fields.innerHTML += `<hr class="sep"/><div class="small mono">ASSESSMENT</div>
    <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(d.riskNote)}</div>`;
  }
  mount.appendChild(fields);

  const tags = document.createElement("div");
  tags.className = "card";
  tags.innerHTML = `<div class="cardTitle">EVIDENCE TAGS</div>`;
  if(state.tags.size === 0){
    tags.innerHTML += `<div class="small mono">None captured.</div>`;
  }else{
    tags.innerHTML += `<div class="badges">${[...state.tags].map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>`;
  }
  mount.appendChild(tags);
}

function renderClues(state, mount){
  if(state.clues.length === 0){
    mount.innerHTML = `<div class="small mono">No clues recorded.</div>`;
    return;
  }
  for(const c of state.clues){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="cardTitle">${esc(c.title)}</div>
      <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(c.text)}</div>
      <hr class="sep"/>
      <div class="badges">${(c.tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>`;
    mount.appendChild(card);
  }
}

function renderAsset(state, mount){
  const c = state.currentCase;
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="cardTitle">ASSET INFORMATION</div>
  <div class="small mono">Designation: ${esc(c.asset.designation)}</div>
  <div class="small mono">Clearance: ${esc(c.asset.clearance)}</div>
  <div class="small mono">Access: ${esc(c.asset.access)}</div>
  <hr class="sep"/>
  <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(c.asset.note)}</div>`;
  mount.appendChild(box);
}

function renderTeam(state, mount){
  const team = state.currentCase.team;
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="cardTitle">TEAM CHANNEL</div>
  <div class="small mono">POV (${esc(state.currentCase.pov)}) does not auto-speak.</div>`;
  mount.appendChild(box);

  for(const member of team){
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<div class="spriteLine">
      ${spriteMarkup(member.sprite)}
      <div>
        <div class="cardTitle">${esc(member.name)}</div>
        <div class="small mono">${esc(member.role)}</div>
      </div>
    </div>
    <hr class="sep"/>
    <div class="small" style="white-space:pre-wrap; line-height:1.45">${esc(member.bio)}</div>`;
    mount.appendChild(row);
  }
}

function spriteMarkup(pattern){
  const safe = (pattern || "").padEnd(64,"0").slice(0,64);
  let px = "";
  for(let i=0;i<64;i++){
    const on = safe[i] === "1";
    px += `<div class="px ${on ? "on":""}"></div>`;
  }
  return `<div class="sprite" aria-hidden="true">${px}</div>`;
}

function reqText(requires){
  if(!requires) return "";
  if(Array.isArray(requires) && requires.length === 0) return "";
  if(requires.any) return `any(${requires.any.join(",")})`;
  if(requires.all) return `all(${requires.all.join(",")})`;
  if(Array.isArray(requires)) return `all(${requires.join(",")})`;
  return "";
}

function tinyStatus(state){
  if(!state.currentCase) return "";
  if(state.screen === "boot") return "Channel initializing…";
  if(state.screen === "case"){
    if(state.phase < state.currentCase.rules.interventionPhase){
      return "Investigate. Build a picture. Reduce harm.";
    }
    return "Intervention available.";
  }
  if(state.screen === "results") return "Case archived.";
  return "";
}

function hintText(state){
  if(state.screen === "home") return "Open a file to begin.";
  if(state.screen === "boot") return "Enter the case when ready.";
  if(state.screen === "case"){
    const rem = state.pullsMax - state.pullsUsed;
    return rem > 0 ? `Pull ${rem} more lead(s) to unlock full intervention options.` : "Choose an intervention.";
  }
  if(state.screen === "results") return "Observer channel closed.";
  return "";
}

function clearHighlight(feedEl){
  feedEl.querySelectorAll(".msg.highlight").forEach(n=>n.classList.remove("highlight"));
}
