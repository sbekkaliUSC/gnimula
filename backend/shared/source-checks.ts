import {type Circuit} from './circuit';

/** A narrow, deterministic sanity check; it does not classify or repair circuits. */
export function sourceSetupWarnings(topology:unknown,document:Circuit):string[]{
 const label=typeof topology==='string'?topology.slice(0,120):'';
 const mos=document.components.filter(c=>c.kind==='nmos'||c.kind==='pmos'||c.device?.prefix==='M'||/^sky130_fd_pr__(nfet|pfet)/.test(c.device?.model||'')).length;
 return /mirror/i.test(label)&&mos<2
  ?[`Publisher topology is "${label}", but the prepared testbench contains ${mos} MOS ${mos===1?'device':'devices'}. A conventional MOS current mirror requires at least two transistors. The source label is preserved; its topology is not verified or repaired.`]
  :[];
}
