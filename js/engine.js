// engine.js — v4
// Goals:
// - Feed is queued; player can advance manually (NEXT) or autoplay.
// - No literal \n appears: UI renders \n as line breaks.
// - SUDO is cold; warns on reckless play; praises golden path.
// - Interventions can require confirmation; PROCEED resolves reliably.

export function createInitialState(){
  return {
    screen: "home",               // home | intro | case | results
    caseIndex: [],
    currentCase: null,

    // feed and pacing
    feed: [],
    feedQueue: [],
    autoPlay: false,

    // gameplay
    pullsRemaining: 0,
    pullsUsed: 0,
    usedLeads: new Set(),
    tags: new Set(),
    risk: 0,
    threat: 0,
    phase: 1,

    // UI tabs
    leftTab: "dossier",           // dossier | clues
    rightTab: "actions",          // actions | team | asset | protocol

    // confirmation gate
    pendingIntervention: null,

    // sudo logic flags
    sudoFlags: {
      warnedReckless: false,
      warnedLoud: false,
      warnedLowEvidence: false,
      praised: false,
      confirmShown: false
    }
  };
}

export function resetRun(state){
  state.feed = [];
  state.feedQueue = [];
  state.autoPlay = false;

  state.pullsRemaining = 0;
  state.pullsUsed = 0;
  state.usedLeads = new Set();
  state.tags = new Set();
  state.risk = 0;
  state.threat = 0;
  state.phase = 1;

  state.pendingIntervention = null;
  state.sudoFlags = {
    warnedReckless:false, warnedLoud:false, warnedLowEvidence:false, praised:false, confirmShown:false
  };

  state.leftTab = "dossier";
  state.rightTab = "actions";
}

export function enqueue(state, who, text, tag="CHAT", kind="msg"){
  state.feedQueue.push({ who, text, tag, kind, ts: Date.now() });
}

export function enqueueDivider(state, label="—"){
  state.feedQueue.push({ kind:"divider", label, ts: Date.now() });
}

export function flushOne(state){
  if(state.feedQueue.length === 0) return false;
  state.feed.push(state.feedQueue.shift());
  return true;
}

export function flushAll(state, limit=50){
  let n = 0;
  while(n < limit && flushOne(state)) n++;
  return n;
}

export function setLeftTab(state, tab){ state.leftTab = tab; }
export function setRightTab(state, tab){ state.rightTab = tab; }
export function toggleAutoPlay(state){ state.autoPlay = !state.autoPlay; }

export function loadCaseIndex(state, arr){ state.caseIndex = arr; }

export function startCase(state, caseData){
  resetRun(state);
  state.currentCase = caseData;
  state.screen = "intro";

  state.pullsRemaining = caseData.rules?.pulls ?? 6;
  state.threat = caseData.rules?.startingThreat ?? 54;

  // Opening sequence into queue
  enqueue(state, "SYSTEM", caseData.systemNote, "ACCESS");
  enqueueDivider(state, "— CHANNEL OPEN —");
  for(const m of caseData.openingFeed){
    enqueue(state, m.who, m.text, m.tag ?? "CHAT");
  }
  enqueue(state, "SYSTEM", caseData.caseHeader, "CASE");
}

export function enterCase(state){
  state.screen = "case";
  // Briefing arrives when case begins
  enqueueDivider(state, "— CASE ACTIVE —");
  enqueue(state, "SYSTEM", state.currentCase.briefing, "CASE");
}

export function canSeeLead(state, lead){
  const minPhase = lead.minPhase ?? 1;
  return state.phase >= minPhase;
}

export function availableLeads(state){
  return state.currentCase.leads.filter(l => canSeeLead(state, l));
}

export function interventionsUnlocked(state){
  return state.currentCase.interventions.map(i => {
    const minPhase = i.minPhase ?? 1;
    return { ...i, unlocked: state.phase >= minPhase };
  });
}

function bumpThreat(state, delta){
  state.threat = Math.max(1, Math.min(99, state.threat + delta));
}

function maybeAdvancePhase(state){
  // simple phase curve tied to pulls used
  const p = state.pullsUsed;
  const nextPhase =
    p >= 6 ? 4 :
    p >= 4 ? 3 :
    p >= 2 ? 2 : 1;

  if(nextPhase > state.phase){
    state.phase = nextPhase;
    const beat = state.currentCase.escalationBeats?.[String(state.phase)];
    if(beat){
      enqueueDivider(state, beat.dividerLabel ?? "— ESCALATION —");
      for(const m of beat.feed){ enqueue(state, m.who, m.text, m.tag ?? "CHAT"); }
      if(typeof beat.threatDelta === "number") bumpThreat(state, beat.threatDelta);
    }
  }
}

