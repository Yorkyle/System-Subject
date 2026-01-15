import{createState,startCase,begin,useLead,choose}from"./engine.js";import{render}from"./ui.js";
const els={feed:document.getElementById("feed"),right:document.getElementById("right")};
let state=createState();
boot();
async function boot(){
  const res=await fetch("./data/cases.json").then(r=>r.json()).catch(()=>[{id:"case001",title:"CASE 001 — Late Shift"}]);
  state.caseList=res;
  render(state,els,dispatch);
}
async function dispatch(a){
  if(a.type==="OPEN"){const data=await fetch(`./data/cases/${a.id}.json`).then(r=>r.json());startCase(state,data)}
  if(a.type==="BEGIN")begin(state);
  if(a.type==="LEAD")useLead(state,a.id);
  if(a.type==="END")choose(state,a.id);
  render(state,els,dispatch);
}
