export function createInitialState(){
  return {
    screen: "home", // home | boot | case | results
    leftTab: "dossier", // dossier | clues
    rightTab: "actions", // actions | team | asset
    caseList: [],
    currentCase: null,

    phase: 0,
    pullsUsed: 0,
    pullsMax: 0,
    risk: 0,
    threat: 0,

    usedLeads: new Set(),
    tags: new Set(),
    clues: [],
    feed: [],
    lastNewIndex: null,

    dossier: null,
    result: null,

    // injected by app.js for ui.js convenience
    interventionsUnlockedFn: null,
    canSeeLeadFn: null
  };
}

export function pushFeed(state, who, text, tag=null, kind="msg"){
  state.feed.push({ who, text, tag, kind, ts: Date.now() });
}

export function pushDivider(state, label="NEW"){
  state.lastNewIndex = state.feed.length;
  state.feed.push({ kind:"divider", label, ts: Date.now() });
}

export function resetRun(state){
  state.phase = 0;
  state.pullsUsed = 0;
  state.pullsMax = 0;
  state.risk = 0;
  state.threat = 0;
  state.usedLeads = new Set();
  state.tags = new Set();
  state.clues = [];
  state.feed = [];
  state.lastNewIndex = null;
  state.dossier = null;
  state.result = null;
}

export function startCase(state, caseData){
  state.screen = "boot";
  state.currentCase = caseData;
  resetRun(state);

  state.pullsMax = caseData.rules.pullsMax;
  state.threat = caseData.rules.threatStart;
  state.phase = 1;

  for(const line of caseData.boot){
    pushFeed(state, "SYSTEM", line, "ACCESS");
  }
  pushDivider(state, "CHANNEL OPEN");

  for(const m of caseData.openingFeed){
    if(m.who === caseData.pov) continue;
    pushFeed(state, m.who, m.text, m.tag || "CHAT");
  }

  rebuildDossier(state);
}

export function enterCase(state){
  state.screen = "case";
  pushDivider(state, "CASE LIVE");
  pushFeed(state, "SYSTEM", state.currentCase.briefing, "CASE");
  rebuildDossier(state);
}

export function canSeeLead(state, lead){
  const minPhase = lead.minPhase ?? 1;
  return state.phase >= minPhase;
}

export function canUseLead(state, leadId){
  const lead = state.currentCase.leads.find(l => l.id === leadId);
  if(!lead) return false;
  if(!canSeeLead(state, lead)) return false;
  if(state.usedLeads.has(leadId)) return false;
  if(state.pullsUsed >= state.pullsMax) return false;
  return true;
}

export function applyLead(state, leadId){
  if(!canUseLead(state, leadId)) return;

  const lead = state.currentCase.leads.find(l => l.id === leadId);
  state.usedLeads.add(leadId);
  state.pullsUsed += 1;
  state.risk += lead.risk ?? 0;
  state.threat = clamp(state.threat + (lead.threatDelta ?? 0), 0, 99);

  pushDivider(state, "NEW DATA");
  pushFeed(state, "SYSTEM", `LEAD: ${lead.title}\n\n${lead.resultText}`, (lead.risk ?? 0) > 0 ? "NOISY" : "QUIET");

  state.clues.push({
    title: lead.clueTitle,
    text: lead.clueText,
    tags: lead.tags ? [...lead.tags] : []
  });

  if(lead.tags){
    for(const t of lead.tags) state.tags.add(t);
  }

  if(lead.reaction && lead.reaction.who !== state.currentCase.pov){
    pushFeed(state, lead.reaction.who, lead.reaction.text, "CHAT");
  }

  applyPhaseLogic(state);
  rebuildDossier(state);
}

export function interventionsUnlocked(state){
  if(!state.currentCase) return [];
  const unlocked = (state.phase >= state.currentCase.rules.interventionPhase);
  return state.currentCase.interventions.map(i => {
    const ok = unlocked && meetsRequirements(state.tags, i.requires);
    return { ...i, unlocked: ok, globallyUnlocked: unlocked };
  });
}

export function chooseIntervention(state, interventionId){
  const list = interventionsUnlocked(state);
  const intv = list.find(i => i.id === interventionId);
  if(!intv || !intv.unlocked) return;

  state.risk += intv.risk ?? 0;
  state.threat = clamp(state.threat + (intv.threatDelta ?? 0), 0, 99);

  const rules = state.currentCase.rules;
  const evidence = state.tags.size;

  let key = "neutral";
  if(evidence >= rules.goodEvidenceThreshold) key = "good";
  if(evidence <= rules.badEvidenceThreshold) key = "bad";
  if(state.risk >= rules.highRiskThreshold || state.threat >= rules.highThreatThreshold){
    key = "bad";
  }

  const endingText = (intv.endings && (intv.endings[key] || intv.endings.neutral)) || "Outcome unknown.";

  state.result = {
    intervention: intv.title,
    key,
    endingText,
    evidence,
    risk: state.risk,
    threat: state.threat
  };

  state.screen = "results";
}

export function setLeftTab(state, tab){ state.leftTab = tab; }
export function setRightTab(state, tab){ state.rightTab = tab; }

export function goHome(state){
  state.screen = "home";
  state.currentCase = null;
  resetRun(state);
}

export function replay(state){
  const c = state.currentCase;
  if(!c) return;
  startCase(state, c);
}

function applyPhaseLogic(state){
  const triggers = state.currentCase.phaseTriggers || [];
  for(const trig of triggers){
    if(state.pullsUsed === trig.atPull && state.phase === trig.fromPhase){
      state.phase = trig.toPhase;
      if(trig.divider) pushDivider(state, trig.divider);
      for(const msg of (trig.messages || [])){
        if(msg.who === state.currentCase.pov) continue;
        pushFeed(state, msg.who, msg.text, msg.tag || "ALERT");
      }
      if(typeof trig.threatDelta === "number"){
        state.threat = clamp(state.threat + trig.threatDelta, 0, 99);
      }
      if(typeof trig.riskDelta === "number"){
        state.risk += trig.riskDelta;
      }
    }
  }
}

function rebuildDossier(state){
  const base = state.currentCase.dossier;
  const phase = state.phase;

  const resolved = {
    title: base.title,
    subjectName: base.subjectName,
    overview: base.overview,
    fields: []
  };

  for(const f of base.fields){
    const minPhase = f.minPhase ?? 1;
    const visible = phase >= minPhase;
    resolved.fields.push({
      key: f.key,
      label: f.label,
      value: visible ? f.value : f.lockedValue
    });
  }

  resolved.riskNote = phase >= (base.riskNote?.minPhase ?? 1) ? base.riskNote?.value : base.riskNote?.lockedValue;
  state.dossier = resolved;
}

function meetsRequirements(tagSet, requires){
  if(!requires) return true;
  if(Array.isArray(requires) && requires.length === 0) return true;
  if(requires.any) return requires.any.some(t => tagSet.has(t));
  if(requires.all) return requires.all.every(t => tagSet.has(t));
  if(Array.isArray(requires)) return requires.every(t => tagSet.has(t));
  return true;
}

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
