import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../web/vendor/three/three.module.js';
import {createHabitatCamera,createHabitatGesture,habitatKeyInput} from '../../web/js/world/habitat-camera.js';

test('repeated extreme camera input stays in the open habitat aisle and below the vault',()=>{
  const control=createHabitatCamera();
  for(let i=0;i<1200;i++){
    control.move({orbitX:Math.sin(i)*9,orbitY:Math.cos(i)*9,panX:Math.sin(i*.7)*20,panY:Math.cos(i*.4)*20,zoom:i%2?5:-5});
    for(const compact of [false,true]){
      const {position:p,target,fov}=control.frame(compact);
      assert([...p,...target,fov].every(Number.isFinite));
      assert(p[0]>=-2.7&&p[0]<=2.7);assert(p[1]>=-.75);assert(p[2]>=1.45&&p[2]<10.4);
      assert((p[0]/5)**2+((p[1]+1.43)/4.4)**2<=.900001);
      assert(p[2]>target[2]);
    }
  }
});

test('orbit, pan and zoom change real 3D projection; reset is repeatable',()=>{
  const control=createHabitatCamera();
  const projected=()=>{const f=control.frame(),camera=new T.PerspectiveCamera(f.fov,1280/720,.05,500);camera.position.fromArray(f.position);camera.lookAt(new T.Vector3(...f.target));camera.updateMatrixWorld(true);return new T.Vector3(.9,.2,.25).project(camera).toArray();};
  control.reset();const original=projected();
  for(const input of [{orbitX:.25},{panX:.5},{zoom:-.3}]){control.reset();control.move(input);assert.notDeepEqual(projected(),original);}
  control.reset();assert.deepEqual(projected(),original);
  control.reset(true);const compact=control.frame(true);control.move({panX:10,orbitY:10});control.reset(true);assert.deepEqual(control.frame(true),compact);
});

test('invalid numeric input cannot poison framing and snapshots cannot mutate controls',()=>{
  const control=createHabitatCamera(),before=control.snapshot();
  control.move({orbitX:NaN,orbitY:Infinity,panX:undefined,panY:-Infinity,zoom:NaN});
  assert.deepEqual(control.snapshot(),before);const snap=control.snapshot();snap.target[0]=999;
  assert.deepEqual(control.snapshot(),before);
});

test('keyboard supports orbit, explicit pan and zoom without consuming unrelated keys',()=>{
  assert(habitatKeyInput({key:'ArrowLeft'}).orbitX<0);
  assert(habitatKeyInput({key:'ArrowUp',shiftKey:true}).panY>0);
  assert(habitatKeyInput({key:'+'}).zoom<0);assert(habitatKeyInput({key:'-'}).zoom>0);
  assert.equal(habitatKeyInput({key:'Tab'}),null);assert.equal(habitatKeyInput({key:'Enter'}),null);
});

test('a tap may select an object, while a returning drag remains suppressed',()=>{
  const gesture=createHabitatGesture();gesture.begin(1,20,20);gesture.move(1,22,21);
  assert.deepEqual(gesture.end(1),{owned:true,dragged:false});
  gesture.begin(2,20,20);gesture.move(2,100,20);gesture.move(2,20,20);
  assert.deepEqual(gesture.end(2),{owned:true,dragged:true});assert.equal(gesture.count,0);
});

test('both releases of a two-finger gesture are suppressed even without movement',()=>{
  const gesture=createHabitatGesture();gesture.begin(1,10,10);gesture.begin(2,100,10);
  assert.equal(gesture.end(1).dragged,true);assert.equal(gesture.end(2).dragged,true);
  gesture.begin(3,10,10);assert.equal(gesture.end(3).dragged,false);
});

test('pinch generates finite zoom and pan; cancellation clears every pointer',()=>{
  const gesture=createHabitatGesture();gesture.begin(1,0,0);gesture.begin(2,100,0);
  const delta=gesture.move(2,120,10);assert(delta.zoom<0);assert(Object.values(delta).every(Number.isFinite));
  assert.deepEqual(gesture.clear(),[1,2]);assert.equal(gesture.count,0);assert.equal(gesture.move(2,200,20),null);
  assert.deepEqual(gesture.end(2),{owned:false,dragged:false});
});
