/* Spice Showdown: animated flames along the bottom of the page + click-to-pop stickers. Player only. */
(function(){
'use strict';
var SS=window.SS,RM=SS&&SS.RM;
var c=document.getElementById('fire');
if(c&&c.getContext&&!RM){
  var x=c.getContext('2d'),W=0,H=0,DPR=1,fl=[],t0=0;
  var resize=function(){DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=Math.round(window.innerHeight*.46);
    c.width=Math.round(W*DPR);c.height=Math.round(H*DPR);x.setTransform(DPR,0,0,DPR,0,0)};
  var mk=function(){var s=W<600?.7:1;return {x:Math.random()*W,y:H+10,r:(14+Math.random()*34)*s,vy:.8+Math.random()*1.9,ph:Math.random()*6.28,life:0,max:70+Math.random()*70}};
  resize();var rz;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(resize,150)});
  var target=function(){return Math.round(Math.min(W/9,130))};
  var loop=function(t){
    x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';
    while(fl.length<target())fl.push(mk());
    for(var i=fl.length-1;i>=0;i--){
      var f=fl[i];f.life++;f.y-=f.vy;f.x+=Math.sin(f.ph+t/260)*.9;
      var k=f.life/f.max;if(k>=1){fl.splice(i,1);continue}
      var r=f.r*(1-k*.8),a=Math.sin(Math.PI*Math.min(1,k*1.1))*.55;
      var g=x.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      g.addColorStop(0,'hsla('+(34-k*34)+',100%,'+(62-k*20)+'%,'+a+')');
      g.addColorStop(.5,'hsla('+(14-k*14)+',100%,48%,'+a*.6+')');
      g.addColorStop(1,'hsla(8,100%,45%,0)');
      x.fillStyle=g;x.beginPath();x.arc(f.x,f.y,r,0,6.283);x.fill();
    }
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
}
/* stickers: randomize tilt/phase, pop + fire burst on click */
var stks=document.querySelectorAll('.stk');
Array.prototype.forEach.call(stks,function(s,i){
  s.style.setProperty('--r',(s.style.getPropertyValue('--r')||'')||'0deg');
  s.style.animationDelay=(-(i*0.9)%4).toFixed(1)+'s';
  s.addEventListener('click',function(e){
    e.stopPropagation();
    s.classList.remove('pop');void s.offsetWidth;s.classList.add('pop');
    if(SS&&SS.fx&&SS.fx.burst)SS.fx.burst(s);
  });
  s.addEventListener('animationend',function(e){if(e.animationName==='stkPop'){s.classList.remove('pop')}});
});
})();
