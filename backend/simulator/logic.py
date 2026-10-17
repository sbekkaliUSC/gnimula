"""SKY130 schematic -> physical geometry -> Magic extraction -> ngspice.
Only validated rectangles and bounded numeric device records reach Magic.
"""
import collections, hashlib, json, math, os, re, resource, subprocess, tempfile
from pathlib import Path

LAYERS={'nwell','ndiff','pdiff','poly','li','mcon','metal1','metal2','via1','ndcontact','pdcontact','polycont','psubdiff','nsubdiff','psubdiffcont','nsubdiffcont'}
NODE=re.compile(r'^[a-zA-Z][a-zA-Z0-9_]{0,60}$|^0$')
TECH=Path(__file__).parent/'technology'/'sky130A.tech'

def validate_devices(devices):
    if not isinstance(devices,list) or not 1<=len(devices)<=24: raise ValueError('Physical layout supports 1–24 flat MOS devices.')
    for d in devices:
        if d.get('kind') not in ('nmos','pmos') or any(not NODE.fullmatch(str(d.get(k,''))) for k in ('d','g','s','b')): raise ValueError('Invalid MOS terminals.')
        if any(not isinstance(d.get(k),(float,int)) or not math.isfinite(d[k]) for k in ('w','l')) or not 1<=d['w']<=8 or not .15<=d['l']<=1: raise ValueError('Layout device sizes must be W=1–8 µm and L=0.15–1 µm.')
        if d['b']!=('vdd' if d['kind']=='pmos' else '0'): raise ValueError('The physical generator requires NMOS bodies at ground and PMOS bodies at VDD.')
    return devices

