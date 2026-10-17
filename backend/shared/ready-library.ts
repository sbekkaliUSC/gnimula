import {importDesign,rcExample} from './imports';
import {starter,checkCircuit,netMap,uid,validateCircuit,type Circuit} from './circuit';

export interface ReadyItem {id:string;name:string;description:string;kind:'circuit'|'testbench'|'stimulus'|'layout';pdk:string;provider:string;goal:string;sourceUrl?:string;license?:string;details?:string[]}
export interface PreparedCircuit {item:ReadyItem;document:Circuit;notes:string[];reference:{name:string;content:string;url:string;provider:string;metadata:Record<string,unknown>}}
export const readyItems:ReadyItem[]=[
 {id:'rc',name:'RC low-pass filter',description:'A wired filter with a 15.9 kHz corner. Open it and measure the frequency response.',kind:'circuit',pdk:'generic',provider:'Gnimula',goal:'Explore this low-pass filter. Compare the measured corner frequency with 1/(2πRC).'},
 {id:'amplifier',name:'Common-source amplifier',description:'A biased NMOS gain stage with a supply, signal source, load and AC testbench.',kind:'circuit',pdk:'generic',provider:'Gnimula',goal:'Improve amplifier gain while preserving its topology and checking bias with simulation.'},
 {id:'mirror',name:'NMOS current mirror',description:'A matched transistor pair, reference resistor and loaded output, ready for a supply sweep.',kind:'circuit',pdk:'generic',provider:'Gnimula',goal:'Explore current-mirror behavior by tuning device ratios and the output load.'},
 {id:'highpass',name:'RC high-pass filter',description:'A 15.9 kHz high-pass filter with its signal source and output probe connected.',kind:'circuit',pdk:'generic',provider:'Gnimula',goal:'Explore how the RC high-pass corner changes when R or C changes.'},
 {id:'sky130-amplifier',name:'SKY130 amplifier',description:'A 1.8 V NMOS stage using the installed open SKY130 typical transistor model.',kind:'circuit',pdk:'sky130',provider:'Gnimula',goal:'Tune this SKY130 1.8 V amplifier using real typical-corner transistor models; preserve body connections.'},
 {id:'ac',name:'Frequency response',description:'Connect the existing signal source and output probe to an AC sweep. Other sources remain DC.',kind:'testbench',pdk:'any',provider:'Gnimula',goal:'Measure gain and bandwidth.'},
 {id:'dc',name:'DC transfer curve',description:'Sweep the existing input source around its bias to inspect the output transfer curve.',kind:'testbench',pdk:'any',provider:'Gnimula',goal:'Inspect the DC operating region.'},
 {id:'sine',name:'10 kHz input signal',description:'Drive the existing input with a 10 mV sine wave and prepare a transient simulation.',kind:'stimulus',pdk:'any',provider:'Gnimula',goal:'Inspect the time-domain output without changing the circuit topology.'},
 {id:'contact',name:'Active-to-metal contact',description:'Place an editable contact stack in the concept layout: active, contact and metal1.',kind:'layout',pdk:'generic',provider:'Gnimula',goal:'Explore layer connectivity in the concept layout.',details:['Concept layout in arbitrary grid units, not foundry-verified geometry.']},
 {id:'via',name:'Metal1-to-metal2 via',description:'Place an editable interconnect stack in the concept layout.',kind:'layout',pdk:'generic',provider:'Gnimula',goal:'Explore a connection between the two metal layers.',details:['Concept layout in arbitrary grid units, not foundry-verified geometry.']}
];
const skyAmplifier='SKY130 common-source amplifier\nVDD vdd 0 DC 1.8\nVIN in 0 DC 0.8 AC 1\nR1 vdd out 10k\nXM1 out in 0 0 sky130_fd_pr__nfet_01v8 W=4 L=0.5\nC1 out 0 10p\n.ac dec 40 10 100meg\n.print ac v(out)\n.end';
export function builtinCircuit(id:string):PreparedCircuit {
 const item=readyItems.find(x=>x.id===id&&x.kind==='circuit');if(!item)throw new Error('Circuit not found.');
 let content='',document:Circuit,notes:string[]=[];
 if(id==='amplifier'||id==='mirror'){document=starter(id);document.shapes=[];content=JSON.stringify(document,null,2);}
 else {content=id==='rc'?rcExample:id==='highpass'?'RC high-pass filter\nVIN in 0 DC 0 AC 1\nC1 in out 10n\nR1 out 0 1k\n.ac dec 40 10 1meg\n.print ac v(out)\n.end':skyAmplifier;const imported=importDesign(id+'.cir',content,{sky130:id==='sky130-amplifier'});document=imported.document;notes=imported.notes;}
 document.name=item.name;assertReady(document);
 return {item,document,notes,reference:{name:id+(id==='amplifier'||id==='mirror'?'.json':'.cir'),content,url:'',provider:'example',metadata:{pdk:item.pdk,license:'Gnimula example',kind:'runnable circuit',preparation:notes}}};
}
export function assertReady(doc:Circuit){validateCircuit(doc);const errors=checkCircuit(doc).filter(x=>x.level==='error');if(errors.length)throw new Error(errors.map(x=>x.message).join(' '));const input=doc.components.find(c=>c.id+'.p'===doc.analysis.input&&c.kind==='voltage');if(!input)throw new Error('No supported input voltage source.');const n=netMap(doc);if(n.get(doc.analysis.input)==='0'||n.get(doc.analysis.output)==='0')throw new Error('A signal probe is grounded.');}

