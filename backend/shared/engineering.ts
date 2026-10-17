import {validateCircuit,netMap,spice,spiceReference,checkCircuit,type Circuit} from './circuit';
import {importSource} from './source-import';
import {spiceNumber} from './imports';
export const toolNames=['create_circuit','simulate','generate_layout','verify_layout','simulate_extracted'] as const;
export type ToolName=typeof toolNames[number];
export type ToolCall={action:ToolName;name?:string;netlist?:string;replaceExisting?:boolean};
export const toolLabels:Record<ToolName,string>={create_circuit:'Create circuit from netlist',simulate:'Simulate schematic',generate_layout:'Generate physical layout',verify_layout:'Check and extract layout',simulate_extracted:'Simulate extracted layout'};
export function circuitFromTool(tool:ToolCall):Circuit{
 if(typeof tool.netlist!=='string'||!tool.netlist.trim()||tool.netlist.length>40000)throw new Error('Provide a declarative circuit netlist under 40 kB.');
 if(/^\s*\.(include|lib|control|endc)\b/im.test(tool.netlist))throw new Error('Circuit tools accept declarative devices and installed models, not external includes or control scripts.');
 const d=importSource('circuit.cir',tool.netlist).document;
 if(tool.name)d.name=tool.name.slice(0,100);
 // Render recognized literal MOS instances as editable MOS symbols. No topology inference.
 for(const c of d.components){if(c.kind!=='device'||!['sky130_fd_pr__nfet_01v8','sky130_fd_pr__pfet_01v8'].includes(c.device?.model||''))continue;
  const params=c.device!.parameters.split(/\s+/).slice(1);const sizes=Object.fromEntries(params.map(p=>p.toLowerCase().split('=')));
  if(params.length!==2||!sizes.w||!sizes.l)continue;
  try{c.w=spiceNumber(sizes.w);c.l=spiceNumber(sizes.l);}catch{continue;}
  c.kind=c.device!.model!.includes('__pfet_')?'pmos':'nmos';c.deviceModel=c.device!.model as typeof c.deviceModel;c.bulk=true;delete c.device;
 }
 validateCircuit(d);return d;
}
export function simulationPayload(d:Circuit){
 validateCircuit(d);const errors=checkCircuit(d).filter(i=>i.level==='error');if(errors.length)throw new Error(errors.map(i=>i.message).join(' '));
 const map=netMap(d),input=d.components.find(c=>c.kind==='voltage'&&c.id+'.p'===d.analysis.input),output=map.get(d.analysis.output);
 if(!input||!output||output==='0')throw new Error('Choose an input voltage source and an output terminal in Simulation setup.');
 const inputNode=map.get(d.analysis.input)!;const probes=[...new Set([inputNode,...d.components.filter(c=>c.kind==='voltage'&&(c.waveform||c.amplitude)).map(c=>map.get(c.id+'.p')!).filter(n=>n!=='0'&&n!==output)])].slice(0,4).filter(n=>n!==output);probes.push(output);
 return {netlist:spice(d),analysis:d.analysis,output,input:inputNode,source:spiceReference(input,d),probes,edgeInputs:d.components.filter(c=>c.kind==='voltage'&&/^(PWL|PULSE)\(/i.test(c.waveform||'')).map(c=>map.get(c.id+'.p')).filter(n=>probes.includes(n!))};
}
export function physicalDevices(d:Circuit){
 validateCircuit(d);const map=netMap(d),mos=d.components.filter(c=>c.kind==='nmos'||c.kind==='pmos'||c.kind==='device'&&['sky130_fd_pr__nfet_01v8','sky130_fd_pr__pfet_01v8'].includes(c.device?.model||''));
 if(!mos.length||mos.length>16)throw new Error('Physical generation supports 1–16 flat SKY130 MOS devices.');
 if(d.components.some(c=>!mos.includes(c)&&!['voltage','capacitor','ground'].includes(c.kind)))throw new Error('Physical generation currently supports flat MOS circuits with external voltage stimuli and load capacitors. Other device geometry needs an adapter.');
 return mos.map(c=>{const model=c.deviceModel||c.device?.model;if(!model||(!c.bulk&&!c.device))throw new Error('Use installed SKY130 1.8 V MOS models with explicit body terminals for physical generation.');const params=c.device?Object.fromEntries(c.device.parameters.split(/\s+/).slice(1).map(p=>p.toLowerCase().split('='))):null;
  if(params&&Object.keys(params).some(k=>!['w','l'].includes(k)))throw new Error('Physical generation needs literal W/L and no additional device parameters.');
  const w=params?spiceNumber(params.w):c.w,l=params?spiceNumber(params.l):c.l,kind=model.includes('__pfet_')?'pmos':'nmos';
  if(w<1||w>8||l<.15||l>1)throw new Error('Physical generator sizes are W=1–8 µm, L=0.15–1 µm.');
  if(kind==='nmos'&&map.get(c.id+'.b')!=='0')throw new Error('This physical generator requires grounded NMOS bodies.');
  return {id:c.id,ref:c.ref,kind,w,l,d:map.get(c.id+'.d'),g:map.get(c.id+'.g'),s:map.get(c.id+'.s'),b:map.get(c.id+'.b')};});
}
export function physicalCapability(d:Circuit){try{const devices=physicalDevices(d);return {supported:true,devices:devices.length,reason:''};}catch(e){return {supported:false,devices:0,reason:(e as Error).message};}}
export function normalizeTools(doc:Circuit,input:unknown):ToolCall[]{
 if(input===undefined)return [];if(!Array.isArray(input)||input.length>6)throw new Error('Choose up to six engineering tools.');
 let current=doc,hasLayout=!!doc.physical;const result:ToolCall[]=[];
 for(const raw of input){
  if(!raw||!toolNames.includes(raw.action))throw new Error('Each tool needs an action field with one of: '+toolNames.join(', ')+'. Received action: '+String(raw?.action).slice(0,60));
  const extra=Object.keys(raw).filter(k=>!['action','name','netlist','replaceExisting'].includes(k));
  if(extra.length)throw new Error('Tool '+raw.action+' has unsupported fields: '+extra.join(', ')+'. Use only action, and for create_circuit only, name/netlist/replaceExisting. Put explanations in the top-level message.');
  const tool:ToolCall={...raw};
  if(tool.action==='create_circuit'){
   if(result.length||current.components.length&&tool.replaceExisting!==true)throw new Error('Creating a circuit in a populated project requires an explicit replacement proposal, or start with a blank project.');
   current=circuitFromTool(tool);hasLayout=false;
  }else if(tool.action==='simulate')simulationPayload(current);
  else {physicalDevices(current);if(tool.action==='generate_layout')hasLayout=true;else if(!hasLayout)throw new Error('Generate a physical layout before checking or simulating it.');if(tool.action==='simulate_extracted')simulationPayload(current);}
  result.push(tool);
 }
 return result;
}
