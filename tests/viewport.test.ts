import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomAt,panFrom,fitBounds,MIN_ZOOM,MAX_ZOOM} from '../frontend/src/viewport';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('pointer anchor survives zoom, limits, and a reversible zoom sequence',()=>{
 const initial={x:-260,y:110,zoom:.3},point={x:175.3,y:-91.2};
 for(const factor of [.001,.8,1.25,1000]){
  const next=zoomAt(initial,point,factor);
  close((point.x-initial.x)*initial.zoom,(point.x-next.x)*next.zoom);
  close((point.y-initial.y)*initial.zoom,(point.y-next.y)*next.zoom);
  assert.ok(next.zoom>=MIN_ZOOM&&next.zoom<=MAX_ZOOM);
 }
 const roundtrip=zoomAt(zoomAt(initial,point,1.25),point,.8);
 close(roundtrip.x,initial.x);close(roundtrip.y,initial.y);close(roundtrip.zoom,initial.zoom);
});
test('panning uses the starting transform without grid snapping or cumulative drift',()=>{
 const start={x:12.1,y:-20,zoom:.7},inv={a:2,b:0,c:0,d:2};
 const camera=panFrom(start,{x:.35,y:17.25},inv);
 close(camera.x,11.4);close(camera.y,-54.5);assert.equal(camera.zoom,start.zoom);
 assert.deepEqual(panFrom(start,{x:0,y:0},inv),start);
});
test('fit is direction-independent, centered, bounded, and includes both corners',()=>{
 const a={x:-80,y:70},b={x:4020,y:270};const c=fitBounds(a,b);
 assert.deepEqual(fitBounds(b,a),c);
 close(c.x+500/c.zoom,(a.x+b.x)/2);close(c.y+320/c.zoom,(a.y+b.y)/2);
 assert.ok(c.x<=a.x&&c.y<=a.y&&c.x+1000/c.zoom>=b.x&&c.y+640/c.zoom>=b.y);
 assert.equal(fitBounds(a,a).zoom,MAX_ZOOM);
});
