import {validateDevice,validateDefinitions,knownModels,modelForLine,spiceIdentifier,type DeviceSpec} from './spice-data';
export type Kind = 'nmos' | 'pmos' | 'resistor' | 'capacitor' | 'voltage' | 'current' | 'ground' | 'device';
export type Layer = 'active' | 'poly' | 'metal1' | 'metal2' | 'contact' | 'via1';
export interface Component { id: string; ref: string; kind: Kind; x: number; y: number; rotation: number; value: number; w: number; l: number; dc: number; ac: number; frequency: number; amplitude: number; device?: DeviceSpec; waveform?: string; bulk?: boolean; deviceModel?: 'sky130_fd_pr__nfet_01v8' | 'sky130_fd_pr__pfet_01v8'; }
export interface Pin { component: string; pin: string }
export interface Wire { id: string; from: Pin; to: Pin }
export interface Shape { id: string; layer: Layer; x: number; y: number; width: number; height: number; net: string }
export interface Analysis { mode: 'ac' | 'tran' | 'dc'; start: number; stop: number; points: number; input: string; output: string }
export interface Circuit { schema: 1; name: string; revision: number; components: Component[]; wires: Wire[]; shapes: Shape[]; analysis: Analysis; definitions?:string[]; nodeNames?:Record<string,string>; preparationIssues?:string[] }
export interface Memory { id: string; key: string; value: number | string; description: string; sourceEventId?: string; createdAt?: number }
export interface ActionEvent { id: string; seq: number; type: string; at: number; revision: number; actor: 'human' | 'model' | 'system'; payload: Record<string, unknown> }
export type Operation = { type: 'add_component'; component: Component } | { type: 'update_component'; id: string; changes: Partial<Component> } | { type: 'add_wire'; wire: Wire } | { type: 'add_shape'; shape: Shape } | { type: 'update_shape'; id: string; changes: Partial<Shape> } | {type:'delete_component'|'delete_wire'|'delete_shape';id:string} | {type:'update_analysis';changes:Partial<Analysis>};
export interface Candidate { id: string; title: string; description: string; operations: Operation[]; memoryIds: string[] }
export const kinds: Kind[] = ['nmos','pmos','resistor','capacitor','voltage','current','ground','device'];
export const layers: Layer[] = ['active','poly','metal1','metal2','contact','via1'];
export const layerColors: Record<Layer,string> = { active:'#75c677',poly:'#df7979',metal1:'#6e9fe9',metal2:'#dcbe67',contact:'#d4c4e8',via1:'#d6e1f2' };
export const uid = (prefix = 'id') => `${prefix}_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`;
export const snap = (n: number, grid = 20) => Math.round(n / grid) * grid;
export const pinKey = (p: Pin) => `${p.component}.${p.pin}`;
export function pins(c: Component): {name:string;x:number;y:number}[] {
  const p = c.kind==='device'&&c.device ? c.device.terminals.map((name,i,ps)=>({name,x:i<Math.ceil(ps.length/2)?-70:70,y:(i%Math.ceil(ps.length/2)-(Math.ceil(ps.length/2)-1)/2)*20})) : c.kind === 'ground' ? [{name:'0',x:0,y:-20}] : ['nmos','pmos'].includes(c.kind) ? [{name:'g',x:-40,y:0},{name:'d',x:0,y:-40},{name:'s',x:0,y:40},...(c.bulk?[{name:'b',x:40,y:0}]:[])] : [{name:'p',x:0,y:-40},{name:'n',x:0,y:40}];
  const a = c.rotation * Math.PI / 180;
  return p.map(v=>({name:v.name,x:c.x+v.x*Math.cos(a)-v.y*Math.sin(a),y:c.y+v.x*Math.sin(a)+v.y*Math.cos(a)}));
}
export function nextReference(prefix:string,all:Component[]=[]){let n=1;while(all.some(c=>c.ref.toLowerCase()===(prefix+n).toLowerCase()))n++;return prefix+n;}
export function component(kind: Kind, x:number, y:number, all:Component[]=[]):Component {
 const prefix = {nmos:'M',pmos:'M',resistor:'R',capacitor:'C',voltage:'V',current:'I',ground:'G',device:'X'}[kind];
 return {id:uid('c'),ref:nextReference(prefix,all),kind,x:snap(x),y:snap(y),rotation:0,value:kind==='capacitor'?1e-11:10000,w:10,l:1,dc:kind==='voltage'?3.3:kind==='current'?0.0001:0,ac:0,frequency:10000,amplitude:0};
}
export function starter(template='amplifier'):Circuit {
 const make=(id:string,ref:string,kind:Kind,x:number,y:number,props:Partial<Component>={}):Component=>({...component(kind,x,y),id,ref,...props});
 const wire=(a:string,b:string):Wire=>({id:uid('w'),from:{component:a.split('.')[0],pin:a.split('.')[1]},to:{component:b.split('.')[0],pin:b.split('.')[1]}});
 const doc:Circuit={schema:1,name:template==='mirror'?'NMOS current mirror':template==='blank'?'Untitled circuit':'Common-source amplifier',revision:0,components:[],wires:[],shapes:[],analysis:{mode:'ac',start:10,stop:1e8,points:40,input:'vin.p',output:'m1.d'}};
 if(template==='blank')return doc;
 doc.components=[make('vdd','VDD','voltage',160,200,{dc:3.3}),make('rd','RD','resistor',480,180,{value:10000}),make('m1','M1','nmos',480,360),make('vin','VIN','voltage',280,360,{dc:1.25,ac:1,amplitude:0.01}),make('cl','CL','capacitor',700,360,{value:1e-11}),make('gnd','GND','ground',480,520)];
 doc.wires=[wire('vdd.p','rd.p'),wire('rd.n','m1.d'),wire('m1.d','cl.p'),wire('vin.p','m1.g'),wire('m1.s','gnd.0'),wire('vdd.n','gnd.0'),wire('vin.n','gnd.0'),wire('cl.n','gnd.0')];
 doc.shapes=[{id:'a1',layer:'active',x:180,y:200,width:320,height:160,net:'source'},{id:'p1',layer:'poly',x:240,y:160,width:24,height:240,net:'gate'},{id:'p2',layer:'poly',x:340,y:160,width:24,height:240,net:'gate'},{id:'ml1',layer:'metal1',x:180,y:260,width:320,height:32,net:'source'},{id:'ct1',layer:'contact',x:200,y:266,width:20,height:20,net:'source'},{id:'ct2',layer:'contact',x:460,y:266,width:20,height:20,net:'source'}];
 if(template==='mirror'){
  doc.components=[make('vdd','VDD','voltage',140,200,{dc:3.3}),make('r1','RREF','resistor',340,180),make('r2','RLOAD','resistor',620,180,{value:8000}),make('m1','M1','nmos',340,360),make('m2','M2','nmos',620,360),make('gnd','GND','ground',480,520)];
  doc.wires=[wire('vdd.p','r1.p'),wire('vdd.p','r2.p'),wire('r1.n','m1.d'),wire('m1.d','m1.g'),wire('m1.g','m2.g'),wire('m2.d','r2.n'),wire('m1.s','gnd.0'),wire('m2.s','gnd.0'),wire('vdd.n','gnd.0')];
  doc.analysis={mode:'dc',start:0.5,stop:3.3,points:70,input:'vdd.p',output:'m2.d'};
 }
 return doc;
}
function finite(value:unknown,min:number,max:number):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max}
export function validateCircuit(value: unknown): asserts value is Circuit {
 const d=value as Circuit;
 if(!d||d.schema!==1||typeof d.name!=='string'||d.name.length>100||!finite(d.revision,0,1e9)||!Number.isInteger(d.revision)||!Array.isArray(d.components)||d.components.length>120||!Array.isArray(d.wires)||d.wires.length>400||!Array.isArray(d.shapes)||d.shapes.length>500)throw new Error('Invalid project document or project is too large.');
 const ids=new Set<string>(), refs=new Set<string>();
 const checkId=(id:string)=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(id)||ids.has(id))throw new Error('Invalid or duplicate object ID.');ids.add(id)};
 if(d.definitions)validateDefinitions(d.definitions);if(d.preparationIssues&&(!Array.isArray(d.preparationIssues)||d.preparationIssues.length>100||d.preparationIssues.some(x=>typeof x!=='string'||x.length>1000)))throw new Error('Invalid preparation issues.');
 for(const c of d.components){if(c.kind==='device')validateDevice(c.device!);else if(c.device)throw new Error('Device data requires a model-backed instance.');if(c.waveform!==undefined&&(!['voltage','current'].includes(c.kind)||c.waveform.length>2000||!/^((?:PULSE|PWL|SIN|EXP)\([0-9.eE+\-, tTgGkKmMuUnNpPfF]+\))$/i.test(c.waveform)))throw new Error('Invalid source waveform.');checkId(c.id);if(!kinds.includes(c.kind)||typeof c.ref!=='string'||! /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(c.ref)||refs.has(c.ref.toLowerCase()))throw new Error('Invalid or duplicate component reference.');refs.add(c.ref.toLowerCase());if(d.nodeNames&&!c.ref.toUpperCase().startsWith(({device:c.device?.prefix,nmos:c.deviceModel?'X':'M',pmos:c.deviceModel?'X':'M',resistor:'R',capacitor:'C',voltage:'V',current:'I',ground:'G'}[c.kind])!))throw new Error('Keep the source reference prefix for this device type.');if(c.bulk!==undefined&&typeof c.bulk!=='boolean')throw new Error('Invalid body terminal.');if(c.bulk&&!['nmos','pmos'].includes(c.kind))throw new Error('Only MOS devices have a body terminal.');if(c.deviceModel!==undefined&&c.deviceModel!==({nmos:'sky130_fd_pr__nfet_01v8',pmos:'sky130_fd_pr__pfet_01v8'} as Record<string,string>)[c.kind])throw new Error('Unsupported device model.');if(!finite(c.x,-10000,10000)||!finite(c.y,-10000,10000)||![0,90,180,270].includes(c.rotation)||!finite(c.value,1e-15,1e12)||!finite(c.w,0.1,10000)||!finite(c.l,0.1,1000)||!finite(c.dc,-100,100)||!finite(c.ac,0,10)||!finite(c.frequency,0.1,1e9)||!finite(c.amplitude,0,10))throw new Error('Component parameter is outside supported limits.');}
 const validPin=(p:Pin)=>d.components.some(c=>c.id===p?.component&&pins(c).some(q=>q.name===p.pin));
 if(d.nodeNames&&(typeof d.nodeNames!=='object'||Array.isArray(d.nodeNames)||Object.keys(d.nodeNames).length>4000||Object.entries(d.nodeNames).some(([p,n])=>typeof n!=='string'||!spiceIdentifier.test(n)||!/^[-a-zA-Z0-9_]{1,64}\.[a-zA-Z0-9_]{1,80}$/.test(p))))throw new Error('Invalid source node names.');
 for(const w of d.wires){checkId(w.id);if(!validPin(w.from)||!validPin(w.to)||pinKey(w.from)===pinKey(w.to))throw new Error('A wire references an invalid terminal.');}
 for(const s of d.shapes){checkId(s.id);if(!layers.includes(s.layer)||!finite(s.x,-10000,10000)||!finite(s.y,-10000,10000)||!finite(s.width,1,20000)||!finite(s.height,1,20000)||typeof s.net!=='string'||!/^[a-zA-Z0-9_]{0,32}$/.test(s.net))throw new Error('Invalid layout geometry.');}
 const a=d.analysis;if(!a||!['ac','tran','dc'].includes(a.mode)||!finite(a.start,0,1e12)||!finite(a.stop,1e-12,1e12)||!finite(a.points,10,200)||!Number.isInteger(a.points)||typeof a.input!=='string'||typeof a.output!=='string'||a.input.length>80||a.output.length>80)throw new Error('Invalid analysis configuration.');
}
export function netMap(d:Circuit): Map<string,string> {
 const parent=new Map<string,string>(); for(const c of d.components)for(const p of pins(c))parent.set(`${c.id}.${p.name}`,`${c.id}.${p.name}`);
 const find=(k:string):string=>{const v=parent.get(k);if(!v)return k; if(v!==k)parent.set(k,find(v));return parent.get(k)!};
 for(const w of d.wires)parent.set(find(pinKey(w.from)),find(pinKey(w.to)));
 const names=new Map<string,string>();
 for(const c of d.components.filter(c=>c.kind==='ground'))names.set(find(`${c.id}.0`),'0');
 const used=new Set(names.values());for(const [pin,label] of Object.entries(d.nodeNames||{})){const root=find(pin);if(!parent.has(pin)||names.has(root)||label==='0'||used.has(label.toLowerCase()))continue;names.set(root,label.toLowerCase());used.add(label.toLowerCase());}
 if(parent.has(d.analysis.output)&&!names.has(find(d.analysis.output)))names.set(find(d.analysis.output),'out');
 if(parent.has(d.analysis.input)&&!names.has(find(d.analysis.input)))names.set(find(d.analysis.input),'in');
 let i=0;for(const k of parent.keys()){const r=find(k);if(!names.has(r)){while(used.has(`n${i+1}`))i++;const label=`n${++i}`;names.set(r,label);used.add(label);}}
 return new Map([...parent.keys()].map(k=>[k,names.get(find(k))!]));
}
export interface Issue {level:'error'|'warning'; message:string; objectId?:string}
export function checkCircuit(d:Circuit): Issue[]{
 const issues:Issue[]=(d.preparationIssues||[]).map(message=>({level:'error',message}));const models=knownModels(d.definitions);for(const c of d.components){if(c.device?.model&&!models.has(c.device.model.toLowerCase()))issues.push({level:'error',message:`${c.ref}: model ${c.device.model} is missing. Attach its public model file in Sources.`,objectId:c.id});}for(const line of d.definitions||[]){if(line.startsWith('.'))continue;const model=modelForLine(line);if(model&&!models.has(model.toLowerCase()))issues.push({level:'error',message:`Subcircuit model ${model} is missing. Attach its public model file in Sources.`});} if(!d.components.some(c=>c.kind==='ground'))issues.push({level:'error',message:'Place a ground reference before simulating.'});
 if(!d.components.some(c=>c.kind==='voltage'))issues.push({level:'error',message:'Add a voltage source.'});
 const connected=new Set(d.wires.flatMap(w=>[pinKey(w.from),pinKey(w.to)]));
 for(const c of d.components)for(const p of pins(c))if(!connected.has(`${c.id}.${p.name}`)&&!(c.kind==='device'&&c.device?.prefix==='X'&&`${c.id}.${p.name}`===d.analysis.output))issues.push({level:'error',message:`${c.ref}.${p.name} is unconnected.`,objectId:c.id});
 const nets=netMap(d);for(const c of d.components)if(c.kind!=='ground'){const ns=pins(c).map(p=>nets.get(`${c.id}.${p.name}`));if(c.kind==='voltage'&&ns[0]===ns[1])issues.push({level:'error',message:`${c.ref} is shorted.`,objectId:c.id});}
 if(!nets.has(d.analysis.output))issues.push({level:'error',message:'Choose a valid output terminal in Simulation settings.'});
 if(!nets.has(d.analysis.input))issues.push({level:'error',message:'Choose a valid input terminal in Simulation settings.'});
 return issues;
}
export function checkLayout(d:Circuit): Issue[]{
 const result:Issue[]=[];
 for(const s of d.shapes){if(Math.min(s.width,s.height)<8)result.push({level:'warning',message:`${s.layer}: width below the demo 8-unit guide.`,objectId:s.id});}
 const metals=d.shapes.filter(s=>s.layer.startsWith('metal'));
 for(let i=0;i<metals.length;i++)for(let j=i+1;j<metals.length;j++){const a=metals[i],b=metals[j];if(a.layer===b.layer&&a.net&&b.net&&a.net!==b.net&&a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height)result.push({level:'error',message:`${a.layer}: overlapping geometry on nets ${a.net} and ${b.net}.`,objectId:a.id});}
 return result;
}
export function spiceReference(c:Component,d:Circuit){return d.nodeNames?c.ref:({device:c.device?.prefix||'X',nmos:'M',pmos:'M',resistor:'R',capacitor:'C',voltage:'V',current:'I',ground:'G'}[c.kind]+c.id.replace(/[^a-zA-Z0-9]/g,''));}
export function spice(d:Circuit):string{
 validateCircuit(d);const sky=d.components.some(c=>c.deviceModel||c.device?.model?.startsWith('sky130_fd_pr__')),nets=netMap(d),node=(c:Component,p:string)=>nets.get(`${c.id}.${p}`)||'0';
 const rows=['Gnimula generated circuit',sky?'* SKY130 1.8V tt models provisioned by Gnimula':'* Generic educational MOS models, SI units'];
 for(const c of d.components){if(c.kind==='ground')continue;const name=spiceReference(c,d);
 if(c.kind==='device'&&c.device)rows.push(`${c.ref} ${c.device.terminals.map(p=>node(c,p)).join(' ')} ${c.device.parameters}`);
 else if(c.kind==='nmos'||c.kind==='pmos')rows.push(`${c.deviceModel?'X'+name:name} ${node(c,'d')} ${node(c,'g')} ${node(c,'s')} ${node(c,c.bulk?'b':'s')} ${c.deviceModel||(c.kind==='nmos'?'GN':'GP')} W=${c.w}${sky?'':'u'} L=${c.l}${sky?'':'u'}`);
 else if(c.kind==='current')rows.push(`${name} ${node(c,'p')} ${node(c,'n')} DC ${c.dc}${c.waveform?' '+c.waveform:''}`);
 else if(c.kind==='voltage')rows.push(`${name} ${node(c,'p')} ${node(c,'n')} DC ${c.dc} AC ${c.ac} ${c.waveform||`SIN(${c.dc} ${c.amplitude} ${c.frequency})`}`);
 else rows.push(`${name} ${node(c,'p')} ${node(c,'n')} ${c.value}`);
 }
 rows.push(...(d.definitions||[]));
 if(!d.definitions?.some(l=>/^\.model\s+GN\s/i.test(l)))rows.push('.model GN NMOS (LEVEL=1 VTO=0.7 KP=120u LAMBDA=0.01)');if(!d.definitions?.some(l=>/^\.model\s+GP\s/i.test(l)))rows.push('.model GP PMOS (LEVEL=1 VTO=-0.7 KP=50u LAMBDA=0.01)');rows.push('.end');return rows.join('\n')+'\n';
}
export function applyOperations(d:Circuit,ops:Operation[]):Circuit{
 const next=structuredClone(d);if(!Array.isArray(ops)||ops.length>20)throw new Error('Too many completion operations.');
 for(const op of ops){switch(op.type){case'add_component':next.components.push(op.component);break;case'update_component':{const c=next.components.find(x=>x.id===op.id);if(!c)throw new Error('Component no longer exists.');Object.assign(c,op.changes,{id:c.id});break;}case'add_wire':next.wires.push(op.wire);break;case'add_shape':next.shapes.push(op.shape);break;case'update_shape':{const s=next.shapes.find(x=>x.id===op.id);if(!s)throw new Error('Shape no longer exists.');Object.assign(s,op.changes,{id:s.id});break;}case'delete_component':{if(!next.components.some(c=>c.id===op.id))throw new Error('Component no longer exists.');next.components=next.components.filter(c=>c.id!==op.id);next.wires=next.wires.filter(w=>w.from.component!==op.id&&w.to.component!==op.id);break;}case'delete_wire':{if(!next.wires.some(w=>w.id===op.id))throw new Error('Wire no longer exists.');next.wires=next.wires.filter(w=>w.id!==op.id);break;}case'delete_shape':{if(!next.shapes.some(s=>s.id===op.id))throw new Error('Shape no longer exists.');next.shapes=next.shapes.filter(s=>s.id!==op.id);break;}case'update_analysis':Object.assign(next.analysis,op.changes);break;default:throw new Error('Unsupported completion.');}}
 if(next.nodeNames)next.nodeNames=Object.fromEntries(Object.entries(next.nodeNames).filter(([p])=>next.components.some(c=>p.startsWith(c.id+'.'))));next.revision=d.revision+1;validateCircuit(next);return next;
}
export function candidates(d:Circuit,selected:string[],view:string,memories:Memory[]):Candidate[]{
 const out:Candidate[]=[],getMem=(key:string)=>memories.find(m=>m.key===key),spacing=getMem('spacing'),width=getMem('mosWidth');
 if(view==='layout'){
  const chosen=d.shapes.find(s=>selected.includes(s.id))||d.shapes[d.shapes.length-1];
  if(chosen){const same=d.shapes.filter(s=>s.layer===chosen.layer).sort((a,b)=>a.x-b.x);const step=Number(spacing?.value)||(same.length>=2?Math.abs(same.at(-1)!.x-same.at(-2)!.x):100)||100;const shape={...chosen,id:uid('s'),x:Math.max(...same.map(s=>s.x))+step};out.push({id:'extend-layout',title:`Continue ${chosen.layer} pattern`,description:`Place the next shape ${step} units along the row${spacing?' using your saved spacing':''}.`,operations:[{type:'add_shape',shape}],memoryIds:spacing?[spacing.id]:[]});}
  return out;
 }
 const selectedComponents=d.components.filter(c=>selected.includes(c.id));
 const target=selectedComponents[0]||d.components.filter(c=>c.kind==='nmos'||c.kind==='pmos').at(-1);
 if(target&&target.kind!=='ground'){
  const same=d.components.filter(c=>c.kind===target.kind).sort((a,b)=>a.x-b.x);
  const step=Number(spacing?.value)||(same.length>1?Math.abs(same.at(-1)!.x-same.at(-2)!.x):160)||160;
  const c={...target,...{id:uid('c'),ref:nextReference(target.device?.prefix||target.ref[0],d.components),x:Math.max(...same.map(c=>c.x))+step,y:target.y}};
  if(width&&['nmos','pmos'].includes(c.kind))c.w=Number(width.value);
  out.push({id:'repeat-device',title:`Continue the ${target.kind==='nmos'?'NMOS':target.kind==='pmos'?'PMOS':target.kind} row`,description:`Add ${c.ref} at ${step}-unit spacing${width?`, W = ${c.w} µm`:''}. Wiring remains yours to review.`,operations:[{type:'add_component',component:c}],memoryIds:[spacing?.id,width?.id].filter(Boolean) as string[]});
  if(same.length>1){
   const changes=same.filter(c=>c.id!==target.id&&c.y!==target.y).slice(0,10).map(c=>({type:'update_component' as const,id:c.id,changes:{y:target.y}}));
   if(changes.length)out.push({id:'align-row',title:'Align the repeated devices',description:`Align ${changes.length} devices with ${target.ref}.`,operations:changes,memoryIds:[]});
   if(['nmos','pmos'].includes(target.kind)){const w=Number(width?.value)||target.w;const ops=same.filter(c=>c.w!==w||c.l!==target.l).slice(0,10).map(c=>({type:'update_component' as const,id:c.id,changes:{w,l:target.l}}));if(ops.length)out.push({id:'match-devices',title:'Match transistor dimensions',description:`Use W/L = ${w}/${target.l} µm across this group.`,operations:ops,memoryIds:width?[width.id]:[]});}
  }
 }
 const nets=netMap(d),connected=new Set(d.wires.flatMap(w=>[pinKey(w.from),pinKey(w.to)]));
 for(const c of d.components.filter(c=>c.kind==='nmos').slice(-8)){
  if(!connected.has(`${c.id}.s`)){
   const ref=d.components.find(r=>r.kind==='nmos'&&r.id!==c.id&&nets.get(`${r.id}.s`)==='0');
   if(ref)out.unshift({id:`source-${c.id}`,title:`Complete ${c.ref}'s source connection`,description:`Connect its source to the same ground net as ${ref.ref}.`,operations:[{type:'add_wire',wire:{id:uid('w'),from:{component:c.id,pin:'s'},to:{component:ref.id,pin:'s'}}}],memoryIds:[]});
  }
 }
 return out.slice(0,6);
}
export function formatValue(n:number,unit=''):string{if(!Number.isFinite(n))return'—';const abs=Math.abs(n);for(const [scale,prefix] of [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']] as [number,string][]){if(abs>=scale||scale===1e-12)return `${Number((n/scale).toPrecision(4))} ${prefix}${unit}`;}return`${n} ${unit}`;}
