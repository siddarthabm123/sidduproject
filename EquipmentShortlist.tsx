import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { validShortlist } from './upgrades/tools';
import { upgradeText } from './upgrades/labels';
import type { UpgradeLanguage } from './upgrades/suppliers';
import './upgrades.css';

export function useEquipmentShortlist(account:string){
  const key=`rigdesk-shortlist-v1:${account}`;
  const load=()=>{try{return validShortlist(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return []}};
  const [saved,setSaved]=useState<string[]>(load),[error,setError]=useState('');
  useEffect(()=>{setSaved(load());setError('');const sync=()=>setSaved(load());window.addEventListener('storage',sync);window.addEventListener('rigdesk-shortlist',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('rigdesk-shortlist',sync)}},[key]);
  const toggle=(id:string)=>{
    try{const current=load(),next=current.includes(id)?current.filter(x=>x!==id):validShortlist([...current,id]);if(!current.includes(id)&&current.length>=100)throw new Error('Saved equipment limit reached.');localStorage.setItem(key,JSON.stringify(next));setSaved(next);setError('');window.dispatchEvent(new Event('rigdesk-shortlist'))}
    catch{setError('Saved equipment could not be stored on this device.')}
  };
  return {saved,toggle,error};
}
export function SaveEquipmentButton({saved,onToggle,language}:{saved:boolean;onToggle:()=>void;language:UpgradeLanguage}){
  return <button type="button" className="rd-save-equipment" aria-pressed={saved} onClick={onToggle}>{saved?<BookmarkCheck size={16}/>:<Bookmark size={16}/>} {upgradeText(saved?'Remove saved equipment':'Save equipment',language)}</button>;
}
