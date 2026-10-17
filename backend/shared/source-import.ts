import {component,starter,uid,validateCircuit,type Circuit,type Pin} from './circuit';
import {spiceNumber} from './imports';
import {declarativeText,modelForLine,spiceIdentifier,validateDefinitions} from './spice-data';

export const ADAPTER_VERSION='source-project-2';
export interface SourceImport {document:Circuit;notes:string[]}
export function logicalLines(text:string){
 const result:string[]=[];
 for(const raw of text.replace(/\r/g,'').split('\n')){const line=raw.trim();if(!line||line.startsWith('*'))continue;if(line.startsWith('+')&&result.length)result[result.length-1]+=' '+line.slice(1).trim();else result.push(line);}
 return result;
}
export function dependencies(text:string){return logicalLines(text).flatMap(l=>{const m=l.match(/^\.(?:include|inc|lib)\s+(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+(\S+))?$/i);return m?[{line:l,path:m[1]||m[2]||m[3],section:m[4]}]:[];});}

/** Build an editable electrical graph, retaining model cards and hierarchy.
 * No component/model is invented and no publisher command is executed. */
export function importSource(name:string,text:string,options:{hasTitle?:boolean}={}):SourceImport{
 if(text.length>150000)throw new Error('This source exceeds the 150 kB circuit preparation limit.');
 if(/\.json$/i.test(name)){const raw=JSON.parse(text);if(raw.schema===1||raw.document?.schema===1){const document=raw.document||raw;validateCircuit(document);return {document,notes:['Opened the validated project document.']};}const deck=raw.testbench_spice||raw.spice_netlist||raw.netlist||raw.spice;if(typeof deck==='string')return importSource(name.replace(/\.json$/i,'.cir'),deck,{hasTitle:false});throw new Error('This JSON has no circuit document or SPICE netlist.');}
 if(!/\.(cir|sp|spice|spi|net|lib|model)$/i.test(name))throw new Error(`The ${name.split('.').at(-1)} source needs a native format adapter. Choose an associated SPICE netlist in the same repository to prepare its circuit.`);
 const document=starter('blank');document.name=name.replace(/\.[^.]+$/,'').slice(0,100);document.definitions=[];document.nodeNames={};document.preparationIssues=[];
 const notes=['Placed symbols from source connectivity. Original source text, model definitions and subcircuit hierarchy are retained.'],issue=(m:string)=>document.preparationIssues!.push(m.slice(0,1000));
 const rawFirst=text.split(/\r?\n/).find(l=>l.trim())?.trim()||'',hasTitle=options.hasTitle!==false&&!/^[*.]/.test(rawFirst);const lines=logicalLines(text),top:string[]=[],defs:string[]=[],subcircuits=new Map<string,string[]>();let control=false,depth=0,analysis='',probe='',dcSource='',first=true;
 for(const line of lines){
  if(first){first=false;if(hasTitle){document.name=line.slice(0,100);continue;}}
  if(/^\.control\b/i.test(line)){control=true;continue;}if(/^\.endc\b/i.test(line)){control=false;continue;}
  if(control){if(!analysis&&/^(ac\s+dec|tran\s|dc\s)/i.test(line))analysis='.'+line;if(!probe){const m=line.match(/^(?:print|plot|save)\s+(?:v|vdb|vm|db)\((\w+)\)/i);if(m)probe=m[1];}continue;}
  if(/^\.subckt\s/i.test(line)){if(depth)throw new Error('Nested subcircuit definitions require a source adapter.');const t=line.split(/\s+/),end=t.findIndex((s,i)=>i>1&&(/=/.test(s)||/^params:$/i.test(s)));subcircuits.set(t[1].toLowerCase(),t.slice(2,end<0?undefined:end));depth++;defs.push(line);continue;}
  if(/^\.ends\b/i.test(line)){if(!depth)throw new Error('A subcircuit end has no matching declaration.');depth--;defs.push(line);continue;}
  if(/^\.(?:include|inc|lib)\s/i.test(line)){if(!/\{\{SKY130_LIB\}\}.*\btt$/i.test(line))issue('A source dependency was not resolved: '+line);continue;}
  if(depth||/^\.(model|param|func|global)\s/i.test(line)){defs.push(line);continue;}
  if(/^\.(ac|tran|dc)\s/i.test(line)){if(!analysis)analysis=line;else notes.push('The first analysis is selected; other analyses remain in the attached source.');continue;}
  if(/^\.(?:print|plot|save|meas|measure)\s/i.test(line)){if(!probe){const m=line.match(/(?:v|vdb|vm)\((\w+)\)/i);if(m)probe=m[1];}continue;}
  if(/^\.end$/i.test(line))continue;
  if(line.startsWith('.')){issue('Review source directive before simulation: '+line);continue;}
  top.push(line);
 }
 if(depth||control)throw new Error('The source has an unclosed subcircuit or control block.');
 validateDefinitions(defs);document.definitions=defs;
 // A cell-only source is a usable hierarchical component, without fabricated bias.
 if(!top.length&&subcircuits.size){
  const referenced=new Set(defs.filter(l=>/^X/i.test(l)).map(l=>modelForLine(l)?.toLowerCase()));
  const roots=[...subcircuits].filter(([model])=>!referenced.has(model));
  if(roots.length!==1)throw new Error(roots.length?'This file contains multiple independent cells. Choose a testbench or source file identifying the desired top cell.':'This file has no unambiguous top cell. Choose a testbench that instantiates the desired cell.');
  const [model,ports]=roots[0];top.push(`X1 ${ports.join(' ')} ${model}`);notes.push('Opened the source cell with its named ports. Add supplies and a testbench to simulate it.');
 }
 const nets=new Map<string,Pin[]>(),addPin=(net:string,pin:Pin)=>{if(!spiceIdentifier.test(net))throw new Error('A source net name needs conversion: '+net);const n=/^gnd$/i.test(net)?'0':net.toLowerCase();nets.set(n,[...(nets.get(n)||[]),pin]);document.nodeNames![`${pin.component}.${pin.pin}`]=n;};
 const modelNames=new Set(defs.flatMap(l=>l.match(/^\.model\s+(\S+)/i)?.[1]?.toLowerCase()||[]));
 for(const line of top){
  if(!declarativeText.test(line))throw new Error('Unsupported source expression: '+line.split(/\s+/)[0]);
  const t=line.split(/\s+/),prefix=t[0][0].toUpperCase();let count=({R:2,C:2,L:2,D:2,Q:3,M:4,J:3,Z:3,E:4,G:4,F:2,H:2,V:2,I:2,B:2,S:4} as Record<string,number>)[prefix],terminalNames:string[]=[];
  if(prefix==='X'){const index=t.findIndex((s,i)=>i>0&&(/=/.test(s)||/^params:$/i.test(s)));count=(index<0?t.length:index)-2;const model=t[count+1]?.toLowerCase();terminalNames=subcircuits.get(model)||(/^sky130_fd_pr__(?:nfet|pfet)/.test(model)?['d','g','s','b']:/^sky130_fd_pr__npn|^sky130_fd_pr__pnp/.test(model)?['c','b','e','s']:[]);}
  if(prefix==='Q'&&t[5]&&!modelNames.has(t[4]?.toLowerCase())&&(modelNames.has(t[5].toLowerCase())||(/^[A-Za-z_][A-Za-z0-9_]*$/.test(t[5])&&!/^off$/i.test(t[5]))))count=4;
  if(!count||count<2||count>32||t.length<count+2)throw new Error('Unsupported or incomplete device '+t[0]+'. No partial circuit was substituted.');
  if(terminalNames.length&&terminalNames.length!==count)throw new Error(`${t[0]} has ${count} nodes but its subcircuit declares ${terminalNames.length} ports.`);
  if(!terminalNames.length)terminalNames=({M:['d','g','s','b'],Q:count===4?['c','b','e','s']:['c','b','e'],J:['d','g','s'],Z:['d','g','s'],E:['p','n','cp','cn'],G:['p','n','cp','cn'],S:['p','n','cp','cn']} as Record<string,string[]>)[prefix]||(count===2?['p','n']:Array.from({length:count},(_,i)=>'p'+(i+1)));
  let c=component('device',160+document.components.length%4*260,160+Math.floor(document.components.length/4)*220,document.components);c.ref=t[0];c.device={prefix,terminals:terminalNames,parameters:t.slice(count+1).join(' '),model:prefix==='Q'?t[count+1]:modelForLine(line)};
  // Familiar symbols remain familiar when all their editable values are literal.
  if(['R','C'].includes(prefix)&&t.length===4){try{c.kind=prefix==='R'?'resistor':'capacitor';c.value=spiceNumber(t[3]);delete c.device;}catch{c.kind='device';}}
  if(['V','I'].includes(prefix)){
   const spec=t.slice(3).join(' '),wave=spec.match(/\b(PULSE|PWL|SIN|EXP)\(([^()]*)\)/i),rest=spec.replace(wave?.[0]||'','').trim(),m=rest.match(/^(?:(?:DC\s+)?(\S+)\s*)?(?:AC\s+(\S+))?$/i);
   if(m){try{const dc=m[1]?spiceNumber(m[1]):wave?spiceNumber(wave[2].trim().split(/[\s,]+/)[wave[1].toUpperCase()==='PWL'?1:0]):0,ac=m[2]?spiceNumber(m[2]):0;c.kind=prefix==='V'?'voltage':'current';c.dc=dc;c.ac=ac;c.waveform=wave?.[0];delete c.device;}catch{c.kind='device';}}
  }
  if(c.kind==='device'&&!c.device)c.device={prefix,terminals:terminalNames,parameters:t.slice(count+1).join(' '),model:prefix==='Q'?t[count+1]:modelForLine(line)};
  if(c.device&&/\b[vi]\(/i.test(c.device.parameters))issue(`${c.ref}: behavioral node/current expressions need validation after rewiring; simulation is unavailable for this expression.`);
  document.components.push(c);for(let i=0;i<count;i++)addPin(t[i+1],{component:c.id,pin:terminalNames[i]});
 }
 if(!document.components.length)throw new Error('This source contains model data but no circuit or cell. Attach it to an existing project using Sources.');
 if(nets.has('0')){const g=component('ground',160,160+Math.ceil(document.components.length/4)*220,document.components);document.components.push(g);addPin('0',{component:g.id,pin:'0'});}
 for(const ps of nets.values())for(const p of ps.slice(1))document.wires.push({id:uid('w'),from:ps[0],to:p});
 if(analysis){const t=analysis.split(/\s+/);try{
  if(/^\.ac$/i.test(t[0])&&t.length===5&&/^dec$/i.test(t[1]))document.analysis={...document.analysis,mode:'ac',points:Math.max(10,Math.min(200,spiceNumber(t[2]))),start:spiceNumber(t[3]),stop:spiceNumber(t[4])};
  else if(/^\.tran$/i.test(t[0])&&t.length===3){document.analysis={...document.analysis,mode:'tran',start:0,stop:spiceNumber(t[2]),points:100};notes.push('Transient duration retained; output sampling is bounded by the simulator.');}
  else if(/^\.dc$/i.test(t[0])&&t.length===5){dcSource=t[1];document.analysis={...document.analysis,mode:'dc',start:spiceNumber(t[2]),stop:spiceNumber(t[3]),points:100};}
  else issue('Review source analysis before simulation: '+analysis);
 }catch{issue('An analysis parameter requires evaluation: '+analysis);}}
 else notes.push('No source sweep was provided. Select an analysis in Properties before running.');
 const input=document.components.find(c=>c.kind==='voltage'&&c.ref.toLowerCase()===dcSource.toLowerCase())||document.components.find(c=>c.kind==='voltage'&&/^v(in|sig)$/i.test(c.ref))||document.components.find(c=>c.kind==='voltage'&&(c.ac>0||c.waveform))||document.components.find(c=>c.kind==='voltage');
 document.analysis.input=input?input.id+'.p':'';
 const output=nets.get(probe.toLowerCase())||nets.get('out')||nets.get('vout');document.analysis.output=output?.[0]?`${output[0].component}.${output[0].pin}`:'';
 if(!output)notes.push('No unambiguous output probe was supplied. Choose an output terminal in Properties.');
 notes.push('Publisher control commands and reported metrics remain source text; only declarative circuit data runs.');
 document.preparationIssues=[...new Set(document.preparationIssues)];validateCircuit(document);return {document,notes};
}
