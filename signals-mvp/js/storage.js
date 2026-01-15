export function loadSave(){try{return JSON.parse(localStorage.getItem("signals"))}catch{return null}}
export function writeSave(obj){try{localStorage.setItem("signals",JSON.stringify(obj))}catch{}}
export function clearSave(){try{localStorage.removeItem("signals")}catch{}}