def generate_layout(devices):
    validate_devices(devices)
    # Each terminal gets a distinct vertical metal1 corridor. Horizontal metal2
    # tracks connect like-named nets. Transistors are formed by poly crossing active.
    devices=sorted(devices,key=lambda d:d['kind']);shapes=[];labels=[];terminals=[]
    def rect(layer,x,y,w,h,net=''):
        shapes.append(dict(id='phy_'+str(len(shapes)),layer=layer,x=round(x),y=round(y),width=round(w),height=round(h),net=net))
    nets=sorted({d[k] for d in devices for k in ('d','g','s','b')})
    track={n:80+i*70 for i,n in enumerate(nets)}
    base=max(track.values())+300
    for i,d in enumerate(devices):
        x=80+i*500;w=round(d['w']*100);length=round(d['l']*100);gx=x+60;right=gx+length+40;tapx=right+120
        if d['kind']=='pmos':rect('nwell',x-50,base-60,tapx-x+110,w+120)
        rect('pdiff' if d['kind']=='pmos' else 'ndiff',x,base,length+120,w)
        rect('poly',gx,base-100,length,w+125,d['g'])
        for px,py,layer,net in [(x+20,base+w//2,'pdcontact' if d['kind']=='pmos' else 'ndcontact',d['s']),
                               (right,base+w//2,'pdcontact' if d['kind']=='pmos' else 'ndcontact',d['d']),
                               (gx+length//2,base-80,'polycont',d['g']),
                               (tapx,base+w//2,'nsubdiffcont' if d['kind']=='pmos' else 'psubdiffcont',d['b'])]:
            if layer=='polycont':rect('poly',px-20,py-20,40,40,net)
            if layer.endswith('subdiffcont'):rect('nsubdiff' if d['kind']=='pmos' else 'psubdiff',px-25,py-25,50,50,net)
            rect(layer,px-10,py-10,20,20,net);rect('li',px-20,py-20,40,40,net);rect('mcon',px-10,py-10,20,20,net)
            rect('metal1',px-16,track[net]-20,32,py-track[net]+40,net)
            rect('via1',px-13,track[net]-13,26,26,net)
            terminals.append((net,px))
    for net,y in track.items():
        xs=[x for n,x in terminals if n==net];lo=min(xs)-20;hi=max(xs)+20
        rect('metal2',lo,y-20,hi-lo,40,net);labels.append(dict(net=net,x=lo+5,y=y,layer='metal2'))
    return dict(process='sky130A',units='10 nm per grid unit',gridUm=.01,shapes=shapes,labels=labels,generator='mos-corridors-v1')

def extraction_limits():
    resource.setrlimit(resource.RLIMIT_CPU,(20,20))
    resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024*1024,12*1024*1024))
    resource.setrlimit(resource.RLIMIT_NOFILE,(512,512))

def extract(layout,devices):
    validate_devices(devices)
    shapes=layout.get('shapes',[]);labels=layout.get('labels',[])
    if not 1<=len(shapes)<=1500 or len(labels)>100:raise ValueError('Physical layout is too large.')
    lines=['drc off','load logic']
    for s in shapes:
        if s.get('layer') not in LAYERS or any(not isinstance(s.get(k),(float,int)) or not math.isfinite(s[k]) or abs(s[k])>20000 for k in ('x','y','width','height')) or min(s['width'],s['height'])<1:raise ValueError('Invalid physical rectangle.')
        x,y,w,h=[round(s[k]) for k in ('x','y','width','height')]
        lines.extend([f'box values {x} {y} {x+w} {y+h}',f'paint {s["layer"]}'])
    for label in labels:
        if not NODE.fullmatch(str(label.get('net',''))) or label.get('layer')!='metal2' or any(not isinstance(label.get(k),(float,int)) or not math.isfinite(label[k]) or abs(label[k])>20000 for k in ('x','y')):raise ValueError('Invalid physical label.')
        x,y=round(label['x']),round(label['y']);lines.extend([f'box values {x} {y} {x+1} {y+1}',f'label {label["net"]} center metal2'])
    lines+=['save logic','extract all','ext2spice lvs','ext2spice cthresh 0','ext2spice extresist off','ext2spice -o extracted.spice','select top cell','drc on','drc check','drc catchup','puts "GNIMULA_DRC_COUNT [drc list count total]"','puts "GNIMULA_DRC_WHY [drc listall why]"','gds write logic.gds','quit -noprompt']
    with tempfile.TemporaryDirectory(prefix='gnimula-layout-') as tmp:
        folder=Path(tmp);(folder/'.magicrc').write_text('')
        tech=Path(os.environ.get('GNIMULA_MAGIC_TECH',str(TECH)))
        result=subprocess.run([os.environ.get('GNIMULA_MAGIC','magic'),'-dnull','-noconsole','-rcfile',str(folder/'.magicrc'),'-T',str(tech)],input='\n'.join(lines)+'\n',capture_output=True,text=True,cwd=tmp,timeout=30,preexec_fn=extraction_limits,env={**os.environ,'HOME':tmp})
        log=result.stdout+'\n'+result.stderr
        if not (folder/'extracted.spice').exists():raise ValueError('Layout extraction failed: '+log[-1600:])
        spice=(folder/'extracted.spice').read_text();flat=[];actual=[];caps=[]
        for line in spice.splitlines():
            if not line or line.startswith(('*','.')):continue
            t=line.split()
            if t[0].startswith('X'):
                model=t[5];params=dict(re.findall(r'(\w+)=([^\s]+)',line));kind='pmos' if '__pfet_' in model else 'nmos'
                actual.append(dict(kind=kind,d=t[1],g=t[2],s=t[3],b=t[4],w=float(params['w']),l=float(params['l'])))
            elif t[0].startswith('C'):caps.append(line)
            flat.append(line)
        def identity(d):return (d['kind'],d['g'],d['b'],tuple(sorted((d['d'],d['s']))),round(d['w'],4),round(d['l'],4))
        expected=collections.Counter(identity(d) for d in devices);got=collections.Counter(identity(d) for d in actual)
        count=re.search(r'GNIMULA_DRC_COUNT (\d+)',log);why=re.search(r'GNIMULA_DRC_WHY (.*)',log)
        import base64
        return dict(engine='Magic',technology='SKY130A',gridUm=.01,netlist='\n'.join(flat),rawNetlist=spice,devices=len(actual),parasiticCapacitors=len(caps),connectivityMatches=expected==got,missing=[str(x) for x in (expected-got).elements()],unexpected=[str(x) for x in (got-expected).elements()],drcErrors=int(count[1]) if count else None,drcDetails=why[1] if why else '',log=log[-18000:],magic=(folder/'logic.mag').read_text(),gdsBase64=base64.b64encode((folder/'logic.gds').read_bytes()).decode() if (folder/'logic.gds').exists() else '',geometrySha256=hashlib.sha256(json.dumps(layout,sort_keys=True).encode()).hexdigest())

def logic_measurement(payload, simulate):
    """Run real transient analysis; assess settled values and individual edge delays."""
    result=simulate({**payload,'samples':10000});rows=result['rows'];kind=payload.get('kind','xor');out_index=3 if kind=='xor' else 2
    def nearest(t):return min(rows,key=lambda r:abs(r[0]-t))
    truth=[]
    for ns in [10,30,50,70,90,110,130,150]:
        r=nearest(ns*1e-9);a=int(r[1]>.9);b=int(r[2]>.9) if kind=='xor' else 0;expected=a^b if kind=='xor' else 1-a;v=r[out_index]
        truth.append(dict(timeNs=ns,a=a,b=b if kind=='xor' else None,expected=expected,voltage=v,passed=v>1.44 if expected else v<.36))
    def crosses(index):
        edges=[]
        for p,r in zip(rows,rows[1:]):
            if (p[index]<.9<=r[index]) or (p[index]>.9>=r[index]):
                edges.append((p[0]+(.9-p[index])/(r[index]-p[index])*(r[0]-p[0]),'rise' if r[index]>p[index] else 'fall'))
        return edges
    outputs=crosses(out_index);delays=[]
    for index in ([1,2] if kind=='xor' else [1]):
        for t,direction in crosses(index):
            future=[(ot,od) for ot,od in outputs if t<=ot<t+5e-9]
            if future:
                ot,od=future[0];delays.append(dict(input='A' if index==1 else 'B',inputEdge=direction,outputEdge=od,delayPs=(ot-t)*1e12,timeNs=t*1e9))
    result['truthTable']=truth;result['truthPassed']=all(t['passed'] for t in truth);result['delays']=delays;result['worstDelayPs']=max((x['delayPs'] for x in delays),default=None);result['totalSamples']=len(rows)
    # Keep switching transitions at high resolution, decimate only quiet regions.
    stride=max(1,math.ceil(len(rows)/1200));keep={0,len(rows)-1}
    for i in range(1,len(rows)):
        if i%stride==0 or any(abs(rows[i][j]-rows[i-1][j])>.025 for j in range(1,len(rows[i]))):keep.update((i-1,i))
    result['rows']=[rows[i] for i in sorted(keep)];return result

def run_physical(payload,simulate):
    action=payload.get('action');devices=validate_devices(payload.get('devices'))
    if action=='layout':return {'layout':generate_layout(devices)}
    if action=='verify':return {'extraction':extract(payload.get('layout',{}),devices)}
    if action=='prelayout':return {'measurement':logic_measurement(payload,simulate)}
    if action=='postlayout':
        # Always extract the actual submitted geometry. Never trust a caller's
        # cached LVS flag or a supplied extracted SPICE string.
        e=extract(payload.get('layout',{}),devices)
        if not e['connectivityMatches']:raise ValueError('Extracted transistor connectivity does not match the schematic. Resolve layout opens/shorts before post-layout simulation.')
        original=payload.get('netlist','');from server import validate_netlist
        validate_netlist(original)
        remaining=[l for l in original.splitlines()[1:] if l and l[0].upper() not in ('M','X') and l!='.end']
        netlist='Gnimula generated circuit\n'+e['netlist']+'\n'+'\n'.join(remaining)+'\n.end\n'
        result=logic_measurement({**payload,'netlist':netlist},simulate)
        return {'measurement':result,'extraction':e,'extractedTestbench':netlist}
    raise ValueError('Unknown physical-design action.')
