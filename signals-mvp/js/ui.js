export function render(state,els,dispatch){
els.feed.innerHTML=state.feed.map(m=>`<div class="msg"><b>${m.who}</b><br>${m.text}</div>`).join("");
els.right.innerHTML="";
if(state.screen==="home"){
  state.caseList.forEach(c=>{
    const b=document.createElement("button");
    b.textContent=c.title;
    b.onclick=()=>dispatch({type:"OPEN",id:c.id});
    els.right.appendChild(b);
  });
}
if(state.screen==="intro"){
  const b=document.createElement("button");
  b.textContent="BEGIN";
  b.onclick=()=>dispatch({type:"BEGIN"});
  els.right.appendChild(b);
}
if(state.screen==="case"){
  state.current.leads.forEach(l=>{
    const b=document.createElement("button");
    b.textContent=l.title;
    b.disabled=state.used.has(l.id);
    b.onclick=()=>dispatch({type:"LEAD",id:l.id});
    els.right.appendChild(b);
  });
  state.current.interventions.forEach(i=>{
    const b=document.createElement("button");
    b.textContent=i.title;
    b.onclick=()=>dispatch({type:"END",id:i.id});
    els.right.appendChild(b);
  });
}
if(state.screen==="results"){
  els.right.innerHTML=`<div>${state.result}</div>`;
}
}
