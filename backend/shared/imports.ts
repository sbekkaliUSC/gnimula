import {component,starter,uid,validateCircuit,type Circuit,type Pin,type Kind} from './circuit';

export function spiceNumber(text:string):number {
 const m=text.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?$/i);
 if(!m)throw new Error(`Unsupported numeric expression: ${text}`);
 const scale:Record<string,number>={t:1e12,g:1e9,meg:1e6,k:1e3,m:1e-3,u:1e-6,n:1e-9,p:1e-12,f:1e-15};
 return Number(m[1])*(m[2]?scale[m[2].toLowerCase()]:1);
}
export function importDesign(name:string,text:string,options:{sky130?:boolean}={}):{document:Circuit;notes:string[]} {
 if(/\.json$/i.test(name)){
  const parsed=JSON.parse(text),d=parsed.document||parsed;validateCircuit(d);
  return {document:d,notes:['Validated Gnimula circuit document.']};
 }
 if(!/\.(cir|sp|spice|spi|net)$/i.test(name))throw new Error('Editable import supports Gnimula JSON and flat generic SPICE (.cir/.sp/.spice/.net). This file can be attached as a reference.');
 const doc=starter('blank');doc.name=name.replace(/\.[^.]+$/,'').slice(0,100);const notes=['Schematic positions are generated from the netlist; original drawing coordinates are unavailable.'];
 const nets=new Map<string,Pin[]>(),models=new Set<string>();let output='';let source='';
 const addPin=(net:string,pin:Pin)=>{net=net.toLowerCase();nets.set(net,[...(nets.get(net)||[]),pin]);};
 const lines=text.replace(/\r/g,'').split('\n').map(x=>x.trim());
 for(const line of lines){
  if(!/^\.model\s/i.test(line))continue;
  const normalized=line.toLowerCase().replace(/[()\s]/g,'');
  if(normalized==='.modelgnnmoslevel=1vto=0.7kp=120ulambda=0.01')models.add('gn');
  else if(normalized==='.modelgppmoslevel=1vto=-0.7kp=50ulambda=0.01')models.add('gp');
  else throw new Error('This deck defines a device model that the generic simulator cannot preserve. Attach it as a reference; its model will not be silently replaced.');
 }
 let first=true;
 for(const line of lines){
  if(!line||line.startsWith('*'))continue;
  const t=line.split(/\s+/),head=t[0].toLowerCase();
  if(first&&!/^[rcvmxi][a-z0-9_]*\s+\S+\s+\S+\s+/i.test(line)&&!line.startsWith('.')){doc.name=line.slice(0,100);first=false;continue;}first=false;
  if(/^\.(include|lib|control|subckt|param|func)/i.test(line)||head==='+'||/[{};$]/.test(line))throw new Error('This deck needs external models, hierarchy, expressions, or control commands. Attach the original as a reference; no partial circuit was imported.');
  if(head==='.end'||head==='.model')continue;
  if(head==='.ac'){
   if(t.length!==5||t[1].toLowerCase()!=='dec')throw new Error('Only .ac dec sweeps are supported.');
   doc.analysis={...doc.analysis,mode:'ac',points:spiceNumber(t[2]),start:spiceNumber(t[3]),stop:spiceNumber(t[4])};continue;
  }
  if(head==='.tran'){
   if(t.length!==3)throw new Error('Only .tran step stop is supported.');
   const step=spiceNumber(t[1]),stop=spiceNumber(t[2]);if(step<=0||stop<=0)throw new Error('Invalid transient interval.');
   doc.analysis={...doc.analysis,mode:'tran',start:0,stop,points:100};notes.push('Transient time range retained; the simulator chooses its own output sampling.');continue;
  }
  if(head==='.dc'){
   if(t.length!==5)throw new Error('Only a single-source .dc sweep is supported.');source=t[1];
   const start=spiceNumber(t[2]),stop=spiceNumber(t[3]),step=spiceNumber(t[4]);if(step<=0||stop<=start)throw new Error('Only ascending DC sweeps are supported.');
   doc.analysis={...doc.analysis,mode:'dc',start,stop,points:Math.max(10,Math.min(200,Math.round((stop-start)/step)))};notes.push('DC range retained; point count is bounded to the supported simulator range.');continue;
  }
  if(/^\.(print|plot|save)\b/i.test(line)){
   const probe=line.match(/v\(([a-z0-9_]+)\)/i);if(probe)output=probe[1].toLowerCase();notes.push('Output probe selected where possible; original print/plot commands are retained only in the attached source.');continue;
  }
  const kind:Kind|undefined=({r:'resistor',c:'capacitor',v:'voltage',i:'current',x:options.sky130?(t[5]?.toLowerCase()==='sky130_fd_pr__pfet_01v8'?'pmos':'nmos'):undefined,m:t[5]?.toLowerCase()==='gp'?'pmos':'nmos'} as Record<string,Kind>)[head[0]];
  if(!kind||line.startsWith('.'))throw new Error(`Unsupported SPICE line: ${t[0]}. Attach the original as a reference.`);
  const c=component(kind,160+(doc.components.length%4)*200,160+Math.floor(doc.components.length/4)*180,doc.components);c.ref=t[0];
  if(kind==='nmos'||kind==='pmos'){
   const sky=options.sky130&&head[0]==='x'&&['sky130_fd_pr__nfet_01v8','sky130_fd_pr__pfet_01v8'].includes(t[5]?.toLowerCase());
   if(t.length!==8||(!sky&&(!models.has(t[5]?.toLowerCase())||t[3].toLowerCase()!==t[4].toLowerCase())))throw new Error('MOS import requires the documented GN/GP generic model, explicit W/L, and body tied to source. PDK MOS models remain references.');
   const params=Object.fromEntries(t.slice(6).map(p=>p.toLowerCase().split('=')));
   if(!params.w||!params.l)throw new Error('Missing MOS W/L.');c.w=spiceNumber(params.w)*(sky?1:1e6);c.l=spiceNumber(params.l)*(sky?1:1e6);
   if(sky){c.deviceModel=t[5].toLowerCase() as typeof c.deviceModel;c.bulk=true;addPin(t[4],{component:c.id,pin:'b'});}
   for(const [i,pin] of [[1,'d'],[2,'g'],[3,'s']] as const)addPin(t[i],{component:c.id,pin});
  }else{
   if(kind==='current'){if(t.length===5&&t[3].toLowerCase()==='dc')c.dc=spiceNumber(t[4]);else if(t.length===4)c.dc=spiceNumber(t[3]);else throw new Error('Unsupported current source.');}
   else if(kind==='voltage'){
    const spec=t.slice(3).join(' ');const m=spec.match(/^(?:DC\s+)?(\S+)(?:\s+AC\s+(\S+))?(?:\s+SIN\(\s*(\S+)\s+(\S+)\s+(\S+)\s*\))?$/i);
    if(!m)throw new Error('Voltage sources support DC, AC magnitude, and a three-parameter SIN waveform.');
    c.dc=spiceNumber(m[1]);c.ac=m[2]?spiceNumber(m[2]):0;c.amplitude=m[4]?spiceNumber(m[4]):0;c.frequency=m[5]?spiceNumber(m[5]):10000;
    if(m[3]&&spiceNumber(m[3])!==c.dc)throw new Error('SIN offset must equal the DC voltage in this editor.');
   }else{if(t.length!==4)throw new Error('Only literal passive values are supported.');c.value=spiceNumber(t[3]);}
   addPin(t[1],{component:c.id,pin:'p'});addPin(t[2],{component:c.id,pin:'n'});
  }
  doc.components.push(c);
 }
 if(!doc.components.length)throw new Error('No supported circuit elements found.');
 if(nets.has('0')){const g=component('ground',160,160+Math.ceil(doc.components.length/4)*180,doc.components);doc.components.push(g);addPin('0',{component:g.id,pin:'0'});}
 for(const pins of nets.values())for(const p of pins.slice(1))doc.wires.push({id:uid('w'),from:pins[0],to:p});
 const input=doc.components.find(c=>c.ref.toLowerCase()===source.toLowerCase())||doc.components.find(c=>c.kind==='voltage'&&c.ac>0)||doc.components.find(c=>c.kind==='voltage');
 doc.analysis.input=input?`${input.id}.p`:'';
 const out=nets.get(output)||nets.get('out')||nets.get('vout')||[...nets.entries()].find(([n])=>n!=='0'&&n!=='in')?.[1];doc.analysis.output=out?.[0]?`${out[0].component}.${out[0].pin}`:'';
 validateCircuit(doc);return {document:doc,notes:[...new Set(notes)]};
}
export const rcExample='RC low-pass filter\nVIN in 0 DC 0 AC 1\nR1 in out 1k\nC1 out 0 10n\n.ac dec 40 10 1meg\n.print ac v(out)\n.end\n';
