import {component,starter,validateCircuit,netMap,spice,type Circuit,type Component,type Pin} from './circuit';
export type LogicKind='xor'|'inverter';
export const logicTitle=(kind:LogicKind)=>kind==='xor'?'12-transistor CMOS XOR':'CMOS inverter';
export function logicCircuit(kind:LogicKind='xor'):Circuit{
 const d=starter('blank');d.name=logicTitle(kind);d.nodeNames={};d.logicKind=kind;
 const nets=new Map<string,Pin[]>();
 const connect=(c:Component,pin:string,net:string)=>{const p={component:c.id,pin};nets.set(net,[...(nets.get(net)||[]),p]);d.nodeNames![c.id+'.'+pin]=net;};
 const add=(id:string,k:Component['kind'],x:number,y:number,fields:Partial<Component>,ports:Record<string,string>)=>{const c={...component(k,x,y),id,ref:id.toUpperCase(),...fields};d.components.push(c);for(const [p,n] of Object.entries(ports))connect(c,p,n);return c;};
 add('vdd','voltage',80,140,{dc:1.8},{p:'vdd',n:'0'});
 add('va','voltage',80,340,{dc:0,waveform:'PWL(0 0 20n 0 20.1n 1.8 40n 1.8 40.1n 0 60n 0 60.1n 1.8 100n 1.8 100.1n 0 120n 0 120.1n 1.8 140n 1.8 140.1n 0 160n 0)'},{p:'a',n:'0'});
 if(kind==='xor')add('vb','voltage',80,540,{dc:0,waveform:'PWL(0 0 80n 0 80.1n 1.8 160n 1.8)'},{p:'b',n:'0'});
 const mos=(id:string,k:'nmos'|'pmos',dr:string,g:string,s:string,w:number,x:number,y:number)=>add(id,k,x,y,{w,l:.15,bulk:true,deviceModel:k==='nmos'?'sky130_fd_pr__nfet_01v8':'sky130_fd_pr__pfet_01v8'},{d:dr,g,s,b:k==='pmos'?'vdd':'0'});
 mos('xan','nmos',kind==='xor'?'na':'out','a','0',1,320,430);mos('xap','pmos',kind==='xor'?'na':'out','a','vdd',2,320,170);
 if(kind==='xor'){
  mos('xbn','nmos','nb','b','0',1,570,430);mos('xbp','pmos','nb','b','vdd',2,570,170);
  mos('xn1','nmos','out','a','n1',2,820,430);mos('xn2','nmos','n1','b','0',2,820,650);
  mos('xn3','nmos','out','na','n2',2,1090,430);mos('xn4','nmos','n2','nb','0',2,1090,650);
  mos('xp1','pmos','p1','a','vdd',4,820,-50);mos('xp2','pmos','out','nb','p1',4,820,170);
  mos('xp3','pmos','p2','b','vdd',4,1090,-50);mos('xp4','pmos','out','na','p2',4,1090,170);
 }
 add('cl','capacitor',kind==='xor'?1360:600,300,{value:20e-15},{p:'out',n:'0'});add('gnd','ground',80,720,{}, {'0':'0'});
 for(const ps of nets.values())for(const p of ps.slice(1))d.wires.push({id:'wire_'+d.wires.length,from:ps[0],to:p});
 d.analysis={mode:'tran',start:0,stop:160e-9,points:100,input:'va.p',output:'cl.p'};validateCircuit(d);return d;
}
export function physicalDevices(d:Circuit){
 validateCircuit(d);const map=netMap(d),mos=d.components.filter(c=>c.kind==='nmos'||c.kind==='pmos');
 if(!mos.length||mos.length>24)throw new Error('Use a flat circuit with 1–24 MOS transistors for this layout flow.');
 if(d.components.some(c=>!['nmos','pmos','voltage','capacitor','ground'].includes(c.kind)))throw new Error('This physical flow supports MOS logic with external stimulus and load capacitors.');
 return mos.map(c=>{if(!c.deviceModel||!c.bulk)throw new Error('Physical extraction requires explicit-body SKY130 transistors.');return {id:c.id,ref:c.ref,kind:c.kind,w:c.w,l:c.l,d:map.get(c.id+'.d'),g:map.get(c.id+'.g'),s:map.get(c.id+'.s'),b:map.get(c.id+'.b')};});
}
export function logicPayload(d:Circuit){
 const devices=physicalDevices(d),map=netMap(d),input=d.components.find(c=>c.ref==='VA'),second=d.components.find(c=>c.ref==='VB');
 if(!input||map.get(input.id+'.p')!=='a'||(d.logicKind==='xor'&&(!second||map.get(second.id+'.p')!=='b')))throw new Error('The logic testbench requires named A and B input sources.');
 const kind=d.logicKind||'inverter',reference=logicCircuit(kind),supply=d.components.find(c=>c.ref==='VDD');
 if(!supply||supply.dc!==1.8||supply.waveform||map.get(supply.id+'.p')!=='vdd'||map.get(supply.id+'.n')!=='0'||d.analysis.mode!=='tran'||d.analysis.start!==0||Math.abs(d.analysis.stop-160e-9)>1e-18||map.get(d.analysis.output)!=='out')throw new Error('The logic comparison uses a fixed 1.8 V supply, 0–160 ns transient and OUT probe. Restore that testbench or create a new demo; transistor sizes and output load can be changed.');
 for(const ref of kind==='xor'?['VA','VB']:['VA']){const source=d.components.find(c=>c.ref===ref)!;if(source.waveform!==reference.components.find(c=>c.ref===ref)!.waveform||map.get(source.id+'.n')!=='0')throw new Error('Restore the demo input vectors before comparing the complete truth table. Transistor sizes and output load can be changed.');}
 return {devices,netlist:spice(d),analysis:d.analysis,output:map.get(d.analysis.output),input:'a',source:input.ref,kind:d.logicKind||'inverter',probes:d.logicKind==='xor'?['a','b','out']:['a','out']};
}
