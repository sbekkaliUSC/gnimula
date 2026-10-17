// Independently implemented viewport math. Coordinates are schematic units;
// a viewBox remains 1000 × 640 at zoom 1, regardless of SVG letterboxing.
export interface Point {x:number;y:number}
export interface Camera extends Point {zoom:number}
export const MIN_ZOOM=.1,MAX_ZOOM=8;
export const clampZoom=(z:number)=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,z));
export function zoomAt(camera:Camera,anchor:Point,factor:number):Camera {
 const zoom=clampZoom(camera.zoom*factor),ratio=camera.zoom/zoom;
 return {x:anchor.x-(anchor.x-camera.x)*ratio,y:anchor.y-(anchor.y-camera.y)*ratio,zoom};
}
export function panFrom(camera:Camera,delta:Point,inverse:{a:number;b:number;c:number;d:number}):Camera {
 return {...camera,x:camera.x-delta.x*inverse.a-delta.y*inverse.c,y:camera.y-delta.x*inverse.b-delta.y*inverse.d};
}
export function fitBounds(a:Point,b:Point,maxZoom=MAX_ZOOM):Camera {
 const zoom=clampZoom(Math.min(maxZoom,1000/Math.max(1,Math.abs(b.x-a.x)),640/Math.max(1,Math.abs(b.y-a.y))));
 return {x:(a.x+b.x)/2-500/zoom,y:(a.y+b.y)/2-320/zoom,zoom};
}
