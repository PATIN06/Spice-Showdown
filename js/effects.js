/* Spice Showdown: ambient embers, click bursts and confetti. Player only. */
(function(){
'use strict';
var SS=window.SS,$=SS.$,RM=SS.RM;
var amb=$('#amb'),fx=$('#fx');
if(!amb||!fx||!amb.getContext||!fx.getContext){SS.fx={burst:function(){},confetti:function(){}};return}
var actx=amb.getContext('2d'),fctx=fx.getContext('2d');
var W=0,H=0,DPR=1;
var EMBER=['#ffd23f','#ffb52e','#ff8a1f','#ff5a1d','#ff3b1d','#fff0dc'];
var embers=[],parts=[];

function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;
  [amb,fx].forEach(function(c){c.width=Math.round(W*DPR);c.height=Math.round(H*DPR)});
  actx.setTransform(DPR,0,0,DPR,0,0);fctx.setTransform(DPR,0,0,DPR,0,0);
}
function mkEmber(init){return {x:Math.random()*W,y:init?Math.random()*H:H+12,r:.8+Math.random()*2.2,vy:.25+Math.random()*.6,vx:(Math.random()-.5)*.25,ph:Math.random()*6.28,hue:18+Math.random()*32}}
function spawn(o){var p={x:0,y:0,vx:0,vy:0,g:0,drag:.985,life:60,max:60,size:3,color:'#ffb347',shape:'c',rot:0,vr:0,add:true};for(var k in o){p[k]=o[k]}p.max=p.life;if(parts.length<900)parts.push(p)}

function burst(el){
  if(RM)return;
  var b=el.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2,i,a,sp;
  for(i=0;i<95;i++){
    a=Math.random()*6.283;sp=2+Math.random()*9;
    spawn({x:cx+Math.cos(a)*b.width*.25*Math.random(),y:cy+Math.sin(a)*b.height*.2*Math.random(),vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,g:-.03,life:50+Math.random()*50,size:1.5+Math.random()*3.5,color:EMBER[(Math.random()*EMBER.length)|0]});
  }
}
function confetti(){
  if(RM)return;
  var cols=EMBER.concat(['#ffffff']),wave;
  for(wave=0;wave<2;wave++){
    (function(w){setTimeout(function(){
      for(var j=0;j<110;j++){
        var left=w===1&&j%2===0,right=w===1&&j%2===1;
        spawn({x:left?0:right?W:W*.5+(Math.random()-.5)*W*.3,y:w===0?H*.3:H*.55,
          vx:left?4+Math.random()*9:right?-4-Math.random()*9:(Math.random()-.5)*14,
          vy:-5-Math.random()*11,g:.22,drag:.99,life:170+Math.random()*80,size:5+Math.random()*7,
          color:cols[(Math.random()*cols.length)|0],shape:'r',rot:Math.random()*6,vr:(Math.random()-.5)*.35,add:false});
      }
    },w*380)})(wave);
  }
}
function loop(t){
  actx.clearRect(0,0,W,H);
  actx.globalCompositeOperation='lighter';
  for(var i=0;i<embers.length;i++){
    var e=embers[i];
    e.y-=e.vy;e.x+=e.vx+Math.sin(e.ph+t/1800)*.25;
    if(e.y<-12){embers[i]=mkEmber(false);continue}
    var al=.18+.32*(.5+.5*Math.sin(e.ph+t/500));
    actx.fillStyle='hsla('+e.hue+',100%,58%,'+al*.35+')';
    actx.beginPath();actx.arc(e.x,e.y,e.r*3,0,6.283);actx.fill();
    actx.fillStyle='hsla('+e.hue+',100%,65%,'+al+')';
    actx.beginPath();actx.arc(e.x,e.y,e.r,0,6.283);actx.fill();
  }
  fctx.clearRect(0,0,W,H);
  for(var k=parts.length-1;k>=0;k--){
    var p=parts[k];
    p.vx*=p.drag;p.vy=p.vy*p.drag+p.g;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life--;
    if(p.life<=0||p.y>H+60){parts.splice(k,1);continue}
    fctx.globalCompositeOperation=p.add?'lighter':'source-over';
    fctx.globalAlpha=Math.min(1,p.life/p.max*1.5);
    fctx.fillStyle=p.color;
    if(p.shape==='c'){fctx.beginPath();fctx.arc(p.x,p.y,p.size,0,6.283);fctx.fill()}
    else{fctx.save();fctx.translate(p.x,p.y);fctx.rotate(p.rot);fctx.scale(1,Math.cos(p.rot*2.3));fctx.fillRect(-p.size/2,-p.size*.3,p.size,p.size*.6);fctx.restore()}
  }
  fctx.globalAlpha=1;
  window.requestAnimationFrame(loop);
}
resize();
var rzT;window.addEventListener('resize',function(){clearTimeout(rzT);rzT=setTimeout(resize,150)});
if(!RM){
  for(var n=0;n<44;n++)embers.push(mkEmber(true));
  window.requestAnimationFrame(loop);
}
SS.fx={burst:burst,confetti:confetti};
})();
