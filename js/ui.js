// ui.js — v4
  // Fixes:
  // - Convert literal \n to line breaks everywhere (feed + dossier + protocol)
  // - Add NEXT + AUTO controls for pacing
  // - Hide tabs until case begins (screen=case/results)

  function esc(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;");
  }

  function htmlWithBreaks(s){
    // supports either literal \n sequences or actual newlines
    const safe = esc(s);
    return safe.replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
  }

  export function render(state, els, dispatch){
    // pills
    els.pillScreen.textContent = `STATE: ${state.screen.toUpperCase()}`;
    els.pillRisk.textContent = `RISK: ${state.risk}`;
    els.pillPulls.textContent = `PULLS: ${state.pullsRemaining ?? "—"}`;
    els.pillThreat.textContent = `THREAT: ${state.threat ? state.threat + "%" : "—"}`;

    // tabs visibility (immersion)
    if(state.screen === "case" || state.screen === "results"){
      renderTabs(els.leftTabs, [["dossier","DOSSIER"],["clues","CLUES"]], state.leftTab, (t)=>dispatch({type:"SET_LEFT_TAB", tab:t}));
      renderTabs(els.rightTabs, [["actions","ACTIONS"],["team","TEAM"],["asset","ASSET"],["protocol","PROTOCOL"]], state.rightTab, (t)=>dispatch({type:"SET_RIGHT_TAB", tab:t}));
    }else{
      els.leftTabs.innerHTML = "";
      els.rightTabs.innerHTML = "";
    }

    renderLeft(state, els.leftPanel);
    renderFeed(state, els.feed, dispatch, els.feedControls);
    renderRight(state, els.rightPanel, dispatch);

    // hint line
    els.hint.textContent =
      state.screen === "home" ? "Select a case." :
      state.screen === "intro" ? "Open the channel when ready." :
      state.screen === "case" ? "Limited access. Choose carefully." :
      state.screen === "results" ? "Case archived." : "";
  }

  function renderTabs(mount, tabs, active, onClick){
    mount.innerHTML = "";
    for(const [id,label] of tabs){
      const b = document.createElement("button");
      b.className = "tabBtn" + (active===id ? " active" : "");
      b.textContent = label;
      b.onclick = ()=>onClick(id);
      mount.appendChild(b);
    }
  }

  function renderLeft(state, mount){
    mount.innerHTML = "";

    if(state.screen === "home"){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="cardTitle">SUBJECT</div><div class="small">Awaiting selection.</div>`;
      mount.appendChild(card);
      return;
    }

    if(state.screen === "intro"){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="cardTitle">SUBJECT</div><div class="small">Channel initializing…</div>`;
      mount.appendChild(card);
      return;
    }

    // case/results: dossier or clues
    if(state.leftTab === "clues"){
      renderClues(state, mount);
    } else {
      renderDossier(state, mount);
    }
  }

  function renderDossier(state, mount){
    const c = state.currentCase;
    const d = c?.dossier ?? {};
    const fields = buildDossierFields(state);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cardTitle">DOSSIER</div>
      <div class="monoTitle">${esc(d.name ?? "REDACTED")}</div>
      <div class="small" style="line-height:1.55">${htmlWithBreaks(d.summary ?? "")}</div>
      <hr class="sep"/>
      <div class="subTitle">FIELDS</div>
      <div class="kv">
        ${fields.map(row => `
          <div class="kvRow">
            <div class="k">${esc(row.k)}</div>
            <div class="v">${esc(row.v)}</div>
          </div>
        `).join("")}
      </div>
      <hr class="sep"/>
      <div class="subTitle">EVIDENCE TAGS</div>
      <div class="small">${state.tags.size ? [...state.tags].map(t=>`<span class="chip">${esc(t)}</span>`).join(" ") : "None captured."}</div>
    `;
    mount.appendChild(card);
  }

  function buildDossierFields(state){
    const c = state.currentCase;
    const d = c?.dossier ?? {};
    const red = "REDACTED";
    const phase = state.phase;

    // progressive unlock
    return [
      { k:"Age", v: phase >= 3 ? (d.age ?? red) : red },
      { k:"Occupation", v: d.occupation ?? red },
      { k:"Primary Location", v: d.location ?? red },
      { k:"Shift Pattern", v: phase >= 2 ? (d.shiftPattern ?? red) : red },
      { k:"Known Contacts", v: phase >= 3 ? (d.contacts ?? red) : red },
      { k:"Behavioral Notes", v: phase >= 3 ? (d.behavior ?? red) : red },
      { k:"Assessment", v: phase >= 4 ? `Threat trending upward (${state.threat}%).` : "ASSESSMENT UNAVAILABLE" }
    ];
  }

  function renderClues(state, mount){
    const card = document.createElement("div");
    card.className = "card";
    const used = state.usedLeads;
    const leads = state.currentCase?.leads ?? [];
    const items = leads
      .filter(l => used.has(l.id))
      .map(l => `<li><b>${esc(l.title)}</b><br><span class="small">${esc((l.clueSummary ?? "").slice(0,160))}</span></li>`)
      .join("");
    card.innerHTML = `<div class="cardTitle">CLUES</div><div class="small">${items ? `<ul class="clueList">${items}</ul>` : "No clues captured."}</div>`;
    mount.appendChild(card);
  }

  function renderFeed(state, mount, dispatch, controlsMount){
    // Feed cards
    mount.innerHTML = state.feed.map(m => {
      if(m.kind === "divider"){
        return `<div class="divider">${esc(m.label ?? "—")}</div>`;
      }
      return `
        <div class="msg">
          <div class="whoRow">
            <span class="who">${esc(m.who)}</span>
            <span class="badge">${esc(m.tag ?? "")}</span>
          </div>
          <div class="text">${htmlWithBreaks(m.text)}</div>
        </div>
      `;
    }).join("");

    // Always scroll to bottom on new content
    mount.scrollTop = mount.scrollHeight;

    // Controls: NEXT / AUTO / CLEAR
    if(!controlsMount) return;
    controlsMount.innerHTML = "";

    const nextBtn = document.createElement("button");
    nextBtn.className = "ctrlBtn";
    nextBtn.textContent = "NEXT";
    nextBtn.disabled = state.feedQueue.length === 0;
    nextBtn.onclick = ()=>dispatch({type:"NEXT_FEED"});

    const autoBtn = document.createElement("button");
    autoBtn.className = "ctrlBtn" + (state.autoPlay ? " active" : "");
    autoBtn.textContent = state.autoPlay ? "AUTO: ON" : "AUTO: OFF";
    autoBtn.onclick = ()=>dispatch({type:"TOGGLE_AUTO"});

    const clearBtn = document.createElement("button");
    clearBtn.className = "ctrlBtn";
    clearBtn.textContent = "CLEAR";
    clearBtn.onclick = ()=>dispatch({type:"CLEAR_FEED"});

    controlsMount.appendChild(nextBtn);
    controlsMount.appendChild(autoBtn);
    controlsMount.appendChild(clearBtn);
  }

  function renderRight(state, mount, dispatch){
    mount.innerHTML = "";

    if(state.screen === "home"){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="cardTitle">CASES</div>`;
      for(const c of state.caseIndex){
        const b = document.createElement("button");
        b.className = "actionBtn";
        b.textContent = c.title;
        b.onclick = ()=>dispatch({type:"OPEN_CASE", id:c.id});
        card.appendChild(b);
      }
      mount.appendChild(card);
      return;
    }

    if(state.screen === "intro"){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="cardTitle">CHANNEL</div><div class="small">Open when ready.</div>`;
      const b = document.createElement("button");
      b.className = "actionBtn";
      b.textContent = "BEGIN";
      b.onclick = ()=>dispatch({type:"ENTER_CASE"});
      card.appendChild(b);
      mount.appendChild(card);
      return;
    }

    if(state.screen === "results"){
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<div class="cardTitle">RESULT</div><div class="small">Review the feed.</div>`;
      const home = document.createElement("button");
      home.className = "actionBtn";
      home.textContent = "HOME";
      home.onclick = ()=>dispatch({type:"HOME"});
      card.appendChild(home);
      mount.appendChild(card);
      return;
    }

    // case screen: right tabs content
    if(state.rightTab === "team"){
      mount.appendChild(teamCard());
      return;
    }
    if(state.rightTab === "asset"){
      mount.appendChild(assetCard());
      return;
    }
    if(state.rightTab === "protocol"){
      mount.appendChild(protocolCard());
      return;
    }

    // actions
    mount.appendChild(statusCard(state));

    // confirmation block if pending
    if(state.pendingIntervention){
      const conf = document.createElement("div");
      conf.className = "card";
      conf.innerHTML = `
        <div class="cardTitle">CONFIRMATION</div>
        <div class="small mono">SUDO</div>
        <div class="small" style="line-height:1.55; white-space:pre-wrap">
You can proceed if you wish.
But understand: this path is difficult to undo.
        </div>
        <hr class="sep"/>
        <div class="small mono">Selected: ${esc(state.pendingIntervention.title)}</div>
      `;
      const row = document.createElement("div");
      row.className = "btnRow";
      const yes = document.createElement("button");
      yes.className = "actionBtn";
      yes.textContent = "PROCEED";
      yes.onclick = ()=>dispatch({type:"CONFIRM_INTERVENTION"});
      const no = document.createElement("button");
      no.className = "actionBtn";
      no.textContent = "GO BACK";
      no.onclick = ()=>dispatch({type:"CANCEL_INTERVENTION"});
      row.appendChild(yes); row.appendChild(no);
      conf.appendChild(row);
      mount.appendChild(conf);
    }

    // leads
    const leadsCard = document.createElement("div");
    leadsCard.className = "card";
    leadsCard.innerHTML = `<div class="cardTitle">LEADS</div>`;
    for(const l of state.currentCase.leads){
      if(!(state.phase >= (l.minPhase ?? 1))) continue;
      const b = document.createElement("button");
      b.className = "actionBtn";
      const used = state.usedLeads.has(l.id);
      b.disabled = used || state.pullsRemaining <= 0 || state.pendingIntervention;
      b.textContent = used ? `USED: ${l.title}` : `PULL: ${l.title}${l.risk ? " · RISK +" + l.risk : ""}`;
      b.onclick = ()=>dispatch({type:"LEAD", id:l.id});
      leadsCard.appendChild(b);
    }
    mount.appendChild(leadsCard);

    // interventions
    const intv = interventionsCard(state, dispatch);
    mount.appendChild(intv);
  }

  function statusCard(state){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cardTitle">STATUS</div>
      <div class="small">Phase: <b>${state.phase}</b> · Pulls remaining: <b>${state.pullsRemaining}</b> · Evidence tags: <b>${state.tags.size}</b></div>
      <div class="small">Threat: <b>${state.threat}%</b> · Risk: <b>${state.risk}</b></div>
    `;
    return card;
  }

  function interventionsCard(state, dispatch){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="cardTitle">INTERVENTIONS</div>`;

    const list = state.currentCase.interventions.map(i => ({
      ...i,
      unlocked: state.phase >= (i.minPhase ?? 1)
    }));

    if(!list.some(x=>x.unlocked)){
      card.innerHTML += `<div class="small">No interventions available.</div>`;
      return card;
    }

    for(const i of list){
      if(!i.unlocked) continue;
      const b = document.createElement("button");
      b.className = "actionBtn danger";
      b.disabled = !!state.pendingIntervention;
      b.textContent = i.title + (i.risk ? ` · RISK +${i.risk}` : "");
      b.onclick = ()=>dispatch({type:"INTERVENTION", id:i.id});
      card.appendChild(b);
    }

    return card;
  }

  function teamCard(){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cardTitle">TEAM</div>
      <div class="small"><b>COLE</b> — Field asset. Quiet. Effective.</div>
      <div class="small"><b>LARK</b> — Architect. Speaks carefully.</div>
      <div class="small"><b>VOSS</b> — Operative. No patience for waste.</div>
      <div class="small"><b>BROOKS</b> — Detective. Human reality. Donuts.</div>
      <div class="small"><b>DONATO</b> — Street ally. Rough edges.</div>
      <div class="small"><b>SUDO</b> — Systems devotee. Cold, watching.</div>
    `;
    return card;
  }

  function assetCard(){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cardTitle">ASSET</div>
      <div class="small mono">OBSERVER CHANNEL</div>
      <div class="small" style="line-height:1.55">
Limited access. Partial context.\n\n
You are not here to be heroic.\n
You are here to reduce harm with the smallest possible action.
      </div>
    `;
    return card;
  }

  function protocolCard(){
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="cardTitle">OBSERVER PROTOCOL</div>
      <div class="small" style="line-height:1.6">
${htmlWithBreaks(`You will receive fragments.

You have limited pulls. Each pull carries risk.
Risk is not morality. It is attention.

The system offers probability, not certainty.
Investigate first. Act second.

If you act loudly, you may attract the wrong outcome.`)}
      </div>
    `;
    return card;
  }