function sudoAdaptive(state){
  // Reckless = lots of pulls, not enough tags
  if(!state.sudoFlags.warnedReckless && state.pullsUsed >= 3 && state.tags.size <= 2){
    enqueue(state, "SUDO", "You’re moving quickly. That rarely ends well.");
    state.sudoFlags.warnedReckless = true;
  }
  // Loud = risk too high
  if(!state.sudoFlags.warnedLoud && state.risk >= 4){
    enqueue(state, "SUDO", "You are pulling loud threads.");
    state.sudoFlags.warnedLoud = true;
  }
  // Low evidence near acting window
  if(!state.sudoFlags.warnedLowEvidence && state.phase >= 3 && state.tags.size <= 4){
    enqueue(state, "SUDO", "You are preparing to act without understanding.");
    state.sudoFlags.warnedLowEvidence = true;
  }
  // Golden path praise: careful + evidence-rich
  const golden = state.tags.size >= 8 && state.risk <= 2;
  if(!state.sudoFlags.praised && golden){
    enqueue(state, "SUDO", "…Impressive.");
    state.sudoFlags.praised = true;
  }
}

export function applyLead(state, leadId){
  if(state.screen !== "case") return;
  if(state.pullsRemaining <= 0) return;
  if(state.usedLeads.has(leadId)) return;

  const lead = state.currentCase.leads.find(l => l.id === leadId);
  if(!lead) return;
  if(!canSeeLead(state, lead)) return;

  state.usedLeads.add(leadId);
  state.pullsRemaining--;
  state.pullsUsed++;

  if(typeof lead.risk === "number") state.risk += lead.risk;
  if(typeof lead.threatDelta === "number") bumpThreat(state, lead.threatDelta);

  // Result comes as a SYSTEM readout
  enqueue(state, "SYSTEM", lead.resultText, "DATA");

  // Evidence tags
  (lead.tags ?? []).forEach(t => state.tags.add(t));

  // Optional reaction
  if(lead.reaction){
    enqueue(state, lead.reaction.who, lead.reaction.text, lead.reaction.tag ?? "CHAT");
  }

  // After each lead: phase progression + sudo logic
  maybeAdvancePhase(state);
  sudoAdaptive(state);
}

function resolveIntervention(state, interventionId){
  const list = interventionsUnlocked(state);
  const intv = list.find(i => i.id === interventionId);
  if(!intv || !intv.unlocked) return;

  if(typeof intv.risk === "number") state.risk += intv.risk;
  if(typeof intv.threatDelta === "number") bumpThreat(state, intv.threatDelta);

  const rules = state.currentCase.rules ?? {};
  const evidence = state.tags.size;

  let key = "neutral";
  if(evidence >= (rules.goodEvidenceThreshold ?? 10)) key = "good";
  if(evidence <= (rules.badEvidenceThreshold ?? 4)) key = "bad";
  if(state.risk >= (rules.highRiskThreshold ?? 7) || state.threat >= (rules.highThreatThreshold ?? 85)){
    key = "bad";
  }

  const endingText = (intv.endings && (intv.endings[key] || intv.endings.neutral)) || "Outcome unknown.";

  state.screen = "results";
  enqueueDivider(state, "— CASE ARCHIVED —");
  enqueue(state, "SYSTEM", endingText, "CASE");
  for(const m of (state.currentCase.epilogueFeed ?? [])){
    enqueue(state, m.who, m.text, m.tag ?? "CHAT");
  }
}

export function chooseIntervention(state, interventionId){
  if(state.screen !== "case") return;

  const list = interventionsUnlocked(state);
  const intv = list.find(i => i.id === interventionId);
  if(!intv || !intv.unlocked) return;

  // Confirmation gate only once per selection
  const needsConfirm = (state.tags.size <= 4) || ((intv.risk ?? 0) >= 3);

  if(needsConfirm && !state.pendingIntervention){
    state.pendingIntervention = { id: intv.id, title: intv.title };
    // show SUDO confirm line once
    if(!state.sudoFlags.confirmShown){
      enqueue(state, "SUDO", "You can proceed if you wish.\nBut understand: this path is difficult to undo.");
      state.sudoFlags.confirmShown = true;
    } else {
      // still add a quiet, cold repeat but different wording
      enqueue(state, "SUDO", "Proceed, then.");
    }
    return;
  }

  // If already pending, selecting again should update pending target (no spam)
  if(state.pendingIntervention && state.pendingIntervention.id !== intv.id){
    state.pendingIntervention = { id: intv.id, title: intv.title };
    enqueue(state, "SUDO", "Changed. Noted.");
    return;
  }

  // If no confirm needed, resolve immediately
  resolveIntervention(state, intv.id);
}

export function cancelIntervention(state){
  state.pendingIntervention = null;
  // allow confirmations again later
  state.sudoFlags.confirmShown = false;
}

export function confirmIntervention(state){
  if(!state.pendingIntervention) return;
  const id = state.pendingIntervention.id;
  state.pendingIntervention = null;
  state.sudoFlags.confirmShown = false;
  resolveIntervention(state, id);
}
