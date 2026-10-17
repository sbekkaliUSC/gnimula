import {formatValue,type Circuit,type Component} from './circuit';

/** Deterministic context, not an AI interpretation of a graph or source metric. */
export function analysisContext(doc:Circuit){
 const names=new Map(doc.components.map(c=>[c.id,c.ref]));
 const terminal=(id:string)=>{const [component,pin]=id.split('.');return {id,label:names.has(component)?`${names.get(component)}.${pin}`:id};};
 const a=doc.analysis;
 return {mode:a.mode,start:a.start,stop:a.stop,pointsSetting:a.points,
  pointsMeaning:a.mode==='ac'?'points per decade, not the total number of samples':a.mode==='dc'?'requested sweep intervals; endpoints add a sample':'not used by the current transient solver; its requested step is stop/600',
  sweepUnits:a.mode==='ac'?'Hz':a.mode==='dc'?'V':'s',input:terminal(a.input),output:terminal(a.output)};
}
export function parameterDisplay(value:number,unit:string){
 const displayUnit=unit==='ohm'?'Ω':unit;
 return {value,unit,display:unit==='µm'?`${value} µm`:formatValue(value,displayUnit),
  siValue:unit==='µm'?value*1e-6:value,siUnit:unit==='µm'?'m':displayUnit,
  ...(unit==='F'?{farads:value,picofarads:Number((value/1e-12).toPrecision(12))}: {})};
}
export function componentReferenceMap(doc:Circuit){return Object.fromEntries(doc.components.map(c=>[c.id,{ref:c.ref,kind:c.kind,displayValues:Object.fromEntries(fields(c).map(([key,unit])=>[key,parameterDisplay(c[key] as number,unit)]))}]));}

function fields(c:Component):[keyof Component,string][]{
 if(c.kind==='resistor')return [['value','ohm']];if(c.kind==='capacitor')return [['value','F']];
 if(c.kind==='nmos'||c.kind==='pmos')return [['w','µm'],['l','µm']];
 if(c.kind==='voltage')return [['dc','V'],['ac','V'],['amplitude','V'],['frequency','Hz']];
 if(c.kind==='current')return [['dc','A']];return [];
}
export function parameterChanges(previous:Circuit,current:Circuit){
 const old=new Map(previous.components.map(c=>[c.id,c]));
 const changes=[];
 for(const component of current.components){const before=old.get(component.id);if(!before||before.kind!==component.kind)continue;
  for(const [parameter,unit] of fields(component)){
   const from=before[parameter],to=component[parameter];if(typeof from!=='number'||typeof to!=='number'||from===to)continue;
   changes.push({id:component.id,ref:component.ref,parameter,unit,from,to,fromDisplay:parameterDisplay(from,unit),toDisplay:parameterDisplay(to,unit),ratio:from===0?null:Number((to/from).toPrecision(10)),percentChange:from===0?null:Number((100*(to-from)/Math.abs(from)).toPrecision(10))});
  }
 }
 return {fromRevision:previous.revision,toRevision:current.revision,changes:changes.slice(0,50),omittedChanges:Math.max(0,changes.length-50)};
}

export function simulationContext(value:unknown,current:Circuit,recorded?:Circuit){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const run=value as Record<string,unknown>,revision=Number.isSafeInteger(run.revision)?Number(run.revision):null;
 const currentRevision=revision===current.revision,atRun=currentRevision?current:recorded?.revision===revision?recorded:undefined;
 const raw=Array.isArray(run.rows)?run.rows:[],rows=raw.filter((r):r is number[]=>Array.isArray(r)&&r.length>=2&&r.every(x=>typeof x==='number'&&Number.isFinite(x)));
 const take=Math.min(12,rows.length),indices=Array.from({length:take},(_,i)=>take===1?0:Math.round(i*(rows.length-1)/(take-1)));
 const sample=indices.map(i=>rows[i]);
 const axis=rows.map(r=>r[0]),output=rows.map(r=>r[1]);
 let range=null,gainDb=null,outputVoltageV=null;
 if(rows.length){
  const extrema=(values:number[])=>({first:values[0],last:values.at(-1)!,min:Math.min(...values),max:Math.max(...values)});
  range={...extrema(axis),unit:run.mode==='ac'?'Hz':run.mode==='dc'?'V':run.mode==='tran'?'s':'unknown'};
  const values=extrema(output);
  if(run.mode==='ac')gainDb={...values,firstFrequencyHz:axis[0],lastFrequencyHz:axis.at(-1),minimumAtHz:axis[output.indexOf(values.min)],maximumAtHz:axis[output.indexOf(values.max)]};
  else if(run.mode==='dc'||run.mode==='tran')outputVoltageV=values;
 }
 return {revision,currentRevision:current.revision,matchesCurrentRevision:currentRevision,
  status:revision===null?'unknown revision':currentRevision?'current saved design':'stale: design has changed since this run',
  mode:run.mode,model:run.model,operatingOutput:run.operatingOutput,labels:run.labels,
  analysisAtRun:atRun?analysisContext(atRun):null,
  totalSamples:raw.length,validSamples:rows.length,sampleCountMeaning:'Number of stored response points, not points per decade. The simulator may downsample large output tables before storage.',
  sampledRows:sample,sampledRowsCount:sample.length,sampledRowsMeaning:'Bounded excerpt including the first and last stored samples; use summaries for full-range extrema.',
  sweep:range,gainDb,outputVoltageV,
  changesSinceRun:atRun&&!currentRevision?parameterChanges(atRun,current):null,
  interpretation:'Measurements apply only to the recorded circuit revision and testbench. Endpoint or peak gain is not constant gain over the sweep. Proposed changes need a fresh simulation.'};
}
