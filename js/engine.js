export function createState(){return{screen:"home",caseList:[],current:null,pulls:0,risk:0,used:new Set(),clues:[],tags:new Set(),feed:[],result:null}}
export function push(state,who,text){state.feed.push({who,text})}
export function startCase(state,data){state.current=data;state.screen="intro";state.pulls=data.rules.pulls;state.risk=0;state.used=new Set();state.clues=[];state.tags=new Set();state.feed=[];for(const m of data.openingFeed)push(state,m.who,m.text)}
export function begin(state){state.screen="case";push(state,"SYSTEM",state.current.briefing)}
export function useLead(state,id){if(state.pulls<=0||state.used.has(id))return;const l=state.current.leads.find(x=>x.id===id);state.used.add(id);state.pulls--;state.risk+=l.risk;push(state,"SYSTEM",l.resultText);state.clues.push(l);l.tags.forEach(t=>state.tags.add(t));if(l.reaction)push(state,l.reaction.who,l.reaction.text)}
export function choose(state,id){const i=state.current.interventions.find(x=>x.id===id);state.result=i.endings.good;state.screen="results"}
