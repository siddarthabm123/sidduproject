import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export function FuelModal({title,onClose,busy,children}:{title:string;onClose:()=>void;busy:boolean;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[]);
  return <dialog ref={dialog} className="fuel-dialog" data-localized onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
    <header><h2>{title}</h2><button type="button" className="fuel-icon" aria-label="Close" title="Close" disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}
  </dialog>;
}
