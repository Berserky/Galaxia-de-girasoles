import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function engine(){
 const file=new URL('../android/app/src/main/assets/mobile/chat-motion.js',import.meta.url);
 assert.ok(fs.existsSync(file),'central motion runtime must exist');
 const context={window:{},document:{visibilityState:'visible'},navigator:{},performance:{now:()=>1000}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(file,'utf8'),context);
 return context.window.GalaxyChatMotion.create({now:()=>1000,reduced:()=>false,slow:()=>false});
}
test('only explicit fresh visible events animate, never history or recycled rows',()=>{
 const motion=engine();
 motion.offer(['a','b'],{atBottom:true});
 assert.equal(motion.consume('a',false),false);
 assert.equal(motion.consume('a',true),false,'offscreen events cannot animate later');
 assert.equal(motion.consume('b',true),true);
 assert.equal(motion.consume('b',true),false,'virtual remount cannot replay');
 assert.equal(motion.consume('old',true),false);
});
test('large bursts and reading history suppress entry effects',()=>{
 const motion=engine();
 motion.offer(Array.from({length:20},(_,i)=>String(i)),{atBottom:true});
 assert.equal(motion.consume('0',true),false);
 motion.offer(['history-reader'],{atBottom:false});
 assert.equal(motion.consume('history-reader',true),false);
});
test('split realtime bursts clear pending effects instead of queueing twenty animations',()=>{
 const motion=engine();
 for(let i=0;i<20;i++)motion.offer([String(i)],{atBottom:true});
 for(let i=0;i<20;i++)assert.equal(motion.consume(String(i),true),false);
});
test('recurrent slow frames disable nonessential motion while preserving immediate updates',()=>{
 const motion=engine();
 motion.frame(40);motion.frame(40);motion.frame(40);
 motion.offer(['new'],{atBottom:true});
 assert.equal(motion.consume('new',true),false);
});
test('system reduced motion retains functional fade feedback with no translation or scale',async()=>{
 const file=new URL('../android/app/src/main/assets/mobile/chat-motion.js',import.meta.url);
 const context={window:{},document:{visibilityState:'visible'},navigator:{},performance:{now:()=>1000}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(file,'utf8'),context);
 const motion=context.window.GalaxyChatMotion.create({reduced:()=>true,slow:()=>false});
 let frames;
 const el={animate:(value)=>{frames=value;return {finished:Promise.resolve(),cancel(){}};}};
 motion.animate(el,'feedback');
 assert.equal(frames.length,2);assert.equal(frames[1].opacity,1);
 assert.ok(frames.every(frame=>!('transform' in frame)));
});

test('history rerenders do not measure rows when no fresh motion is pending',()=>{
 const motion=engine();
 const container={getBoundingClientRect(){throw new Error('unnecessary layout read');}};
 motion.entries(container);
});
