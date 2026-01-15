const KEY = "system_subject_save_v2";

export function loadSave(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

export function writeSave(obj){
  try{ localStorage.setItem(KEY, JSON.stringify(obj)); }catch{}
}

export function clearSave(){
  try{ localStorage.removeItem(KEY); }catch{}
}