/** Normalize the publisher's actual testbench; never blend conflicting graph values.
 * Only a bounded, recognized flat circuit and AC sweep become executable. Publisher
 * control scripts, measurements and reported metrics stay in the source record.
 */
export function prepareSky130Record(row:Record<string,unknown>,offset:number):PreparedCircuit {
 if(typeof row.testbench_spice!=='string'||row.testbench_spice.length>120000||row.pdk!=='sky130')throw new Error('This record has no supported SKY130 testbench.');
 const lines=row.testbench_spice.replace(/\r/g,'').split('\n'),circuit:string[]=['Public SKY130 circuit'];let controls=false,ended=false,ac='',output='';
 for(const raw of lines){const l=raw.trim();if(!l||l.startsWith('*'))continue;
  if(/^\.control$/i.test(l)){if(controls||ended)throw new Error('Multiple control blocks are not supported.');controls=true;continue;}
  if(/^\.endc$/i.test(l)){controls=false;ended=true;continue;}
  if(controls){if(!ac&&/^ac dec \d+ \S+ \S+$/i.test(l))ac='.'+l;if(!output){const match=l.match(/^print\s+v\(([a-z0-9_]+)\)$/i);if(match)output=match[1];}continue;}
  if(/^\.lib\s+"\{\{SKY130_LIB\}\}"\s+tt$/i.test(l))continue;
  if(/^\.end$/i.test(l))continue;
  if(l.startsWith('.'))throw new Error('This record needs an additional model or testbench adapter.');
  circuit.push(l);
 }
 if(controls||!ac||!output){
  const transient=!controls&&!ac&&lines.some(line=>/^\s*tran\s/i.test(line));
  throw new Error(transient?'This source uses a transient testbench. The SKY130 importer currently prepares AC sweeps; additional device or waveform support may also be needed.':'No supported complete AC testbench found.');
 }
 const source=circuit.find(x=>/^V(?:SIG|IN)\s/i.test(x))?.split(/\s+/)[0];if(!source)throw new Error('Signal source is ambiguous.');
 const normalized=circuit.concat(ac,`.print ac v(${output})`,'.end').join('\n');
 const imported=importDesign('public-sky130.cir',normalized,{sky130:true}),doc=imported.document;
 const input=doc.components.find(x=>x.ref===source)!;doc.analysis.input=input.id+'.p';
 // Supply AC excitation in the original data mixes supply response with gain.
 // Make the prepared testbench a single-input gain measurement, recording the change.
 const acChanged=doc.components.filter(c=>c.kind==='voltage'&&c.id!==input.id&&c.ac!==0);for(const c of acChanged)c.ac=0;
 input.ac=1;
 const circuitId=String(row.circuit_id||`record-${offset}`).slice(0,80);doc.name=circuitId;
 const notes=[...imported.notes,'Device values and all four MOS terminals come from the supplied testbench, not its separate graph or reported metrics.','Prepared a single-input AC gain testbench. Publisher noise, PSRR and temperature scripts are retained as source text, not executed.',...(acChanged.length?[`Disabled AC excitation on ${acChanged.map(c=>c.ref).join(', ')} to isolate signal gain.`]:[])];
 assertReady(doc);
 const url='https://huggingface.co/datasets/pphilip/analog-circuits-sky130';
 const item:ReadyItem={id:`sky130-row-${offset}`,name:circuitId,description:String(row.topology||'Analog circuit').replaceAll('_',' ')+` · ${doc.components.filter(c=>c.kind!=='ground').length} components · prepared AC testbench`,kind:'circuit',pdk:'sky130',provider:'Hugging Face',goal:'Explore and improve this public SKY130 circuit. Use the prepared testbench as the source of truth; verify behavior with fresh simulation.',sourceUrl:url,license:'Apache-2.0 (dataset card; source attribution retained)',details:notes};
 return {item,document:doc,notes,reference:{name:circuitId+'.json',content:JSON.stringify({circuit_id:row.circuit_id,testbench_spice:row.testbench_spice,...row},null,2),url,provider:'huggingface',metadata:{repo:'pphilip/analog-circuits-sky130',config:'with_testbench',split:'train',row:offset,pdk:'sky130',kind:'prepared circuit',license:item.license,preparation:notes}}};
}

