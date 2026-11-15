// Direct, bounded camera input for the illustrative habitat. This module has no
// task, approval, evidence or animation clock access and never starts a flight.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n)?n:0;
export function createHabitatCamera(){
  let yaw=0,pitch=.14,distance=6.8,target=[0,.1,.25],revision=0;
  function reset(compact=false){yaw=0;pitch=.14;distance=compact?7.2:6.8;target=[0,compact?-.1:.1,.25];revision++;}
  function move({orbitX=0,orbitY=0,panX=0,panY=0,zoom=0}={}){
    yaw=clamp(yaw+finite(orbitX),-.78,.78);pitch=clamp(pitch+finite(orbitY),-.04,.34);
    target[0]=clamp(target[0]+finite(panX),-2.1,2.1);target[1]=clamp(target[1]+finite(panY),-.55,.85);
    distance=clamp(distance*Math.exp(clamp(finite(zoom),-1,1)),2.3,8.8);revision++;
  }
  function frame(compact=false){
    const position=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
    // A conservative interior envelope keeps the observer in front of the work
    // row, clear of the side bulkheads, below the vault and behind the front wall.
    position[0]=clamp(position[0],-2.7,2.7);position[2]=clamp(position[2],1.45,9.55);
    const ceiling=-1.43+4.4*Math.sqrt(Math.max(0,.90-(position[0]/5)**2));
    position[1]=clamp(position[1],-.75,Math.min(2.3,ceiling));
    return {position,target:[...target],fov:compact?64:52};
  }
  return {reset,move,frame,get revision(){return revision;},snapshot:()=>({yaw,pitch,distance,target:[...target]})};
}

export function habitatKeyInput(event){
  const amount=event.shiftKey ? .10 : .065,pan=.16;
  const keys={ArrowLeft:event.shiftKey?{panX:-pan}:{orbitX:-amount},ArrowRight:event.shiftKey?{panX:pan}:{orbitX:amount},ArrowUp:event.shiftKey?{panY:pan}:{orbitY:amount},ArrowDown:event.shiftKey?{panY:-pan}:{orbitY:-amount},'+':{zoom:-.12},'=':{zoom:-.12},'-':{zoom:.12},'_':{zoom:.12}};
  return keys[event.key]||null;
}

// Gesture accounting is separate from pointer capture so a two-finger pinch or
// drag cannot become an object click when the fingers are released in sequence.
export function createHabitatGesture(){
  const pointers=new Map();let travel=0,multiple=false;
  function begin(id,x,y){if(!pointers.size){travel=0;multiple=false;}else multiple=true;pointers.set(id,{x,y});}
  function move(id,x,y,pan=false){
    const old=pointers.get(id);if(!old)return null;
    const dx=x-old.x,dy=y-old.y,other=[...pointers.entries()].find(([key])=>key!==id)?.[1];
    travel+=Math.hypot(dx,dy);pointers.set(id,{x,y});
    if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(x-other.x,y-other.y);return {panX:-dx*.003,panY:dy*.003,zoom:before>8&&after>8?Math.log(before/after):0};}
    return pan?{panX:-dx*.006,panY:dy*.006}:{orbitX:-dx*.004,orbitY:dy*.003};
  }
  function end(id){
    if(!pointers.has(id))return {owned:false,dragged:false};
    const dragged=travel>6||multiple;pointers.delete(id);
    if(!pointers.size){travel=0;multiple=false;}return {owned:true,dragged};
  }
  function clear(){const ids=[...pointers.keys()];pointers.clear();travel=0;multiple=false;return ids;}
  return {begin,move,end,clear,owns:id=>pointers.has(id),get count(){return pointers.size;}};
}
