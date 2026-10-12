/* ศึกจานเผ็ด: ส่งผลเกมและอ่านสถิติรวมของทุกคนจาก Google Apps Script (apps-script/Code.gs)
   ถ้า config.js ไม่ได้ใส่ statsUrl, SS.stats.enabled เป็น false และเกมใช้สถิติในเครื่องแทน

   ออกแบบให้ทนเน็ตห้องเรียนที่ไม่เสถียร:
   - ทุกคำขอมี timeout และลองใหม่แบบหน่วงเวลา
   - เกมที่จบแล้วเข้า outbox ในเครื่อง และส่งซ้ำจนเซิร์ฟเวอร์ยืนยัน
     เซิร์ฟเวอร์นับ id เกมละครั้ง ส่งซ้ำกี่ครั้งก็ไม่นับซ้ำ */
(function(){
'use strict';
var SS=window.SS,store=SS.store;
var url=String((window.SS_CONFIG||{}).statsUrl||'').trim();
var enabled=/^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
var KEY_OUTBOX='ss.outbox.v3',RETRY={busy:1,network:1,timeout:1},memBox=[];
var st=SS.stats={enabled:enabled,url:url};

SS.gameId=function(){
  var a='abcdefghijklmnopqrstuvwxyz0123456789',out='',i,buf;
  try{buf=new Uint8Array(20);window.crypto.getRandomValues(buf);for(i=0;i<20;i++)out+=a[buf[i]%36]}
  catch(e){out='';for(i=0;i<20;i++)out+=a[Math.floor(Math.random()*36)]}
  return out;
};
/* รหัสผู้เล่นแบบสุ่มเก็บในเบราว์เซอร์ ใช้ให้คนเดิมเล่นใหม่แล้วโหวตเก่าถูกแทนที่ (ไม่มีข้อมูลส่วนตัว) */
var memPid=null;
SS.playerId=function(){
  var k='ss.pid',v=store.get(k);
  if(typeof v==='string'&&/^[A-Za-z0-9]{8,40}$/.test(v))return v;
  v=memPid||SS.gameId();memPid=v;store.set(k,v);return v;
};
if(!enabled){
  st.get=st.submit=st.flush=function(){return Promise.resolve({ok:false,error:'disabled'})};
  st.pending=function(){return 0};
  return;
}
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
function once(method,payload,timeout){
  var ctrl=typeof AbortController!=='undefined'?new AbortController():null;
  var timer=setTimeout(function(){if(ctrl)ctrl.abort()},timeout);
  var init={cache:'no-store',redirect:'follow',method:method},u=url;
  if(ctrl)init.signal=ctrl.signal;
  if(method==='GET')u+='?action=stats&_='+Date.now();
  else{init.headers={'Content-Type':'text/plain;charset=utf-8'};init.body=JSON.stringify(payload)}   // คำขอแบบ simple ไม่ต้องมี CORS preflight
  return fetch(u,init).then(function(r){clearTimeout(timer);if(!r.ok)throw new Error('http');return r.json()}).catch(function(e){clearTimeout(timer);throw e});
}
function call(method,payload,opts){
  opts=opts||{};
  var tries=(opts.retries==null?2:opts.retries)+1,n=0;
  function go(){
    n++;
    return once(method,payload,opts.timeout||12000).then(function(j){
      if(!j||typeof j!=='object')j={ok:false,error:'network'};
      if(j.ok===false&&RETRY[j.error]&&n<tries)return wait(700*n+Math.random()*300).then(go);
      return j;
    },function(){
      if(n<tries)return wait(700*n+Math.random()*300).then(go);
      return {ok:false,error:'network'};
    });
  }
  return go();
}
st.get=function(){return call('GET',null,{retries:1,timeout:9000})};

function getBox(){if(!store.ok)return memBox;var o=store.get(KEY_OUTBOX);return Array.isArray(o)?o:[]}
function setBox(o){o=o.slice(-50);if(store.ok)store.set(KEY_OUTBOX,o);else memBox=o}
st.pending=function(){return getBox().length};
var flushing=null;
function flush(){
  if(flushing)return flushing;
  function next(sent){
    var box=getBox();
    if(!box.length)return Promise.resolve({ok:true,sent:sent,left:0});
    var g=box[0];
    return call('POST',{action:'play',gameId:g.gameId,player:g.player,rounds:g.rounds,names:g.names},{retries:1,timeout:20000}).then(function(j){
      var transient=!j.ok&&(RETRY[j.error]||j.error==='server_error'||j.error==='not_setup');
      if(transient){
        g.tries=(g.tries||0)+1;
        if(g.tries<8){box[0]=g;setBox(box);return {ok:false,sent:sent,left:box.length}}
      }
      box=getBox().filter(function(x){return x.gameId!==g.gameId});
      setBox(box);
      return next(j.ok?sent+1:sent);
    });
  }
  flushing=next(0).then(function(r){flushing=null;return r},function(){flushing=null;return {ok:false,left:getBox().length}});
  return flushing;
}
st.flush=flush;
/* game = {gameId, rounds:[[winId,loseId],...], names:{id:name}}. resolve {ok:true} เมื่อเซิร์ฟเวอร์รับแล้ว หรือ {ok:false,left} เมื่อค้างในเครื่อง */
st.submit=function(game){
  var box=getBox();
  box.push({gameId:game.gameId,player:SS.playerId(),rounds:game.rounds,names:game.names,t:Date.now(),tries:0});
  setBox(box);
  return flush();
};
window.addEventListener('online',function(){flush()});
setInterval(function(){if(getBox().length)flush()},60000);
if(getBox().length)setTimeout(flush,3000);
})();