export function applyLibraryTool(original:Circuit,id:string):{document:Circuit;view:string;message:string}{
 const doc=structuredClone(original),item=readyItems.find(x=>x.id===id&&x.kind!=='circuit');if(!item)throw new Error('Circuit tool not found.');
 if(item.kind==='layout'){
  const x=doc.shapes.length?Math.max(...doc.shapes.map(s=>s.x+s.width))+40:200,y=200;
  const stack=id==='via'?[{layer:'metal1',x,y,width:160,height:40},{layer:'via1',x:x+60,y:y+10,width:20,height:20},{layer:'metal2',x:x+50,y:y-60,width:40,height:160}]:[{layer:'active',x,y,width:140,height:100},{layer:'contact',x:x+60,y:y+40,width:20,height:20},{layer:'metal1',x:x+50,y:y+30,width:40,height:120}];
  doc.shapes.push(...stack.map(s=>({...s,id:uid('s'),net:''}) as Circuit['shapes'][number]));validateCircuit(doc);return {document:doc,view:'layout',message:`Placed ${item.name.toLowerCase()}. Undo restores the previous layout.`};
 }
 assertReady(doc);const input=doc.components.find(c=>c.id+'.p'===doc.analysis.input)!;
 if(id==='ac'){for(const c of doc.components)if(c.kind==='voltage')c.ac=c.id===input.id?1:0;doc.analysis={...doc.analysis,mode:'ac',start:10,stop:1e8,points:40};}
 if(id==='dc'){const bias=input.dc;doc.analysis={...doc.analysis,mode:'dc',start:Math.max(0,bias-0.5),stop:Math.min(20,Math.max(0,bias)+0.5),points:100};}
 if(id==='sine'){input.frequency=10000;input.amplitude=.01;doc.analysis={...doc.analysis,mode:'tran',start:0,stop:.001,points:100};}
 validateCircuit(doc);return {document:doc,view:'simulation',message:`${item.name} is ready on ${input.ref}. Run the simulation to measure it. Undo restores the previous setup.`};
}

/** Prepare recognized flat SPICE with declarative sweeps; never execute source scripts. */
export function preparePublicSpice(name:string,text:string):{document:Circuit;notes:string[]} {
 const lines=text.replace(/\r/g,'').split('\n'),out:string[]=['Public circuit'],notes:string[]=[];let inControl=false,probe='',first=true;
 for(const raw of lines){let line=raw.trim();if(!line||line.startsWith('*'))continue;
  if(first){first=false;if(!line.startsWith('.')){notes.push('Original title retained in the attached source.');continue;}}
  if(/^\.control$/i.test(line)){inControl=true;continue;}if(/^\.endc$/i.test(line)){inControl=false;continue;}
  if(inControl){if(!probe){const p=line.match(/^plot\s+(?:v|vdb|db)\(([a-z0-9_]+)\)/i);if(p)probe=p[1];}continue;}
  if(/^\.meas(?:ure)?\s/i.test(line)){notes.push('Publisher measurements are retained as source text; Gnimula measures the chosen output.');if(!probe){const p=line.match(/(?:v|vdb|vr|vi|vm|vp)\(([a-z0-9_]+)\)/i);if(p)probe=p[1];}continue;}
  if(/^\.global\s/i.test(line)){if(!/^\.global\s+(?:gnd|vdd)(?:\s+(?:gnd|vdd))*$/i.test(line))throw new Error('This global-net declaration needs an adapter.');notes.push('Flat global nets preserved; SPICE ground name gnd mapped to 0.');continue;}
  // ngspice treats gnd as the ground node. Replace complete node tokens only.
  line=line.replace(/\bgnd\b/gi,'0');out.push(line);
 }
 if(inControl)throw new Error('Unclosed source control block.');
 if(probe)out.push('.print ac v('+probe+')');
 const imported=importDesign(name,out.join('\n'));assertReady(imported.document);return {document:imported.document,notes:[...new Set([...notes,...imported.notes,'Source control scripts are not executed.'])]};
}
