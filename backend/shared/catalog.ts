/** Public provider locators, never executable client-supplied circuit text. */
export interface CatalogSelection {
 provider:'github'|'huggingface'; repo:string; ref?:string; path?:string;
 config?:string; split?:string; row?:number; fingerprint?:string;
}
export interface CatalogItem {
 id:string; name:string; description:string; kind:string; pdk:string;
 provider:'github'|'huggingface'; sourceUrl:string;
 availability:'ready'|'prepare'|'reference'|'browse'; reason?:string;
 selection:CatalogSelection; metadata:Record<string,unknown>;
}
export interface CatalogResult {
 items:CatalogItem[]; scope:'records'|'files'|'sources'; total:number|null;
 totalLabel:string; offset:number; nextOffset:number|null; warnings:string[];
 source:{provider:'github'|'huggingface';repo:string;ref?:string;config?:string;split?:string;url:string};
 splits?:{config:string;split:string;numRows?:number}[];
 /** One selected config only; alternate config encodings must not be summed. */
 configTotal?:number; fetchedAt:string;
}
export const publicCatalogs=[
 {provider:'huggingface',repo:'pphilip/analog-circuits-sky130',name:'SKY130 analog circuits',config:'with_testbench',split:'train'},
 {provider:'huggingface',repo:'Si7li/ltspice-spice-circuits-no-aug',name:'LTspice circuit records',config:'default',split:'train'},
 {provider:'huggingface',repo:'touhid314/cktformer-dataset',name:'CircuitFormer records'},
 {provider:'github',repo:'ngspice/ngspice',name:'Official ngspice examples',ref:'master'},
 {provider:'github',repo:'StefanSchippers/xschem',name:'Xschem examples',ref:'master'}
] as const;
