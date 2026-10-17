import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {type Circuit,type Component,type Shape,type Pin,type Layer,type Kind,pins,layerColors,snap,uid,component,formatValue,applyOperations} from '../../backend/shared/circuit';
import {type Camera,zoomAt,panFrom,fitBounds} from './viewport';
import type {Proposal} from './useWorkbench';
interface Props {doc:Circuit;focus:number;view:string;tool:string;selection:string[];setSelection:(ids:string[])=>void;commit:(d:Circuit,type:string,p?:Record<string,unknown>)=>void;log:(t:string,p?:Record<string,unknown>)=>void;proposal:Proposal|null;layer:Layer;hidden:Layer[];fit:number;blocked:boolean;zoomRequest:{id:number;factor:number};setZoom:(n:number)=>void}
export function Symbol({c,selected,ghost,onDown,onPin}:{c:Component;selected?:boolean;ghost?:boolean;onDown?:(e:PointerEvent)=>void;onPin?:(p:Pin,e:PointerEvent)=>void}){
 const color=ghost?'#b3df89':selected?'#f0df9b':'#d6dadf';
 return <g className={ghost?'ghost':'symbol'}>
  <g transform={`translate(${c.x} ${c.y}) rotate(${c.rotation})`} stroke={color} fill="none" strokeWidth="2" onPointerDown={onDown}>
   <rect x="-47" y="-47" width="92" height="94" rx="4" fill={selected?'#b3df8910':'transparent'} stroke={selected?'#b3df8980':'none'}/>
   {c.kind==='nmos'||c.kind==='pmos'?<><path d="M-40 0H-17 M-17 -24V24 M-9 -24V24 M0 -40V-20H-9 M0 40V20H-9 M0 0H-9"/>{c.kind==='pmos'?<circle cx="-24" cy="0" r="5" fill="#171c21"/>:<path d="M-7 14L0 20L-7 26"/>}</>:null}
   {c.bulk?<path d="M0 0H40"/>:null}
   {c.kind==='current'?<><path d="M0 -40V-23 M0 23V40 M0 -13V13 M-6 7L0 13L6 7"/><circle r="23"/></>:null}
   {c.kind==='resistor'?<path d="M0 -40V-25L-9 -20L9 -12L-9 -4L9 4L-9 12L9 20L0 25V40"/>:null}
   {c.kind==='capacitor'?<path d="M0 -40V-7 M-17 -7H17 M-17 7H17 M0 7V40"/>:null}
   {c.kind==='voltage'?<><path d="M0 -40V-23 M0 23V40 M-6 -9H6 M0 -15V-3 M-6 10H6"/><circle r="23"/></>:null}
   {c.kind==='ground'?<path d="M0 -20V0 M-18 0H18 M-11 7H11 M-4 14H4"/>:null}
  </g>
  {c.kind!=='ground'&&<><text x={c.x+(c.bulk?50:25)} y={c.y-10} fill={color} className="symbol-name">{c.ref}</text><text x={c.x+(c.bulk?50:25)} y={c.y+8} fill="#8391a1" className="symbol-value">{c.kind.includes('mos')?`${c.w}/${c.l} µm`:c.kind==='voltage'?`${c.dc} V`:c.kind==='current'?formatValue(c.dc,'A'):formatValue(c.value,c.kind==='resistor'?'Ω':'F')}</text></>}
  {pins(c).map(p=><g key={p.name} onPointerDown={e=>onPin?.({component:c.id,pin:p.name},e)} className="pin"><circle cx={p.x} cy={p.y} r="8" fill="transparent"/><circle cx={p.x} cy={p.y} r="3" fill={ghost?'#b3df89':'#8ab6ec'} stroke="#15191f"/></g>)}
 </g>
}
export default function Canvas(p:Props){
 const svg=useRef<SVGSVGElement>(null),[offset,setOffset]=useState<Camera>({x:0,y:0,zoom:1}),[drag,setDrag]=useState<any>(null),[delta,setDelta]=useState({x:0,y:0}),[wire,setWire]=useState<Pin|null>(null),[cursor,setCursor]=useState({x:0,y:0}),[rect,setRect]=useState<any>(null);
 const camera=useRef(offset),latest=useRef(p);latest.current=p;
 const [space,setSpace]=useState(false),[panning,setPanning]=useState(false),[boxArmed,setBoxArmed]=useState(false),[zoomBox,setZoomBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const spaceHeld=useRef(false),hovered=useRef(false),pointer=useRef<{clientX:number;clientY:number}|null>(null);
 const navigation=useRef<{kind:'pan'|'box';camera:Camera;start:{clientX:number;clientY:number};inverse:DOMMatrix;id:number}|null>(null);
 const pending=useRef<{from:Camera;to:Camera;action:string;source:string;updates:number}|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const flushNavigation=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;if(pending.current){latest.current.log('viewport.changed',pending.current);pending.current=null;}};
 const navigate=(next:Camera,action:string,source:string)=>{
  const before=camera.current;if(next.x===before.x&&next.y===before.y&&next.zoom===before.zoom)return;
  camera.current=next;setOffset(next);latest.current.setZoom(next.zoom);
  if(pending.current&&(pending.current.action!==action||pending.current.source!==source))flushNavigation();
  pending.current={from:pending.current?.from||before,to:next,action,source,updates:(pending.current?.updates||0)+1};
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(flushNavigation,250);
 };
 const zoom=offset.zoom,width=1000/zoom,height=640/zoom;
 const rawPoint=(e:{clientX:number;clientY:number},matrix=svg.current!.getScreenCTM()!.inverse())=>new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);
 const point=(e:{clientX:number;clientY:number})=>{const v=rawPoint(e);return{x:snap(v.x),y:snap(v.y)}};
 const zoomBy=(factor:number,source:string,anchor?:{clientX:number;clientY:number})=>{
  const c=camera.current,at=anchor?rawPoint(anchor):{x:c.x+500/c.zoom,y:c.y+320/c.zoom};navigate(zoomAt(c,at,factor),'zoom',source);
 };
 const fitView=(selected=false,source='keyboard')=>{
  const objects=(p.view==='layout'?p.doc.shapes:p.doc.components).filter(x=>!selected||p.selection.includes(x.id));
  if(!objects.length){if(!selected)navigate({x:0,y:0,zoom:1},'fit',source);return;}
  const a={x:Math.min(...objects.map(x=>x.x))-90,y:Math.min(...objects.map(x=>x.y))-90};
  const b={x:Math.max(...objects.map(x=>x.x+('width'in x?x.width:120)))+80,y:Math.max(...objects.map(x=>x.y+('height'in x?x.height:70)))+80};
  navigate(fitBounds(a,b,selected?2.5:1.2),selected?'focus':'fit',source);
 };
 const cancel=()=>{spaceHeld.current=false;setSpace(false);setBoxArmed(false);setZoomBox(null);setPanning(false);
  const n=navigation.current;navigation.current=null;if(n&&svg.current?.hasPointerCapture(n.id))svg.current.releasePointerCapture(n.id);
  setDrag(null);setDelta({x:0,y:0});setRect(null);flushNavigation();
 };
 useEffect(()=>{fitView(false,'fit')},[p.fit,p.view]);
 useEffect(()=>{if(p.focus)fitView(true,'focus')},[p.focus]);
 const lastZoomRequest=useRef(p.zoomRequest.id);
 useEffect(()=>{if(lastZoomRequest.current!==p.zoomRequest.id){lastZoomRequest.current=p.zoomRequest.id;zoomBy(p.zoomRequest.factor,'toolbar')}},[p.zoomRequest]);
 useEffect(()=>{setWire(null);cancel()},[p.tool,p.view]);
 useEffect(()=>{if(p.blocked)cancel()},[p.blocked]);
 useEffect(()=>()=>flushNavigation(),[]);
 // Native non-passive listener is needed to stop browser/page zoom on Ctrl-wheel
 // and trackpad pinch. No device guessing: wheel zooms, Shift-wheel pans.
 const handlers=useRef({wheel:(e:WheelEvent)=>{},key:(e:KeyboardEvent)=>{}});
 handlers.current={
  wheel:e=>{
   if(p.blocked)return;e.preventDefault();if(navigation.current||drag)return;
   const unit=e.deltaMode===1?16:e.deltaMode===2?svg.current!.clientHeight:1;
   if(e.shiftKey&&!e.ctrlKey&&!e.metaKey){
    const inv=svg.current!.getScreenCTM()!.inverse();navigate(panFrom(camera.current,{x:-e.deltaX*unit,y:-e.deltaY*unit},inv),'pan','scroll');
   }else zoomBy(Math.exp(-Math.max(-300,Math.min(300,e.deltaY*unit))*.002),'wheel',e);
  },
  key:e=>{
   if(p.blocked||e.defaultPrevented||e.altKey)return;
   const target=e.target as Element;
   if(target.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;
   if(!hovered.current&&document.activeElement!==svg.current)return;
   const key=e.key.toLowerCase();
   if(e.ctrlKey||e.metaKey){if(e.shiftKey&&key==='f'&&!navigation.current&&!drag){e.preventDefault();fitView(true);}return;}
   if(e.code==='Space'){e.preventDefault();if(!drag&&!navigation.current){spaceHeld.current=true;setSpace(true);}return;}
   if(key==='escape'){cancel();setWire(null);return;}
   if(navigation.current||drag)return;
   if(key==='f'){e.preventDefault();fitView(e.shiftKey);}
   else if(key==='+'||key==='='||(key==='z'&&e.shiftKey)){e.preventDefault();zoomBy(1.25,'keyboard',hovered.current?pointer.current||undefined:undefined);}
   else if(key==='-'||key==='_'){e.preventDefault();zoomBy(.8,'keyboard',hovered.current?pointer.current||undefined:undefined);}
   else if(key==='z'){e.preventDefault();setBoxArmed(true);}
   else if(key.startsWith('arrow')){e.preventDefault();const inv=svg.current!.getScreenCTM()!.inverse(),step=e.shiftKey?160:60;
    navigate(panFrom(camera.current,{x:key==='arrowleft'?step:key==='arrowright'?-step:0,y:key==='arrowup'?step:key==='arrowdown'?-step:0},inv),'pan','keyboard');}
  }
 };
 useEffect(()=>{
  const el=svg.current!,wheel=(e:WheelEvent)=>handlers.current.wheel(e),key=(e:KeyboardEvent)=>handlers.current.key(e);
  const release=(e:KeyboardEvent)=>{if(e.code==='Space'){spaceHeld.current=false;setSpace(false);}};
  const leave=()=>{hovered.current=false;cancel();},hide=()=>{if(document.hidden)leave();};
  el.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',key);window.addEventListener('keyup',release);window.addEventListener('blur',leave);document.addEventListener('visibilitychange',hide);
  return()=>{el.removeEventListener('wheel',wheel);window.removeEventListener('keydown',key);window.removeEventListener('keyup',release);window.removeEventListener('blur',leave);document.removeEventListener('visibilitychange',hide);};
 },[]);
 // Capture phase takes precedence over every object/pin/wire editing handler.
 const capture=(e:PointerEvent)=>{
  if(p.blocked){e.stopPropagation();return;}svg.current?.focus({preventScroll:true});pointer.current=e;
  if(navigation.current||drag){e.stopPropagation();return;}
  const pan=e.button===1||(e.button===0&&(spaceHeld.current||p.tool==='pan'));
  const box=e.button===2||(e.button===0&&boxArmed);
  if(!pan&&!box)return;e.preventDefault();e.stopPropagation();flushNavigation();
  navigation.current={kind:pan?'pan':'box',camera:camera.current,start:{clientX:e.clientX,clientY:e.clientY},inverse:svg.current!.getScreenCTM()!.inverse(),id:e.pointerId};
  setPanning(pan);svg.current!.setPointerCapture(e.pointerId);
 };
 const moveNavigation=(e:PointerEvent)=>{
  const n=navigation.current;if(!n)return false;if(n.id!==e.pointerId)return true;
  if(n.kind==='pan')navigate(panFrom(n.camera,{x:e.clientX-n.start.clientX,y:e.clientY-n.start.clientY},n.inverse),'pan','drag');
  else{const a=rawPoint(n.start,n.inverse),b=rawPoint(e,n.inverse);setZoomBox({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});}
  return true;
 };
 const endNavigation=(e:PointerEvent)=>{
  const n=navigation.current;if(!n)return false;if(n.id!==e.pointerId)return true;
  moveNavigation(e);
  if(n.kind==='box'&&Math.abs(e.clientX-n.start.clientX)>=8&&Math.abs(e.clientY-n.start.clientY)>=8)navigate(fitBounds(rawPoint(n.start,n.inverse),rawPoint(e,n.inverse)),'box','drag');
  navigation.current=null;setPanning(false);setZoomBox(null);setBoxArmed(false);flushNavigation();
  if(svg.current?.hasPointerCapture(n.id))svg.current.releasePointerCapture(n.id);return true;
 };
 const findPin=(ref:Pin,d=p.doc)=>{const c=d.components.find(x=>x.id===ref.component);return c?pins(c).find(x=>x.name===ref.pin):undefined;};
 const startObject=(id:string,e:PointerEvent)=>{e.stopPropagation();if(e.button!==0)return;const pos=point(e);p.setSelection(e.shiftKey?[...new Set([...p.selection,id])]:[id]);setDrag({id,start:pos});setDelta({x:0,y:0});svg.current?.setPointerCapture(e.pointerId)};
 const startPin=(pin:Pin,e:PointerEvent)=>{e.stopPropagation();if(e.button!==0)return;if(p.tool!=='wire'){p.setSelection([pin.component]);return}if(wire){if(wire.component!==pin.component||wire.pin!==pin.pin){const d=structuredClone(p.doc);d.wires.push({id:uid('w'),from:wire,to:pin});p.commit(d,'wire.created');}setWire(null)}else{setWire(pin);p.log('wire.started',{from:pin})}};
 const start=(e:PointerEvent)=>{if(e.button!==0)return;const pos=point(e);if(p.view==='layout'&&p.tool==='draw'){setRect({...pos,width:0,height:0});setDrag({draw:true,start:pos});svg.current?.setPointerCapture(e.pointerId);return}if(['nmos','pmos','resistor','capacitor','voltage','current','ground'].includes(p.tool)&&p.view==='schematic'){const d=structuredClone(p.doc);const c=component(p.tool as Kind,pos.x,pos.y,d.components);d.components.push(c);p.commit(d,'component.placed');p.setSelection([c.id]);return;}p.setSelection([]);setWire(null)};
 const move=(e:PointerEvent)=>{pointer.current={clientX:e.clientX,clientY:e.clientY};if(moveNavigation(e))return;const pt=point(e);setCursor(pt);if(!drag)return;const dx=pt.x-drag.start.x,dy=pt.y-drag.start.y;if(drag.draw)setRect({x:Math.min(pt.x,drag.start.x),y:Math.min(pt.y,drag.start.y),width:Math.abs(dx),height:Math.abs(dy)});else setDelta({x:dx,y:dy});};
 const end=(e:PointerEvent)=>{if(endNavigation(e)||!drag)return;if(drag.draw){if(rect?.width&&rect?.height){const d=structuredClone(p.doc),s:Shape={id:uid('s'),layer:p.layer,...rect,net:''};d.shapes.push(s);p.commit(d,'layout.drawn');p.setSelection([s.id]);}setRect(null)}else if(delta.x||delta.y){const d=structuredClone(p.doc);for(const x of p.view==='layout'?d.shapes:d.components)if(p.selection.includes(x.id)){x.x+=delta.x;x.y+=delta.y}p.commit(d,'objects.moved',{delta});}setDrag(null);setDelta({x:0,y:0})};
 let preview:Circuit|null=null;try{if(p.proposal?.revision===p.doc.revision)preview=applyOperations(p.doc,p.proposal.operations)}catch{}
 const drawDoc=structuredClone(p.doc);if(drag?.id)for(const c of p.view==='layout'?drawDoc.shapes:drawDoc.components)if(p.selection.includes(c.id)){c.x+=delta.x;c.y+=delta.y}
 const renderWire=(w:any,d=drawDoc,ghost=false)=>{const a=findPin(w.from,d),b=findPin(w.to,d);if(!a||!b)return null;const gate=w.to.pin==='g',upper=['p','d'].includes(w.from.pin)&&['p','d'].includes(w.to.pin);const viaY=upper?Math.min(a.y,b.y)-20:a.y-20;const path=gate?`M${a.x} ${a.y}V${viaY}H${b.x-20}V${b.y}H${b.x}`:upper?`M${a.x} ${a.y}V${viaY}H${b.x}V${b.y}`:`M${a.x} ${a.y} L${a.x} ${b.y} L${b.x} ${b.y}`;return <g key={w.id} onPointerDown={e=>{e.stopPropagation();if(e.button===0)p.setSelection([w.id])}}><path d={path} stroke="transparent" strokeWidth="14" fill="none"/><path d={path} stroke={ghost?'#b3df89':p.selection.includes(w.id)?'#efda8a':'#779dcb'} strokeWidth="1.7" strokeDasharray={ghost?'7 5':undefined} fill="none"/></g>};
 return <div className="canvas-wrap"><svg ref={svg} tabIndex={0} role="application" aria-label={`${p.view==='layout'?'Layout':'Schematic'} editor`} aria-describedby="canvas-navigation-help" className={`eda-canvas tool-${p.tool} ${space?'pan-ready':''} ${panning?'panning':''} ${boxArmed?'box-ready':''}`} viewBox={`${offset.x} ${offset.y} ${width} ${height}`} onPointerDownCapture={capture} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={()=>{if(navigation.current||drag)cancel()}} onPointerEnter={()=>{hovered.current=true}} onPointerLeave={()=>{hovered.current=false}} onContextMenu={e=>e.preventDefault()}>
  <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".8" fill="#343c45"/></pattern><pattern id="polyhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#df7979" strokeWidth="2"/></pattern></defs>
  <rect x={offset.x} y={offset.y} width={width} height={height} fill="url(#grid)"/>
  {p.view==='schematic'?<>{drawDoc.wires.map(w=>renderWire(w))}{drawDoc.components.map(c=><Symbol key={c.id} c={c} selected={p.selection.includes(c.id)} onDown={e=>startObject(c.id,e)} onPin={startPin}/>)}{preview?.components.filter(c=>!p.doc.components.some(x=>x.id===c.id&&JSON.stringify(x)===JSON.stringify(c))).map(c=><Symbol key={c.id} c={c} ghost/>)}{preview?.wires.filter(w=>!p.doc.wires.some(x=>x.id===w.id)).map(w=>renderWire(w,preview!,true))}{preview&&p.doc.components.filter(c=>!preview!.components.some(x=>x.id===c.id)).map(c=><g key={'removed-'+c.id} pointerEvents="none"><rect x={c.x-50} y={c.y-50} width="100" height="100" fill="#e58b8922" stroke="#e58b89" strokeDasharray="5 4"/><text x={c.x-45} y={c.y-55} fill="#e58b89" fontSize="11">Remove {c.ref}</text></g>)}{wire&&(()=>{const a=findPin(wire);return a?<path d={`M${a.x} ${a.y}L${a.x} ${cursor.y}L${cursor.x} ${cursor.y}`} stroke="#b3df89" fill="none" strokeDasharray="6 4"/>:null})()}</>:<>{drawDoc.shapes.filter(s=>!p.hidden.includes(s.layer)).map(s=><g key={s.id} onPointerDown={e=>startObject(s.id,e)}><rect x={s.x} y={s.y} width={s.width} height={s.height} fill={s.layer==='poly'?'url(#polyhatch)':layerColors[s.layer]} fillOpacity=".32" stroke={p.selection.includes(s.id)?'#fff':layerColors[s.layer]} strokeWidth={p.selection.includes(s.id)?3:1.5}/>{s.net&&<text x={s.x+5} y={s.y+16} fill={layerColors[s.layer]} fontSize="12">{s.net}</text>}</g>)}{preview?.shapes.filter(s=>!p.doc.shapes.some(x=>x.id===s.id&&JSON.stringify(x)===JSON.stringify(s))).map(s=><rect key={s.id} {...{x:s.x,y:s.y,width:s.width,height:s.height}} fill="#b3df8922" stroke="#b3df89" strokeDasharray="6 4"/>)}{rect&&<rect {...rect} fill="#b3df8922" stroke="#b3df89"/>}</>}
 {zoomBox&&<rect {...zoomBox} fill="#8ab6ec22" stroke="#8ab6ec" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
 </svg><div className="canvas-navigation" id="canvas-navigation-help">Scroll to zoom · Space + drag to pan · F to fit</div><div className="canvas-caption">{p.view==='layout'?'Concept layout · arbitrary grid units':'SCHEMATIC'} <span>20-unit grid</span></div><div className="canvas-coords">{cursor.x}, {cursor.y} <span>{Math.round(zoom*100)}%</span></div>{boxArmed&&<div className="canvas-tip">Drag a box to zoom. Esc cancels.</div>}{wire&&!boxArmed&&<div className="canvas-tip">Choose another terminal to connect. Esc cancels.</div>}</div>
}
