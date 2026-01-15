import { createInitialState, startCase, enterCase, applyLead, chooseIntervention, setLeftTab, setRightTab, goHome, replay, canSeeLead, interventionsUnlocked, flushOne, confirmIntervention, cancelIntervention } from "./engine.js";
import { render } from "./ui.js";
import { loadSave, writeSave, clearSave } from "./storage.js";

const els = {
  leftPanel: document.getElementById("leftPanel"),
  rightPanel: document.getElementById("rightPanel"),
  feed: document.getElementById("feed"),
  leftTabs: document.getElementById("leftTabs"),
  rightTabs: document.getElementById("rightTabs"),
  rightTitle: document.getElementById("rightTitle"),
  tinyStatus: document.getElementById("tinyStatus"),
  footerHint: document.getElementById("footerHint"),
  pillScreen: document.getElementById("pillScreen"),
  pillThreat: document.getElementById("pillThreat"),
  pillPulls: document.getElementById("pillPulls"),
  pillRisk: document.getElementById("pillRisk"),
  btnJumpNewest: document.getElementById("btnJumpNewest"),
  btnClearHighlight: document.getElementById("btnClearHighlight"),
};

let state = createInitialState();
state.interventionsUnlockedFn = () => interventionsUnlocked(state);
state.canSeeLeadFn = (lead) => canSeeLead(state, lead);

boot();

async function boot(){
  state.caseList = await loadCaseIndex();
  state.screen = "home";

  const save = loadSave();
  if(save?.lastCaseId){
    // MVP: no auto-resume
  }
  startFeedTicker();
  render(state, els, dispatch);
}

function startFeedTicker(){
  // Drip-feed queued messages for a more 'live' feel
  setInterval(()=>{
    const changed = flushOne(state);
    if(changed){ render(state, els, dispatch); }
  }, 650);
}

async function dispatch(action){
  switch(action.type){
    case "OPEN_CASE": {
      const c = await loadCaseById(action.caseId);
      startCase(state, c);
      writeSave({ lastCaseId: action.caseId });
      render(state, els, dispatch);
      break;
    }
    case "ENTER_CASE": {
      enterCase(state);
      render(state, els, dispatch);
      break;
    }
    case "LEAD": {
      applyLead(state, action.leadId);
      render(state, els, dispatch);
      break;
    }
    case "INTERVENTION": {
      chooseIntervention(state, action.interventionId);
      render(state, els, dispatch);
      break;
    }
    case "CONFIRM_INTERVENTION": {
      confirmIntervention(state);
      render(state, els, dispatch);
      break;
    }
    case "CANCEL_INTERVENTION": {
      cancelIntervention(state);
      render(state, els, dispatch);
      break;
    }
    case "SET_LEFT_TAB": {
      setLeftTab(state, action.tab);
      render(state, els, dispatch);
      break;
    }
    case "SET_RIGHT_TAB": {
      setRightTab(state, action.tab);
      render(state, els, dispatch);
      break;
    }
    case "REPLAY": {
      replay(state);
      render(state, els, dispatch);
      break;
    }
    case "HOME": {
      goHome(state);
      render(state, els, dispatch);
      break;
    }
    case "RESET_SAVE": {
      clearSave();
      render(state, els, dispatch);
      break;
    }
    default:
      break;
  }
}

async function loadCaseIndex(){
  const res = await fetch("./data/cases.json", { cache:"no-store" });
  if(!res.ok) throw new Error("Failed to load case index");
  return await res.json();
}

async function loadCaseById(caseId){
  const res = await fetch(`./data/cases/${caseId}.json`, { cache:"no-store" });
  if(!res.ok) throw new Error("Failed to load case");
  return await res.json();
}
