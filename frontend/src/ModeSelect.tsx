import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
const options=[{value:'edit',label:'Edit · preview changes'},{value:'ask',label:'Ask · explain only'}];
export default function ModeSelect({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const close=(focus=false)=>{setOpen(false);if(focus)trigger.current?.focus()};
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))close()};document.addEventListener('pointerdown',outside);root.current?.querySelector<HTMLElement>(`[data-value="${value}"]`)?.focus();return()=>document.removeEventListener('pointerdown',outside)},[open]);
 return <div className="mode-select" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))close()}} onKeyDown={e=>{if(open)e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close(true)}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open){setOpen(true);return}const items=Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')),at=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}>
  <button type="button" ref={trigger} className="mode-trigger" aria-label="Assistant mode" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{options.find(o=>o.value===value)?.label}<ChevronDown size={13}/></button>
  {open&&<div id={id} className="mode-menu" role="menu" aria-label="Assistant mode">{options.map(o=><button type="button" key={o.value} data-value={o.value} role="menuitemradio" aria-checked={value===o.value} onClick={()=>{onChange(o.value);close(true)}}><span>{o.label}</span>{value===o.value&&<Check size={13}/>}</button>)}</div>}
 </div>
}
