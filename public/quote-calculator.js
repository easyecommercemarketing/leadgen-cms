// Window cleaning quote calculator: the quote_calculator block (src/render/quote.tsx) loads this.
// Also works on any outside site: <div id="wq-quote"></div><script>window.WQ_CONFIG={...}</script><script src="https://<site>/quote-calculator.js" defer></script>
// Source of truth for the design and the setup tool: the "Window Quote Calculator" artifact. Keep the two in step.
(function(){
var DEF={business:"Pivotal Window Cleaning",phone:"",brand:"#0b4fd9",accent:"#ffd23f",currency:"£",
perBed:3,minimum:10,firstMult:1.5,
types:[{id:"flat",label:"Flat or maisonette",base:10,gutter:50},{id:"terraced",label:"Terraced",base:13,gutter:60},{id:"semi",label:"Semi-detached",base:16,gutter:70},{id:"detached",label:"Detached",base:20,gutter:90},{id:"bungalow",label:"Bungalow",base:15,gutter:65}],
extras:[{id:"cons",label:"Conservatory (sides)",price:8,on:true},{id:"ext",label:"Extension or porch",price:4,on:true},{id:"frames",label:"Frames and sills",price:5,on:true}],
velux:{label:"Velux or skylight windows",price:2,on:true},
freq:[{id:"4w",label:"Every 4 weeks",mult:1,on:true},{id:"8w",label:"Every 8 weeks",mult:1.2,on:true},{id:"once",label:"One-off clean",mult:1.75,on:true}],
oneoffs:[{id:"gutter",label:"Gutter clearing",price:0,byType:true,on:true},{id:"fascia",label:"Fascia and soffit clean",price:55,on:true},{id:"roof",label:"Conservatory roof clean",price:45,needs:"cons",on:true}],
estimate:"This is an estimate. We'll confirm the price after a quick look at your property.",
thanks:"Thanks! We'll be in touch within one working day to confirm your price and first clean date.",
webhook:"",title:"Get an instant window cleaning quote",intro:"",
endpoint:"",form:"quote_calc",page:"",area:"",consent:"",consentName:"share_consent",turnstile:""};
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function num(v,d){v=parseFloat(v);return isFinite(v)?v:d}
function onBrand(hex){var h=String(hex||"").replace("#","");if(h.length===3)h=h.replace(/./g,"$&$&");var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);if(!isFinite(r+g+b))return"#fff";return (0.299*r+0.587*g+0.114*b)>160?"#14213d":"#fff"}
function norm(cfg){var c=Object.assign({},DEF,cfg||{});["types","extras","freq","oneoffs"].forEach(function(k){if(!Array.isArray(c[k])||!c[k].length)c[k]=DEF[k]});c.velux=Object.assign({},DEF.velux,c.velux||{});return c}
var CSS=".wq{container-type:inline-size;font-family:inherit;color:#14213d;line-height:1.5;text-align:left}.wq *{box-sizing:border-box;min-width:0}"+
".wq-grid{display:grid;gap:22px}@container (min-width:700px){.wq-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}.wq-sum{position:sticky;top:16px;align-self:start}}"+
".wq-h{font-size:clamp(24px,3.2cqi,32px);line-height:1.1;margin:0 0 4px;font-weight:800;color:inherit}.wq-sub{margin:0 0 6px;color:#55607a}"+
".wq fieldset{border:0;border-top:1px solid #e3e8f0;margin:0;padding:16px 0 4px}.wq legend{font-weight:800;font-size:17px;padding:0;margin-bottom:10px;float:left;width:100%}.wq legend+*{clear:both}"+
".wq-chips{display:flex;flex-wrap:wrap;gap:8px}.wq-opt{position:relative;cursor:pointer}.wq-opt input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}"+
".wq-opt span{display:flex;gap:8px;align-items:center;min-height:44px;padding:9px 15px;border:2px solid #d5dcea;border-radius:12px;background:#fff;font-weight:600;font-size:15px}"+
".wq-opt input:checked+span{border-color:var(--wq-brand);background:color-mix(in srgb,var(--wq-brand) 10%,#fff);box-shadow:inset 0 0 0 1px var(--wq-brand)}"+
".wq-opt input:focus-visible+span{outline:3px solid var(--wq-brand);outline-offset:2px}.wq-opt input:disabled+span{opacity:.45;cursor:not-allowed}"+
".wq-opt small{font-weight:600;color:#55607a;white-space:nowrap}.wq-opt input:checked+span small{color:var(--wq-brand)}"+
".wq-list{display:grid;gap:8px}.wq-list .wq-opt span{justify-content:space-between}"+
".wq-step{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.wq-step b{font-size:22px;min-width:2ch;text-align:center}"+
".wq-step button{width:44px;height:44px;border-radius:50%;border:2px solid #d5dcea;background:#fff;font-size:22px;font-weight:700;cursor:pointer;color:#14213d;line-height:1}.wq-step button:focus-visible{outline:3px solid var(--wq-brand);outline-offset:2px}"+
".wq-card{background:var(--wq-brand);color:var(--wq-on);border-radius:20px;overflow:hidden}"+
".wq-sky{background:color-mix(in srgb,var(--wq-brand) 14%,#fff);padding:10px 10px 0}.wq-sky svg{display:block;width:100%;height:auto}"+
".wq-res{padding:18px 22px 6px}.wq-k{font-size:14px;opacity:.85;margin:0}.wq-big{font-size:clamp(48px,10cqi,72px);font-weight:800;line-height:1;margin:4px 0 2px;white-space:nowrap}"+
".wq-per{margin:0 0 10px;font-weight:600}.wq-lines{list-style:none;margin:0;padding:10px 0 0;border-top:1px solid color-mix(in srgb,var(--wq-on) 25%,transparent);font-size:14px}"+
".wq-lines li{display:flex;justify-content:space-between;gap:12px;padding:2px 0}.wq-lines li span:last-child{white-space:nowrap}.wq-tag{display:inline-block;background:var(--wq-accent);color:var(--wq-on-acc);font-weight:700;border-radius:999px;padding:3px 12px;font-size:14px;margin:2px 0 8px}"+
".wq-est{font-size:13px;opacity:.85;margin:10px 0 0}.wq-form{padding:8px 22px 22px;display:grid;gap:10px}.wq-form h4{margin:8px 0 0;font-size:18px}"+
".wq-form input,.wq-form textarea{font:inherit;font-size:16px;width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:0;background:#fff;color:#14213d}.wq-form textarea{min-height:64px;resize:vertical}"+
".wq-form input:focus-visible,.wq-form textarea:focus-visible,.wq-go:focus-visible{outline:3px solid var(--wq-accent);outline-offset:2px}.wq-two{display:grid;gap:10px}@container (min-width:420px){.wq-two{grid-template-columns:1fr 1fr}}"+
".wq-go{font:inherit;font-weight:800;font-size:17px;min-height:50px;border:0;border-radius:999px;background:var(--wq-accent);color:var(--wq-on-acc);cursor:pointer}.wq-go:disabled{opacity:.6}"+
".wq-msg{margin:0;font-size:14px;font-weight:600}.wq-msg:empty{display:none}.wq-small{font-size:13px;opacity:.85;margin:0}"+
".wq-wall{fill:#f6efe3}.wq-roof{fill:#2f3a4d}.wq-nb{fill:#dfe5ef}.wq-nbr{fill:#c9d1de}.wq-glass{fill:var(--wq-brand)}.wq-frame{fill:none;stroke:#fff;stroke-width:2}.wq-frame.on{stroke:var(--wq-accent);stroke-width:3}"+
".wq-glint{stroke:#fff;stroke-width:2.2;stroke-linecap:round;opacity:.8}.wq-door{fill:var(--wq-accent)}.wq-cons{fill:var(--wq-brand);opacity:.35}.wq-consl{stroke:#fff;stroke-width:1.5}"+
".wq-ground{fill:color-mix(in srgb,var(--wq-brand) 22%,#fff)}.wq-spark{fill:#fff;transform-box:fill-box;transform-origin:center;animation:wqtw 2.4s ease-in-out infinite}"+
".wq-bar{position:sticky;bottom:10px;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 10px 10px 18px;border-radius:16px;background:var(--wq-brand);color:var(--wq-on);box-shadow:0 8px 24px rgba(10,20,50,.28);transition:opacity .2s}"+
".wq-bar.off{opacity:0;visibility:hidden}.wq-bar b{font-size:26px;line-height:1;white-space:nowrap}.wq-bar small{display:block;font-size:13px;opacity:.9}.wq-bar button{font:inherit;font-weight:800;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:var(--wq-accent);color:var(--wq-on-acc);cursor:pointer;white-space:nowrap}"+
"@container (min-width:700px){.wq-bar{display:none}}@media (prefers-reduced-motion:reduce){.wq-bar{transition:none}}"+
"@keyframes wqtw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}@media (prefers-reduced-motion:reduce){.wq-spark{animation:none;opacity:.9}}";
function calc(c,s){
  var t=c.types.find(function(x){return x.id===s.type})||c.types[0];
  var f=c.freq.find(function(x){return x.id===s.freq&&x.on!==false})||c.freq.find(function(x){return x.on!==false})||c.freq[0];
  var lines=[],sum=num(t.base,0)+(s.beds-2)*num(c.perBed,0);
  lines.push([t.label+", "+s.beds+" bed",sum]);
  c.extras.forEach(function(e){if(e.on!==false&&s.ex[e.id]){lines.push([e.label,num(e.price,0)]);sum+=num(e.price,0)}});
  if(c.velux.on!==false&&s.velux>0){var v=s.velux*num(c.velux.price,0);lines.push([s.velux+" × skylight",v]);sum+=v}
  var per=Math.max(num(c.minimum,0),sum);
  function at(fr){return Math.round(per*num(fr.mult,1))}
  var price=at(f),once=f.id==="once";
  var first=!once&&num(c.firstMult,1)>1?Math.round(price*num(c.firstMult,1)):null;
  var oo=[],oneTotal=0;
  c.oneoffs.forEach(function(o){if(o.on===false||!s.oo[o.id])return;if(o.needs&&!s.ex[o.needs])return;var p=o.byType?num(t.gutter,o.price):num(o.price,0);oo.push([o.label,p]);oneTotal+=p});
  return{t:t,f:f,per:per,price:price,first:first,once:once,lines:lines,oo:oo,oneTotal:oneTotal,at:at};
}
function house(s){
  var id=s.type,st=id==="bungalow"?1:id==="flat"?3:2;
  var cols=id==="bungalow"?Math.min(5,s.beds+1):id==="flat"?3:Math.min(4,Math.max(2,Math.ceil(s.beds/2)+1));
  var cons=!!s.ex.cons,ext=!!s.ex.ext,fr=!!s.ex.frames;
  var g=172,fh=36,ww=24,gp=14,bw=cols*ww+(cols+1)*gp,bh=st*fh+8,top=g-bh;
  var x0=Math.round((360-bw)/2-(cons?28:0)+(ext?20:0)),o=[];
  var pitched=id!=="flat";
  function roof(x,cls){return pitched?'<polygon class="'+cls+'" points="'+(x-8)+','+top+' '+(x+bw/2)+','+(top-34)+' '+(x+bw+8)+','+top+'"/>':'<rect class="'+cls+'" x="'+(x-4)+'" y="'+(top-8)+'" width="'+(bw+8)+'" height="8"/>'}
  function nb(x){o.push(roof(x,"wq-nbr")+'<rect class="wq-nb" x="'+x+'" y="'+top+'" width="'+bw+'" height="'+bh+'"/>')}
  if(id==="terraced"){nb(x0-bw);if(!cons)nb(x0+bw)}
  if(id==="semi")nb(x0-bw);
  o.push(roof(x0,"wq-roof"),'<rect class="wq-wall" x="'+x0+'" y="'+top+'" width="'+bw+'" height="'+bh+'"/>');
  for(var r=0;r<st;r++)for(var k=0;k<cols;k++){
    var x=x0+gp+k*(ww+gp),y=top+10+r*fh;
    if(r===st-1&&k===Math.floor(cols/2)){o.push('<rect class="wq-door" x="'+x+'" y="'+(g-32)+'" width="'+ww+'" height="32" rx="2"/>');continue}
    o.push('<rect class="wq-glass" x="'+x+'" y="'+y+'" width="'+ww+'" height="24" rx="2"/><rect class="wq-frame'+(fr?" on":"")+'" x="'+x+'" y="'+y+'" width="'+ww+'" height="24" rx="2"/><path class="wq-glint" d="M'+(x+6)+' '+(y+17)+'L'+(x+15)+' '+(y+6)+'"/>');
  }
  var vx=Math.min(s.velux,4);for(var i=0;i<vx;i++){o.push(pitched?'<rect class="wq-glass" x="'+(x0+10+i*15)+'" y="'+(top-12-i*7)+'" width="11" height="9" rx="1"/>':'<rect class="wq-glass" x="'+(x0+12+i*18)+'" y="'+(top-14)+'" width="14" height="6"/>')}
  if(ext){var ex=x0-40;o.push('<rect class="wq-roof" x="'+(ex-3)+'" y="'+(g-40)+'" width="46" height="6"/><rect class="wq-wall" x="'+ex+'" y="'+(g-34)+'" width="40" height="34"/><rect class="wq-glass" x="'+(ex+10)+'" y="'+(g-26)+'" width="20" height="16" rx="2"/>')}
  if(cons){var cx=x0+bw;o.push('<polygon class="wq-cons" points="'+cx+','+(g-60)+' '+(cx+58)+','+(g-46)+' '+(cx+58)+','+g+' '+cx+','+g+'"/>');for(var j=1;j<4;j++)o.push('<line class="wq-consl" x1="'+(cx+j*14.5)+'" y1="'+(g-60+j*3.5)+'" x2="'+(cx+j*14.5)+'" y2="'+g+'"/>')}
  var sp=[[x0+gp+4,top+12],[x0+bw-gp-6,top+fh+14],[x0+bw/2,top-4]];
  sp.forEach(function(p,n){o.push('<path class="wq-spark" style="animation-delay:'+(n*.8)+'s" d="M'+p[0]+' '+(p[1]-7)+'L'+(p[0]+2)+' '+(p[1]-2)+'L'+(p[0]+7)+' '+p[1]+'L'+(p[0]+2)+' '+(p[1]+2)+'L'+p[0]+' '+(p[1]+7)+'L'+(p[0]-2)+' '+(p[1]+2)+'L'+(p[0]-7)+' '+p[1]+'L'+(p[0]-2)+' '+(p[1]-2)+'Z"/>')});
  return '<svg viewBox="0 0 360 200" role="img" aria-label="Drawing of your property"><rect class="wq-ground" x="0" y="'+g+'" width="360" height="28"/>'+o.join("")+'</svg>';
}
function mount(el,cfg){
  var uid="wq"+Math.random().toString(36).slice(2,7),c=norm(cfg);
  var io=null,tsId=null,s={type:(c.types[2]||c.types[0]).id,beds:3,velux:0,ex:{},oo:{},freq:null,lead:{},done:false,note:""};
  if(!document.getElementById("wq-style")){var stl=document.createElement("style");stl.id="wq-style";stl.textContent=CSS;document.head.appendChild(stl)}
  function m(v){return esc(c.currency)+Math.round(v)}
  function opt(type,name,val,checked,text,small,attr){return '<label class="wq-opt"><input type="'+type+'" name="'+uid+name+'" value="'+esc(val)+'"'+(checked?" checked":"")+(attr||"")+'><span>'+esc(text)+(small!=null?' <small '+small+'</small>':"")+'</span></label>'}
  function render(){
    if(!c.types.some(function(t){return t.id===s.type}))s.type=c.types[0].id;
    var fr=c.freq.filter(function(f){return f.on!==false});if(!fr.some(function(f){return f.id===s.freq}))s.freq=fr.length?fr[0].id:c.freq[0].id;
    var h='<div class="wq" style="--wq-brand:'+esc(c.brand)+';--wq-accent:'+esc(c.accent)+';--wq-on:'+onBrand(c.brand)+';--wq-on-acc:'+onBrand(c.accent)+'"><div class="wq-grid"><div>'+
    '<h3 class="wq-h">'+esc(c.title)+'</h3><p class="wq-sub">'+esc(c.intro||("From "+c.business+". Takes about 30 seconds, no obligation."))+'</p>'+
    '<fieldset><legend>What type of property is it?</legend><div class="wq-chips">'+c.types.map(function(t){return opt("radio","t",t.id,t.id===s.type,t.label,null,' data-k="type"')}).join("")+'</div></fieldset>'+
    '<fieldset><legend>How many bedrooms?</legend><div class="wq-step"><button type="button" data-step="beds" data-d="-1" aria-label="Fewer bedrooms">−</button><b data-show="beds" aria-live="polite"></b><button type="button" data-step="beds" data-d="1" aria-label="More bedrooms">+</button></div></fieldset>';
    var ex=c.extras.filter(function(e){return e.on!==false});
    if(ex.length||c.velux.on!==false){h+='<fieldset><legend>Anything extra on each clean?</legend><div class="wq-list">'+ex.map(function(e){return opt("checkbox","e"+e.id,e.id,s.ex[e.id],e.label,'>+'+m(num(e.price,0)),' data-ex="'+esc(e.id)+'"')}).join("")+'</div>'+
      (c.velux.on!==false?'<p style="margin:14px 0 8px;font-weight:600">'+esc(c.velux.label)+' <small style="color:#55607a">+'+m(num(c.velux.price,0))+' each</small></p><div class="wq-step"><button type="button" data-step="velux" data-d="-1" aria-label="Fewer skylights">−</button><b data-show="velux" aria-live="polite"></b><button type="button" data-step="velux" data-d="1" aria-label="More skylights">+</button></div>':"")+'</fieldset>'}
    h+='<fieldset><legend>How often?</legend><div class="wq-list">'+fr.map(function(f){return opt("radio","f",f.id,f.id===s.freq,f.label,'data-fp="'+esc(f.id)+'">',' data-k="freq"')}).join("")+'</div></fieldset>';
    var oo=c.oneoffs.filter(function(o){return o.on!==false});
    if(oo.length)h+='<fieldset><legend>Any one-off jobs? (optional)</legend><div class="wq-list">'+oo.map(function(o){return opt("checkbox","o"+o.id,o.id,s.oo[o.id],o.label,'data-op="'+esc(o.id)+'">',' data-oo="'+esc(o.id)+'"')}).join("")+'</div></fieldset>';
    h+='</div><div class="wq-bar" data-wq="bar"><div><b data-wq="barp"></b><small data-wq="barf"></small></div><button type="button" data-act="book">See quote</button></div><div class="wq-sum"><div class="wq-card"><div data-wq="price"></div><div data-wq="lead"></div></div></div></div></div>';
    el.innerHTML=h;lead();update();
    if(io)io.disconnect();
    var bar=el.querySelector('[data-wq="bar"]'),card=el.querySelector(".wq-card");
    if(window.IntersectionObserver){io=new IntersectionObserver(function(en){bar.classList.toggle("off",en[0].isIntersecting)},{threshold:0.15});io.observe(card)}
  }
  function update(){
    var q=calc(c,s);
    el.querySelector('[data-show="beds"]').textContent=s.beds+(s.beds>=6?"+":"");
    var vs=el.querySelector('[data-show="velux"]');if(vs)vs.textContent=s.velux;
    el.querySelectorAll("[data-fp]").forEach(function(n){var f=c.freq.find(function(x){return x.id===n.getAttribute("data-fp")});n.textContent=m(q.at(f))});
    el.querySelectorAll("[data-op]").forEach(function(n){var o=c.oneoffs.find(function(x){return x.id===n.getAttribute("data-op")});n.textContent=m(o.byType?num(q.t.gutter,o.price):num(o.price,0))});
    el.querySelectorAll("[data-oo]").forEach(function(i){var o=c.oneoffs.find(function(x){return x.id===i.getAttribute("data-oo")});i.disabled=!!(o.needs&&!s.ex[o.needs])});
    el.querySelector('[data-wq="barp"]').textContent=c.currency+q.price;
    el.querySelector('[data-wq="barf"]').textContent=(q.once?"one-off clean":"per clean, "+q.f.label.toLowerCase())+(q.oneTotal?" + "+c.currency+q.oneTotal+" one-off":"");
    var L=q.lines.map(function(l){return '<li><span>'+esc(l[0])+'</span><span>'+m(l[1])+'</span></li>'}).join("");
    if(q.per>q.lines.reduce(function(a,l){return a+l[1]},0))L+='<li><span>Minimum charge applies</span><span>'+m(q.per)+'</span></li>';
    if(num(q.f.mult,1)!==1)L+='<li><span>'+esc(q.f.label)+' rate</span><span>×'+num(q.f.mult,1)+'</span></li>';
    q.oo.forEach(function(l){L+='<li><span>'+esc(l[0])+' (one-off)</span><span>'+m(l[1])+'</span></li>'});
    el.querySelector('[data-wq="price"]').innerHTML='<div class="wq-sky">'+house(s)+'</div><div class="wq-res"><p class="wq-k">Your quote</p><p class="wq-big">'+m(q.price)+'</p><p class="wq-per">'+(q.once?"for a one-off clean":"per clean, "+esc(q.f.label.toLowerCase()))+'</p>'+
      (q.first?'<span class="wq-tag">First clean '+m(q.first)+', then '+m(q.price)+'</span>':"")+(q.oneTotal?'<p class="wq-per">Plus '+m(q.oneTotal)+' for one-off jobs</p>':"")+
      '<ul class="wq-lines">'+L+'</ul><p class="wq-est">'+esc(c.estimate)+'</p></div>';
  }
  function lead(){
    var box=el.querySelector('[data-wq="lead"]'),Ld=s.lead;
    if(s.done){box.innerHTML='<div class="wq-form"><h4>Quote sent</h4><p class="wq-small" style="opacity:1">'+esc(c.thanks)+'</p>'+(s.note?'<p class="wq-small">'+esc(s.note)+'</p>':"")+'<button type="button" class="wq-go" data-act="again">Start a new quote</button></div>';return}
    function f(n,lab,type,ac){return '<input data-lead="'+n+'" type="'+type+'" autocomplete="'+ac+'" placeholder="'+lab+'" aria-label="'+lab+'" value="'+esc(Ld[n])+'">'}
    box.innerHTML='<form class="wq-form" novalidate><h4>Happy with that? Book it in</h4>'+f("name","Your name","text","name")+'<div class="wq-two">'+f("phone","Phone","tel","tel")+f("email","Email","email","email")+'</div>'+f("postcode","Postcode","text","postal-code")+
      '<textarea data-lead="notes" placeholder="Access notes, e.g. side gate code (optional)" aria-label="Access notes">'+esc(Ld.notes)+'</textarea>'+
      '<input data-lead="_hp" name="_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">'+
      (c.consent?'<label class="wq-small" style="opacity:1;display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-lead="_consent" style="width:20px;height:20px;min-height:0;flex:none;margin-top:2px"'+(Ld._consent?" checked":"")+'><span>'+esc(c.consent)+'</span></label>':"")+
      (c.turnstile?'<div class="wq-ts"></div>':"")+
      '<button class="wq-go" type="submit">Send my quote</button><p class="wq-msg" role="alert"></p>'+
      (c.phone?'<p class="wq-small">Prefer to talk? Call <a href="tel:'+esc(String(c.phone).replace(/\s/g,""))+'" style="color:inherit">'+esc(c.phone)+'</a></p>':"")+'</form>';
    var ts=box.querySelector(".wq-ts");
    if(ts){if(window.turnstile)tsId=window.turnstile.render(ts,{sitekey:c.turnstile});
      else{window.wqTs=function(){tsId=window.turnstile.render(ts,{sitekey:c.turnstile})};if(!document.getElementById("wq-ts-js")){var sc=document.createElement("script");sc.id="wq-ts-js";sc.async=true;sc.src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=wqTs&render=explicit";document.head.appendChild(sc)}}}
  }
  function area(){var a="";try{a=new URLSearchParams(location.search).get("area")||sessionStorage.getItem("lead_area")||""}catch(e){}
    return c.area||(/^\/[a-z0-9-]+$/.test(a)?a:"")}
  el.addEventListener("change",function(e){var i=e.target;
    if(i.dataset.k){s[i.dataset.k]=i.value}else if(i.dataset.ex){s.ex[i.dataset.ex]=i.checked}else if(i.dataset.oo){s.oo[i.dataset.oo]=i.checked}else return;update()});
  el.addEventListener("input",function(e){var n=e.target.dataset&&e.target.dataset.lead;if(n)s.lead[n]=e.target.type==="checkbox"?e.target.checked:e.target.value});
  el.addEventListener("change",function(e){if(e.target.type==="checkbox"&&e.target.dataset.lead)s.lead[e.target.dataset.lead]=e.target.checked});
  el.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
    if(b.dataset.step){var k=b.dataset.step,mx=k==="beds"?6:10,mn=k==="beds"?1:0;s[k]=Math.max(mn,Math.min(mx,s[k]+parseInt(b.dataset.d,10)));update()}
    if(b.dataset.act==="book"){var cd=el.querySelector(".wq-card");cd.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});var nm=el.querySelector('[data-lead="name"]');if(nm)setTimeout(function(){nm.focus({preventScroll:true})},400)}
    if(b.dataset.act==="again"){s.done=false;s.note="";s.lead={};lead()}});
  el.addEventListener("submit",function(e){e.preventDefault();var L=s.lead,msg=el.querySelector(".wq-msg"),btn=el.querySelector(".wq-form .wq-go");
    if(L._hp)return;
    if(!(L.name||"").trim()||!(L.postcode||"").trim()||!((L.phone||"").trim()||(L.email||"").trim())){msg.textContent="Please add your name, postcode and a phone number or email.";return}
    if(c.consent&&!L._consent){msg.textContent="Please tick the box to agree to us sharing your details.";return}
    var q=calc(c,s),cur=c.currency,p={name:L.name,phone:L.phone||"",email:L.email||"",postcode:L.postcode,notes:L.notes||"",property:q.t.label,bedrooms:String(s.beds),frequency:q.f.label,
      price_per_clean:cur+q.price,first_clean:q.first?cur+q.first:"",one_off_total:q.oneTotal?cur+q.oneTotal:"",extras:q.lines.slice(1).map(function(l){return l[0]}).join(", "),one_off_jobs:q.oo.map(function(l){return l[0]}).join(", "),
      summary:q.t.label+", "+s.beds+" bed, "+q.f.label+": "+cur+q.price+(q.first?" (first clean "+cur+q.first+")":"")+(q.oneTotal?" + "+cur+q.oneTotal+" one-off":"")};
    el.dispatchEvent(new CustomEvent("wq:lead",{detail:p,bubbles:true}));
    function ok(){s.done=true;s.note="";lead();try{if(window.gtag)window.gtag("event","generate_lead",{value:q.price,currency:"GBP",method:"quote_calculator"})}catch(x){}}
    function fail(t){btn.disabled=false;btn.textContent="Send my quote";msg.textContent=t||("Sorry, that didn't send."+(c.phone?" Please call us on "+c.phone+".":" Please try again."));try{if(tsId!=null&&window.turnstile)window.turnstile.reset(tsId)}catch(x){}}
    if(c.endpoint){
      var fd=new FormData();fd.append("_form",c.form);fd.append("_page",c.page||location.pathname);fd.append("_area",area());fd.append("_hp","");
      Object.keys(p).forEach(function(k){fd.append(k,p[k])});
      if(c.consent){fd.append(c.consentName,"Yes");fd.append("_consent","yes")}
      var tk=el.querySelector('[name="cf-turnstile-response"]');if(tk)fd.append("cf-turnstile-response",tk.value);
      btn.disabled=true;btn.textContent="Sending…";
      fetch(c.endpoint,{method:"POST",body:fd,headers:{accept:"application/json"}}).then(function(r){return r.json().catch(function(){return{ok:r.ok}}).then(function(j){if(r.ok&&j.ok!==false)ok();else fail(j.error==="spam check failed"?"Sorry, the spam check failed. Please try again.":null)})}).catch(function(){fail()});
      return}
    p.business=c.business;p.page=location.href;p.submitted_at=new Date().toISOString();
    if(!c.webhook){s.done=true;s.note="Preview: no webhook is set, so this quote wasn't sent anywhere.";lead();return}
    btn.disabled=true;btn.textContent="Sending…";
    fetch(c.webhook,{method:"POST",mode:"no-cors",body:new URLSearchParams(p)}).then(ok).catch(function(){fail()});
  });
  render();
  return{setConfig:function(n){c=norm(n);render()}};
}
window.WQ={mount:mount,DEF:DEF};
function auto(){var el=document.getElementById("wq-quote");if(el&&window.WQ_CONFIG&&!el.getAttribute("data-wq-on")){el.setAttribute("data-wq-on","1");mount(el,window.WQ_CONFIG)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",auto);else auto();
})();
