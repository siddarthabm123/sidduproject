import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { UiText } from './localization';
export default function ConnectionStatus(){
 const [online,setOnline]=useState(()=>navigator.onLine);
 useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change)}},[]);
 return online?null:<div className="connection-status" role="status"><WifiOff size={18}/><UiText text="Offline. Reconnect before submitting changes."/></div>;
}
