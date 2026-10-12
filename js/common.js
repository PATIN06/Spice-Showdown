/* Spice Showdown: helpers shared by the player (index.html) and the admin (admin.html).
   Plain scripts, no build step. Everything hangs off window.SS. */
(function(){
'use strict';
var SS=window.SS=window.SS||{};
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
SS.$=$;SS.$$=$$;
SS.RM=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
SS.MAX_DISHES=16;
SS.KEY_DRAFT='ss.draft.v1';
SS.KEY_TOTALS='ss.totals.v1';
SS.KEY_UNLOCK='ss.admin.ok';
SS.MENU_URL='data/menu.json';
SS.DEFAULT_TITLE='ศึกจานเผ็ด';
SS.DEFAULT_TAGLINE='อาหารเผ็ดสองจานขึ้นเวทีมาประชันกัน เลือกจานที่อยากกินมากกว่า จานที่แพ้จะถูกแทนด้วยตัวท้าชิงคนใหม่ ส่วนผู้ชนะอยู่ป้องกันตำแหน่งต่อ';
SS.DEFAULT_HOWTO=['เลือกจานโปรดจากสองจานที่ขึ้นบนหน้าจอ','จานที่ไม่ได้เลือกจะถูกแทนด้วยจานใหม่จากเมนู','เลือกไปเรื่อย ๆ จนเมนูหมด จานสุดท้ายที่เลือกคือผู้ชนะ'];
SS.MAX_HOWTO=6;

SS.el=function(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
SS.uid=function(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)};
SS.shuffle=function(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a};

/* ---------- icons ---------- */
SS.CHILI='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16.6 4.3c4 1.9 5 6.6 2.6 10.6-2.6 4.4-8 6.4-14.6 5.6-.9-.1-1-.7-.3-1.1 3.8-2 5.8-4.2 6.6-8 .6-3 2.9-6.1 5.7-7.1z" fill="currentColor"/><path d="M16.2 4.6c-.5-1.5.3-2.8 1.7-3 .9-.1 1.4.7.8 1.3-.5.5-.7 1-.5 1.7z" fill="currentColor" opacity=".65"/></svg>';
SS.CROSS='<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
SS.UP='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
SS.DOWN='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
SS.WORDS=['เผ็ดนิดเดียว','เผ็ดน้อย','เผ็ดกลาง','เผ็ดจัด','เผ็ดสุดโหด'];
SS.heatHTML=function(n){
  var h='';
  for(var i=1;i<=5;i++){h+='<i class="c'+(i<=n?' on':'')+'">'+SS.CHILI+'</i>'}
  return '<span class="heat" role="img" aria-label="ความเผ็ด '+n+' จาก 5 ระดับ '+SS.WORDS[n-1]+'">'+h+'</span>';
};
SS.heatPicker=function(value,onChange){
  var box=SS.el('div','heat-pick'),word=SS.el('span','heat-word'),btns=[];
  box.appendChild(word);
  function paint(){
    btns.forEach(function(b,i){var n=i+1;b.classList.toggle('on',n<=value);b.setAttribute('aria-pressed',String(n===value))});
    word.textContent=SS.WORDS[value-1];
  }
  for(var i=1;i<=5;i++){
    (function(n){
      var b=SS.el('button','hp');b.type='button';b.innerHTML=SS.CHILI;
      b.setAttribute('aria-label','ความเผ็ด '+n+' จาก 5 ระดับ '+SS.WORDS[n-1]);
      b.addEventListener('click',function(){value=n;paint();if(onChange)onChange(n)});
      btns.push(b);box.insertBefore(b,word);
    })(i);
  }
  paint();
  box.getValue=function(){return value};
  box.setValue=function(v){value=v;paint()};
  return box;
};

/* ---------- storage (every access wrapped) ---------- */
SS.store={
  ok:(function(){try{localStorage.setItem('ss.t','1');localStorage.removeItem('ss.t');return true}catch(e){return false}})(),
  get:function(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}},
  set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  sget:function(k){try{return sessionStorage.getItem(k)}catch(e){return null}},
  sset:function(k,v){try{sessionStorage.setItem(k,v);return true}catch(e){return false}},
  sdel:function(k){try{sessionStorage.removeItem(k)}catch(e){}}
};
SS.getTotals=function(){
  var t=SS.store.get(SS.KEY_TOTALS);
  if(!t||typeof t!=='object'||!t.items||typeof t.items!=='object')return {games:0,items:{}};
  return t;
};
var toastTimer;
SS.toast=function(m){
  var t=$('#toast');if(!t)return;
  t.textContent=m;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show')},4200);
};
SS.twoStep=function(btn,armedLabel,action){
  var armed=false,to,orig=btn.textContent;
  btn.addEventListener('click',function(){
    if(!armed){armed=true;btn.textContent=armedLabel;btn.classList.add('armed');to=setTimeout(function(){armed=false;btn.textContent=orig;btn.classList.remove('armed')},3200);return}
    clearTimeout(to);armed=false;btn.textContent=orig;btn.classList.remove('armed');action();
  });
};

/* ---------- sample dish illustrations (drawn in code, not photos) ---------- */
function n1(v){return Math.round(v*10)/10}
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function C(x,y,r,f,o){return '<circle cx="'+n1(x)+'" cy="'+n1(y)+'" r="'+n1(r)+'" fill="'+f+'"'+(o?' opacity="'+o+'"':'')+'/>'}
function E(x,y,rx,ry,f,rot,o){return '<ellipse cx="'+n1(x)+'" cy="'+n1(y)+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'" transform="rotate('+n1(rot||0)+' '+n1(x)+' '+n1(y)+')"'+(o?' opacity="'+o+'"':'')+'/>'}
function R(x,y,w,h,f,rot,rx){return '<rect x="'+n1(x-w/2)+'" y="'+n1(y-h/2)+'" width="'+w+'" height="'+h+'" rx="'+(rx||0)+'" fill="'+f+'" transform="rotate('+n1(rot||0)+' '+n1(x)+' '+n1(y)+')"/>'}
function LEAF(x,y,s,f,rot){return '<g transform="translate('+n1(x)+' '+n1(y)+') rotate('+n1(rot)+') scale('+n1(s)+')"><path d="M0 0C6-9 17-9 24 0C17 9 6 9 0 0Z" fill="'+f+'"/><path d="M2 0H21" stroke="#00000033" stroke-width="1" fill="none"/></g>'}
function SLICE(x,y,r){return C(x,y,r,'#e3260f')+C(x,y,r*.62,'#ff6a3d')+C(x-r*.22,y-r*.1,r*.13,'#ffe7a8')+C(x+r*.24,y+r*.12,r*.13,'#ffe7a8')}
function frame(c1,c2,inner){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><radialGradient id="g" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></radialGradient><clipPath id="bc"><path d="M68 150h264c0 70-52 104-132 104S68 220 68 150z"/></clipPath></defs>'+
    '<rect width="400" height="300" fill="url(#g)"/><circle cx="345" cy="28" r="112" fill="#fff" opacity=".07"/><circle cx="36" cy="292" r="92" fill="#000" opacity=".13"/>'+inner+'</svg>';
}
function bowl(o,content){
  var steam='';
  [150,200,250].forEach(function(x,i){steam+='<path d="M'+x+' '+(112-(i%2)*6)+'c-14-16 12-26-2-44" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".28"/>'});
  return '<ellipse cx="200" cy="252" rx="128" ry="17" fill="#000" opacity=".3"/>'+
    '<path d="M68 150h264c0 70-52 104-132 104S68 220 68 150z" fill="'+(o.bowl||'#f7eddc')+'"/>'+
    '<g clip-path="url(#bc)"><rect x="60" y="176" width="280" height="30" fill="'+o.band+'"/><rect x="60" y="212" width="280" height="5" fill="'+o.band+'" opacity=".7"/><ellipse cx="150" cy="200" rx="60" ry="80" fill="#fff" opacity=".12"/></g>'+
    '<ellipse cx="200" cy="150" rx="132" ry="34" fill="#fffaf0"/>'+
    '<ellipse cx="200" cy="153" rx="120" ry="28" fill="'+o.broth+'"/>'+
    content+
    '<ellipse cx="165" cy="145" rx="58" ry="7" fill="#fff" opacity=".13"/>'+steam;
}
function plate(inner){
  return '<ellipse cx="200" cy="252" rx="160" ry="16" fill="#000" opacity=".3"/><ellipse cx="200" cy="170" rx="160" ry="72" fill="#fffaf0"/><ellipse cx="200" cy="174" rx="134" ry="55" fill="#efe3cd"/><ellipse cx="200" cy="170" rx="134" ry="55" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>'+inner;
}
function pin(r,spread){var q=Math.sqrt(r()),t=r()*6.2832,k=spread||1;return[200+108*q*Math.cos(t)*k,153+21*q*Math.sin(t)*k]}

var ART={
  tomyum:function(){
    var r=mulberry32(11),s='',i,p;
    for(i=0;i<4;i++){p=pin(r);s+=E(p[0],p[1]-4,17,9,'#ff9d85',r()*60-30)+E(p[0]+11,p[1]-6,7,6,'#ffc2ae',0)+E(p[0]-14,p[1]-2,5,4,'#ff8266',20)}
    for(i=0;i<3;i++){p=pin(r);s+=R(p[0],p[1]-3,40,8,'#dfe79a',r()*40-20,4)}
    for(i=0;i<7;i++){p=pin(r);s+=SLICE(p[0],p[1]-2,6.5)}
    for(i=0;i<6;i++){p=pin(r);s+=LEAF(p[0],p[1]-2,.6+r()*.3,'#4caf50',r()*360)}
    return frame('#ffb347','#8a1c0a',bowl({band:'#e4572e',broth:'#e8531c'},s));
  },
  somtam:function(){
    var r=mulberry32(23),s='',i,p,cols=['#f6eaa6','#f0c86b','#bfe08a','#f9f3cf'];
    s+=E(200,142,102,26,'#f1e6a0');
    for(i=0;i<72;i++){p=pin(r,1.02);s+='<path d="M'+n1(p[0])+' '+n1(p[1]-8)+'q'+n1(r()*20-10)+' '+n1(r()*14-4)+' '+n1(r()*34-17)+' '+n1(r()*10)+'" stroke="'+cols[i%4]+'" stroke-width="3" fill="none" stroke-linecap="round"/>'}
    for(i=0;i<5;i++){p=pin(r,.9);s+=C(p[0],p[1]-6,8,'#e5412d')+C(p[0]-2.5,p[1]-9,2.4,'#fff',.45)}
    for(i=0;i<10;i++){p=pin(r,.95);s+=E(p[0],p[1]-6,4.5,3,'#d9a35b',r()*180)}
    for(i=0;i<5;i++){p=pin(r,.9);s+=SLICE(p[0],p[1]-6,5.5)}
    for(i=0;i<4;i++){p=pin(r,.9);s+=LEAF(p[0],p[1]-6,.55,'#5aa84a',r()*360)}
    return frame('#e9d56a','#6d7a1b',bowl({bowl:'#ecd2aa',band:'#2e7d32',broth:'#f1e6a0'},s));
  },
  krapao:function(){
    var r=mulberry32(37),s='',i,q,t,x,y;
    s+=E(140,178,50,28,'#fffdf4');
    for(i=0;i<34;i++){q=Math.sqrt(r());t=r()*6.28;x=140+44*q*Math.cos(t);y=178+22*q*Math.sin(t);s+=E(x,y,4,1.6,'#e9e1cc',r()*180)}
    s+=E(238,168,82,38,'#6e3a1c');
    for(i=0;i<46;i++){q=Math.sqrt(r());t=r()*6.28;x=238+76*q*Math.cos(t);y=168+32*q*Math.sin(t);s+=E(x,y,3+r()*3,2+r()*2,i%3?'#4b230f':'#8f5128',r()*180)}
    for(i=0;i<9;i++){q=Math.sqrt(r());t=r()*6.28;x=238+70*q*Math.cos(t);y=170+28*q*Math.sin(t);s+=LEAF(x,y,.7,i%2?'#2f7d32':'#3f9a3f',r()*360)}
    for(i=0;i<8;i++){q=Math.sqrt(r());t=r()*6.28;x=238+70*q*Math.cos(t);y=170+28*q*Math.sin(t);s+=SLICE(x,y,5)}
    s+='<path d="M173 145c-6-20 22-34 48-30 26 4 44 18 38 36-6 18-34 24-58 20-14-3-26-12-28-26z" fill="#000" opacity=".18"/>';
    s+='<path d="M170 142c-6-20 22-34 48-30 26 4 44 18 38 36-6 18-34 24-58 20-14-3-26-12-28-26z" fill="#fffef8"/>';
    s+=C(212,140,17,'#ffb81c')+C(206,134,5,'#fff',.55);
    return frame('#ff8a5c','#5d1a0e',plate(s));
  },
  mala:function(){
    var r=mulberry32(41),s='',i,p;
    s+=E(200,150,110,24,'#c01a14',0,.5);
    for(i=0;i<14;i++){p=pin(r,.95);s+=E(p[0],p[1]-2,16,4.5,'#d4180d',r()*180)+C(p[0]+(r()<.5?-14:14),p[1]-2,2,'#5a0d06')}
    for(i=0;i<28;i++){p=pin(r,1);s+=C(p[0],p[1],2.5,'#2b1209')+C(p[0]-.7,p[1]-.8,.8,'#fff',.4)}
    for(i=0;i<10;i++){p=pin(r,.95);s+=C(p[0],p[1]-1,3.4,'#7bc043')+C(p[0],p[1]-1,1.5,'#e9f5c9')}
    for(i=0;i<18;i++){p=pin(r,1);s+=C(p[0],p[1],1.3,'#fff3d0')}
    return frame('#ff5a3c','#3a0505',bowl({bowl:'#3a1c18',band:'#ff7a1a',broth:'#a01010'},s));
  },
  tteok:function(){
    var r=mulberry32(53),s='',i,p;
    for(i=0;i<11;i++){p=pin(r,.92);s+=R(p[0],p[1]-3,32,13,'#ffe9cf',r()*160-80,6.5)+R(p[0]-4,p[1]-5,18,4,'#fff6ea',0,2)}
    for(i=0;i<4;i++){p=pin(r,.88);s+='<path d="M0 0L24 0L12 20Z" fill="#f2c27b" transform="translate('+n1(p[0]-12)+' '+n1(p[1]-10)+') rotate('+n1(r()*120-60)+' 12 10)"/>'}
    p=[232,146];s+=E(p[0],p[1],19,13,'#fffdf5')+C(p[0],p[1],8,'#ffc83a');
    for(i=0;i<9;i++){p=pin(r,.95);s+=C(p[0],p[1]-1,3.2,'#7bc043')+C(p[0],p[1]-1,1.4,'#e9f5c9')}
    for(i=0;i<16;i++){p=pin(r,1);s+=C(p[0],p[1],1.3,'#fff3d0')}
    return frame('#ffc2a0','#c0331b',bowl({band:'#ff6b35',broth:'#d5321a'},s));
  },
  buldak:function(){
    var r=mulberry32(67),s='',i,p,cols=['#b8210f','#d23a16','#9d1409','#e1561f'];
    for(i=0;i<46;i++){p=pin(r,1.02);s+='<path d="M'+n1(p[0]-14)+' '+n1(p[1]-4)+'q'+n1(14+r()*8)+' '+n1(-12-r()*8)+' '+n1(28+r()*10)+' '+n1(r()*8-4)+'" stroke="'+cols[i%4]+'" stroke-width="5.5" fill="none" stroke-linecap="round"/>'}
    for(i=0;i<16;i++){p=pin(r,.95);s+='<path d="M'+n1(p[0]-8)+' '+n1(p[1]-6)+'q8 -5 16 0" stroke="#ff9a5a" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>'}
    for(i=0;i<3;i++){p=pin(r,.8);s+=R(p[0],p[1]-4,22,6,'#10201a',r()*60-30,1)}
    for(i=0;i<8;i++){p=pin(r,.9);s+=C(p[0],p[1]-2,3.2,'#7bc043')+C(p[0],p[1]-2,1.4,'#e9f5c9')}
    for(i=0;i<24;i++){p=pin(r,1);s+=C(p[0],p[1]-2,1.3,'#fff3d0')}
    return frame('#ff6b35','#2a0707',bowl({bowl:'#25100f',band:'#ff3b1d',broth:'#8f1608'},s));
  },
  vindaloo:function(){
    var r=mulberry32(79),s='',i,p;
    for(i=0;i<7;i++){p=pin(r,.9);s+=E(p[0],p[1]-3,15,11,'#e9a45a',r()*60)+E(p[0]-3,p[1]-6,8,4,'#f6c487',r()*60,.8)}
    for(i=0;i<5;i++){p=pin(r,.85);s+=R(p[0],p[1]-3,14,14,'#f0cf7a',r()*90,3)}
    s+='<path d="M140 152q22-16 42-3t42-1 34 7" stroke="#fff5e6" stroke-width="6" fill="none" stroke-linecap="round" opacity=".92"/>';
    for(i=0;i<4;i++){p=pin(r,.85);s+=SLICE(p[0],p[1]-3,5.5)}
    for(i=0;i<7;i++){p=pin(r,.9);s+=LEAF(p[0],p[1]-3,.6,'#4caf50',r()*360)}
    return frame('#ffcf6b','#a8420a',bowl({bowl:'#f9efe0',band:'#2f6f4e',broth:'#c2570d'},s));
  },
  nashville:function(){
    var r=mulberry32(91),s='',i,x,y;
    s+=R(112,172,74,74,'#fff3d8',-10,10)+R(112,172,62,62,'#fffaea',-10,8);
    [[100,160],[124,182],[104,190]].forEach(function(p){s+=C(p[0],p[1],10,'#9db83f')+C(p[0],p[1],7,'#cfe27a')+C(p[0]-2,p[1]-1,1,'#7a8f2c')+C(p[0]+2,p[1]+2,1,'#7a8f2c')});
    s+=E(214,194,50,26,'#dc4b10',-4)+E(208,186,30,11,'#f07a2a',-4,.75);
    s+=E(228,160,56,36,'#d4430e',-14)+E(220,148,36,16,'#ef6a1d',-14,.8);
    s+=E(284,176,44,30,'#c9390b',16)+E(280,166,26,11,'#ea6020',16,.75);
    for(i=0;i<44;i++){x=180+r()*130;y=132+r()*80;s+=C(x,y,1+r()*1.6,'#7a1204',.8)}
    for(i=0;i<10;i++){x=190+r()*110;y=138+r()*60;s+=C(x,y,2.2,'#ffcf6b',.55)}
    return frame('#ffd88a','#b3360b',plate(s));
  }
};
SS.ART_KEYS=Object.keys(ART);
var artCache={};
function artURI(k){return artCache[k]||(artCache[k]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(ART[k]()))}
function placeholderURI(name){
  var h=7,i;for(i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0}
  var P=[['#ff8a1f','#7d1409'],['#ffd23f','#b3360b'],['#ff5a3c','#3a0505'],['#ffb347','#8a1c0a']],p=P[h%P.length];
  var svg=frame(p[0],p[1],'<g transform="translate(104 24) scale(8.2)" fill="#fff" opacity=".3"><path d="M16.6 4.3c4 1.9 5 6.6 2.6 10.6-2.6 4.4-8 6.4-14.6 5.6-.9-.1-1-.7-.3-1.1 3.8-2 5.8-4.2 6.6-8 .6-3 2.9-6.1 5.7-7.1z"/></g>');
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
SS.artURI=artURI;
SS.placeholderURI=placeholderURI;
SS.imgSrc=function(d){return d.img||(d.art&&ART[d.art]?artURI(d.art):placeholderURI(d.name))};
/* Sets an <img> to a dish picture. If the photo fails to load, a drawing is shown instead. */
SS.setImg=function(img,dish){
  img.onerror=function(){
    img.onerror=null;
    img.src=(dish.art&&ART[dish.art])?artURI(dish.art):placeholderURI(dish.name);
  };
  img.src=SS.imgSrc(dish);
};
/* Counts a number up inside a node. Always ends on the right value. */
SS.countUp=function(node,to,delay,ms){
  to=Number(to)||0;
  var dur=ms||800,wait=delay||0;
  if(SS.RM||to===0){node.textContent=to;return}
  node.textContent='0';
  var done=function(){node.textContent=to};
  setTimeout(function(){
    var t0=(window.performance&&performance.now)?performance.now():0;
    (function step(t){
      var k=Math.min(1,((t||t0)-t0)/dur);
      node.textContent=Math.round(to*(1-Math.pow(1-k,3)));
      if(k<1&&window.requestAnimationFrame)window.requestAnimationFrame(step);else done();
    })(t0);
  },wait);
  setTimeout(done,wait+dur+250);
};

/* ---------- menu data ---------- */
SS.SAMPLE_MENU={
  version:1,
  title:SS.DEFAULT_TITLE,
  tagline:SS.DEFAULT_TAGLINE,
  howTo:SS.DEFAULT_HOWTO,
  shuffle:true,
  dishes:[
    {id:'tomyum',name:'ต้มยำกุ้ง',heat:3,art:'tomyum'},
    {id:'somtam',name:'ส้มตำไทย',heat:4,art:'somtam'},
    {id:'krapao',name:'ผัดกะเพรา',heat:4,art:'krapao'},
    {id:'mala',name:'หม่าล่าหม้อไฟ',heat:5,art:'mala'},
    {id:'tteok',name:'ต็อกบกกี',heat:3,art:'tteok'},
    {id:'buldak',name:'บูลดักเส้นไฟ',heat:5,art:'buldak'},
    {id:'vindaloo',name:'ไก่วินดาลู',heat:4,art:'vindaloo'},
    {id:'nashville',name:'ไก่ทอดแนชวิลล์',heat:5,art:'nashville'}
  ]
};
function isImg(v){
  if(typeof v!=='string'||v.length>3000000)return false;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v)||/^(\.\/)?images\/[^\s"'<>\\]+$/.test(v)||/^https:\/\/[^\s"'<>\\]+$/.test(v);
}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function clean(v,max){return typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):''}
/* Turns anything (a parsed menu.json, a stored draft, garbage) into a safe menu object. */
SS.normalizeMenu=function(m){
  m=(m&&typeof m==='object')?m:{};
  var seen=Object.create(null),dishes=[];
  (Array.isArray(m.dishes)?m.dishes:[]).forEach(function(f){
    if(!f||typeof f.name!=='string'||!clean(f.name,40))return;
    if(dishes.length>=SS.MAX_DISHES)return;
    var id=(typeof f.id==='string'&&f.id&&f.id.length<=60&&!seen[f.id])?f.id:SS.uid();
    seen[id]=1;
    var d={id:id,name:clean(f.name,40),heat:clamp(parseInt(f.heat,10)||3,1,5)};
    if(isImg(f.img))d.img=f.img;
    if(typeof f.art==='string'&&ART[f.art])d.art=f.art;
    dishes.push(d);
  });
  var how=(Array.isArray(m.howTo)?m.howTo:[]).map(function(x){return clean(x,120)}).filter(Boolean).slice(0,SS.MAX_HOWTO);
  var out={version:(typeof m.version==='string'&&/^[\w.-]{1,40}$/.test(m.version))?m.version:'1',title:clean(m.title,40)||SS.DEFAULT_TITLE,tagline:clean(m.tagline,220)||SS.DEFAULT_TAGLINE,howTo:how.length?how:SS.DEFAULT_HOWTO.slice(),shuffle:m.shuffle!==false,dishes:dishes};
  if(typeof m.adminPinHash==='string'&&/^[a-z0-9]{6,80}$/.test(m.adminPinHash))out.adminPinHash=m.adminPinHash;
  return out;
};
/* Reads data/menu.json. Falls back to the built-in sample when the file cannot be fetched (for example on file://). */
SS.loadPublished=function(){
  var sample=function(){return {menu:SS.normalizeMenu(SS.SAMPLE_MENU),source:'sample'}};
  if(typeof fetch!=='function')return Promise.resolve(sample());
  return fetch(SS.MENU_URL+'?v='+Date.now(),{cache:'no-store'}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(j){return {menu:SS.normalizeMenu(j),source:'file'}}).catch(function(){return sample()});
};

/* ---------- photo resize (runs in the browser, keeps files small) ---------- */
SS.fileToData=function(file,max){
  max=max||720;
  return new Promise(function(res,rej){
    if(!file||String(file.type).indexOf('image/')!==0){rej(new Error('type'));return}
    var fr=new FileReader();
    fr.onload=function(){
      var im=new Image();
      im.onload=function(){
        var k=Math.min(1,max/Math.max(im.width,im.height));
        var c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
        var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
        try{res(c.toDataURL('image/jpeg',.82))}catch(e){rej(e)}
      };
      im.onerror=function(){rej(new Error('decode'))};
      im.src=fr.result;
    };
    fr.onerror=function(){rej(new Error('read'))};
    fr.readAsDataURL(file);
  });
};

/* ---------- stats chart (used by the player result and the admin) ---------- */
/* rows: [{name, img, picks, duels}] already sorted. Returns the rows that share the top score. */
SS.renderBars=function(ol,rows){
  ol.innerHTML='';
  function sc(r){return r.score!=null?r.score:r.picks}
  var max=1;rows.forEach(function(r){if(sc(r)>max)max=sc(r)});
  rows.forEach(function(r,i){
    var li=document.createElement('li');
    var s=sc(r),isTop=s===max&&s>0;
    if(isTop)li.className='top';
    var im=document.createElement('img');im.alt='';SS.setImg(im,r.dish||{name:r.name,img:r.img});
    var body=document.createElement('div');
    var head=SS.el('div','bar-top');
    var nm=SS.el('span','bar-name',r.name);
    if(isTop){nm.appendChild(SS.el('span','badge',r.badge||'ถูกเลือกมากสุด'))}
    if(r.mark)nm.appendChild(SS.el('span','badge mine',r.mark));
    var val=SS.el('span','bar-val');
    var b=document.createElement('b');SS.countUp(b,s,i*70,800);
    val.appendChild(document.createTextNode(r.prefix!=null?r.prefix:'เลือก '));val.appendChild(b);
    val.appendChild(document.createTextNode(r.suffix!=null?r.suffix:(' ครั้ง · ลงสนาม '+r.duels+' รอบ')));
    head.appendChild(nm);head.appendChild(val);
    var tr=SS.el('div','track');
    var fl=SS.el('div','fill');
    fl.style.width=(s>0?Math.max(4,Math.round(s/max*100)):0)+'%';
    fl.style.animationDelay=(i*70)+'ms';
    tr.appendChild(fl);body.appendChild(head);body.appendChild(tr);
    li.appendChild(im);li.appendChild(body);ol.appendChild(li);
  });
};
/* mode 'final' = จัดอันดับตามจำนวนครั้งที่ถูกเลือกเป็นจานสุดท้าย */
SS.topLine=function(rows,mode){
  function sc(r){return mode==='final'?(r.finals||0):r.picks}
  var max=0;rows.forEach(function(r){if(sc(r)>max)max=sc(r)});
  var tops=rows.filter(function(r){return sc(r)===max&&max>0});
  var lead=mode==='final'?'จานที่คนเลือกเป็นจานสุดท้ายมากสุด: ':'';
  if(tops.length===1)return lead+tops[0].name+' ('+max+' ครั้ง)'+(mode==='final'?'':' คือจานที่ถูกเลือกมากสุด');
  if(tops.length>1)return (mode==='final'?lead:'เสมอกันที่ ')+tops.map(function(t){return t.name}).join(', ')+' ('+max+' ครั้งเท่ากัน)';
  return '';
};
})();
