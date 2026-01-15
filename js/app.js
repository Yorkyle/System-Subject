// app.js — v4
import {
  createInitialState, loadCaseIndex, startCase, enterCase,
  applyLead, chooseIntervention, confirmIntervention, cancelIntervention,
  flushOne, toggleAutoPlay, setLeftTab, setRightTab
} from "./engine.js";
import { render } from "./ui.js";

const els = {
  feed: document.getElementById("feed"),
  feedControls: document.getElementById("feedControls"),
  leftPanel: document.getElementById("leftPanel"),
  rightPanel: document.getElementById("rightPanel"),
  leftTabs: document.getElementById("leftTabs"),
  rightTabs: document.getElementById("rightTabs"),
  pillScreen: document.getElementById("pillScreen"),
  pillRisk: document.getElementById("pillRisk"),
  pillPulls: document.getElementById("pillPulls"),
  pillThreat: document.getElementById("pillThreat"),
  hint: document.getElementById("hint")
};

const state = createInitialState();

boot();

async function boot(){
  const idx = await fetch("./data/cases.json").then(r=>r.json());
  loadCaseIndex(state, idx);
  render(state, els, dispatch);
  startAutoTicker();
}

function startAutoTicker(){
  // Autoplay tick: slower, more dramatic
  setInterval(()=>{
    if(!state.autoPlay) return;
    const changed = flushOne(state);
    if(changed) render(state, els, dispatch);
  }, 1400);
}

async function dispatch(action){
  switch(action.type){
    case "OPEN_CASE": {
      const data = await fetch(`./data/cases/${action.id}.json`).then(r=>r.json());
      startCase(state, data);
      render(state, els, dispatch);
      break;
    }
    case "ENTER_CASE": {
      enterCase(state);
      render(state, els, dispatch);
      break;
    }
    case "LEAD": {
      applyLead(state, action.id);
      render(state, els, dispatch);
      break;
    }
    case "INTERVENTION": {
      chooseIntervention(state, action.id);
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
    case "NEXT_FEED": {
      const changed = flushOne(state);
      if(changed) render(state, els, dispatch);
      break;
    }
    case "TOGGLE_AUTO": {
      toggleAutoPlay(state);
      render(state, els, dispatch);
      break;
    }
    case "CLEAR_FEED": {
      state.feed = [];
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
    case "HOME": {
      // simple reload-ish
      window.location.reload();
      break;
    }
  }
}
