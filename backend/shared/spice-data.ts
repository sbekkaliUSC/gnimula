/** Declarative SPICE only. Commands, files and publisher control scripts never
 * enter the executable deck. The simulator repeats this validation independently. */
export const spiceIdentifier=/^[A-Za-z0-9_]{1,80}$/;
export const declarativeText=/^[A-Za-z0-9_ .,+\-=(){}*/:^<>!?&|%\[\]]+$/;
export interface DeviceSpec {prefix:string;terminals:string[];parameters:string;model?:string}
export function validateDevice(device:DeviceSpec){
 if(!device||typeof device.prefix!=='string'||!/^([RCLDQMXJZEGFHVBIS])$/.test(device.prefix)||!Array.isArray(device.terminals)||device.terminals.length<2||device.terminals.length>32||new Set(device.terminals).size!==device.terminals.length||device.terminals.some(p=>typeof p!=='string'||!spiceIdentifier.test(p))||typeof device.parameters!=='string'||device.parameters.length>2000||!declarativeText.test(device.parameters)||device.model!==undefined&&(typeof device.model!=='string'||!spiceIdentifier.test(device.model)))throw new Error('Invalid declarative device or terminals.');
}
export function validateDefinitions(lines:string[]){
 if(!Array.isArray(lines)||lines.length>1000||lines.join('\n').length>100000)throw new Error('Model definitions are too large.');
 let depth=0;
 for(const line of lines){
  if(typeof line!=='string'||line.length>8000||!declarativeText.test(line))throw new Error('Invalid model definition.');
  if(/^\.subckt\s+[A-Za-z0-9_]+\s/i.test(line)){if(depth)throw new Error('Nested subcircuit declarations need flattening before simulation.');depth++;}
  else if(/^\.ends(?:\s+[A-Za-z0-9_]+)?$/i.test(line)){if(!depth--)throw new Error('Unmatched subcircuit end.');}
  else if(/^\.(model|param|func|global)\s/i.test(line)){}
  else if(depth&&/^[RCLDQMXJZEGFHVBIS][A-Za-z0-9_]*\s/i.test(line)){}
  else throw new Error('Only model, parameter and subcircuit data may be included.');
 }
 if(depth)throw new Error('Unclosed subcircuit definition.');
}
export function knownModels(definitions:string[]=[]){return new Set(['gn','gp','sky130_fd_pr__nfet_01v8','sky130_fd_pr__pfet_01v8','sky130_fd_pr__npn_05v5_w1p00l1p00','sky130_fd_pr__npn_05v5_w1p00l2p00','sky130_fd_pr__npn_11v0_w1p00l1p00','sky130_fd_pr__pnp_05v5_w3p40l3p40','sky130_fd_pr__pnp_05v5_w0p68l0p68',...definitions.flatMap(l=>l.match(/^\.(?:model|subckt)\s+(\S+)/i)?.[1]?.toLowerCase()||[])]);}
export function modelForLine(line:string):string|undefined{
 const t=line.trim().split(/\s+/),prefix=t[0]?.[0]?.toUpperCase();
 if(prefix==='Q'&&t[5]&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(t[5])&&!/^off$/i.test(t[5]))return t[5];
 if(prefix==='X'){const end=t.findIndex((v,i)=>i>0&&(/=/.test(v)||/^params:$/i.test(v)));return t[(end<0?t.length:end)-1];}
 return t[({M:5,Q:4,D:3,J:4,Z:4,S:5} as Record<string,number>)[prefix]];
}
