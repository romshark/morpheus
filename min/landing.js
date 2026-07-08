/*! Morpheus v0.1.0 | MIT License | https://github.com/romshark/morpheus */
var p=window.matchMedia("(prefers-reduced-motion: reduce)");function c(){return p.matches||document.documentElement.hasAttribute("data-pref-reduced-motion")}function g(s){p.addEventListener("change",s);let t=new MutationObserver(s);return t.observe(document.documentElement,{attributes:!0,attributeFilter:["data-pref-reduced-motion"]}),()=>{p.removeEventListener("change",s),t.disconnect()}}var _="\u65E5\uFF8A\uFF90\uFF8B\uFF70\uFF73\uFF7C\uFF85\uFF93\uFF86\uFF7B\uFF9C\uFF82\uFF75\uFF98\uFF71\uFF8E\uFF83\uFF8F\uFF79\uFF92\uFF74\uFF76\uFF77\uFF91\uFF95\uFF97\uFF7E\uFF88\uFF7D\uFF80\uFF87\uFF8D0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";function a(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}function b(s,t,e){return s.getAttribute(t)||e}function u(s,t){return s+Math.random()*(t-s)}function v(s){return s[Math.floor(Math.random()*s.length)]}var w=class extends HTMLElement{static observedAttributes=["charset","font-size","column-gap","density","fps","speed-min","speed-max","trail-min","trail-max","fade-opacity","head-color","body-color","dim-color","glow","blur","mutate-rate","max-fall-ratio","max-fall-height","fall-variance"];#s;#e;#M=[];#i=0;#n;#g=null;#p=0;#t;#c;#r;#m;#a;#h;#x;constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`
      <style>
        :host {
          display: block;
          contain: strict;
          overflow: hidden;
          pointer-events: none;
        }

        canvas {
          display: block;
          width: 100%;
          height: 100%;
        }
      </style>
      <canvas part="canvas"></canvas>
    `,this.#s=t.querySelector("canvas"),this.#e=this.#s.getContext("2d",{alpha:!0}),this.#n=new ResizeObserver(()=>this.#o())}connectedCallback(){this.#l(),this.#n.observe(this),this.#g=g(()=>this.#b()),this.#b()}disconnectedCallback(){this.#_(),this.#n.disconnect(),this.#g?.(),this.#g=null}#b(){if(c()){this.#_(),this.style.display="none";return}this.style.display="",this.#o(),this.#f()}attributeChangedCallback(){this.isConnected&&(this.#l(),this.#o())}#l(){let t=this.getAttribute("charset")||_;this.#t={chars:Array.from(t),fontSize:a(this,"font-size",18),columnGap:a(this,"column-gap",1),density:a(this,"density",.88),fps:a(this,"fps",30),speedMin:a(this,"speed-min",8),speedMax:a(this,"speed-max",24),trailMin:a(this,"trail-min",9),trailMax:a(this,"trail-max",28),fadeOpacity:a(this,"fade-opacity",.09),headColor:b(this,"head-color","#eafff2"),bodyColor:b(this,"body-color","#00ff8a"),dimColor:b(this,"dim-color","#047a43"),glow:a(this,"glow",12),blur:a(this,"blur",0),mutateRate:a(this,"mutate-rate",.035),maxFallRatio:a(this,"max-fall-ratio",.72),maxFallHeight:a(this,"max-fall-height",0),fallVariance:a(this,"fall-variance",.18)},this.#t.chars.length===0&&(this.#t.chars=Array.from(_))}#o(){let t=this.getBoundingClientRect(),e=Math.max(1,t.width),i=Math.max(1,t.height),n=Math.min(window.devicePixelRatio||1,2);this.#s.width=Math.floor(e*n),this.#s.height=Math.floor(i*n),this.#s.style.width=`${e}px`,this.#s.style.height=`${i}px`,this.#e.setTransform(n,0,0,n,0,0),this.#c=e,this.#r=i,this.#m=this.#d(),this.#u(),this.#k()}#d(){return this.#t.maxFallHeight>0?Math.min(this.#r,this.#t.maxFallHeight):this.#r*Math.max(.05,Math.min(this.#t.maxFallRatio,1))}#u(){this.#a=Math.max(4,this.#t.fontSize),this.#h=Math.max(4,this.#t.fontSize+this.#t.columnGap),this.#x=Math.ceil(this.#m/this.#a)+2;let t=Math.ceil(this.#c/this.#h);this.#M=Array.from({length:t},(e,i)=>{let n=Math.random()<=this.#t.density,r=i*this.#h+u(-this.#h*.12,this.#h*.12);return this.#w(r,n)})}#w(t,e=!0){let i=Math.round(u(this.#t.trailMin,this.#t.trailMax));return{x:t,row:this.#y(),speed:u(this.#t.speedMin,this.#t.speedMax),trail:i,active:e,elapsed:0,fallLimit:this.#C(),cells:new Map}}#y(){return Math.floor(u(-this.#x,0))}#C(){let t=Math.max(0,this.#t.fallVariance),e=this.#m*Math.max(.05,1-t),i=Math.min(this.#r,this.#m*(1+t));return u(e,i)}#f(){this.#_(),!c()&&(this.#p=requestAnimationFrame(t=>this.#v(t)))}#_(){cancelAnimationFrame(this.#p)}#v(t){let e=1e3/Math.max(1,this.#t.fps);t-this.#i>=e&&(this.#i=t,this.#E()),this.#p=requestAnimationFrame(i=>this.#v(i))}#k(){this.#e.clearRect(0,0,this.#c,this.#r)}#T(){this.#e.save(),this.#e.globalCompositeOperation="destination-out",this.#e.fillStyle=`rgba(0, 0, 0, ${this.#t.fadeOpacity})`,this.#e.fillRect(0,0,this.#c,this.#r),this.#e.restore()}#E(){this.#T(),this.#e.font=`${this.#t.fontSize}px "Roboto Mono", "SFMono-Regular", Consolas, monospace`,this.#e.textAlign="center",this.#e.textBaseline="top",this.#M.forEach(t=>{t.active&&(this.#S(t),this.#q(t))})}#S(t){for(t.elapsed+=t.speed;t.elapsed>=this.#a;){t.elapsed-=this.#a,t.row+=1,t.cells.set(t.row,v(this.#t.chars));for(let e of t.cells.keys())e<t.row-t.trail&&t.cells.delete(e);if((t.row-t.trail)*this.#a>t.fallLimit){Object.assign(t,this.#w(t.x,Math.random()<=this.#t.density)),t.row=this.#y();break}}}#q(t){for(let[e,i]of t.cells){let n=i;Math.random()<this.#t.mutateRate&&(n=v(this.#t.chars),t.cells.set(e,n));let r=e*this.#a;if(r<-this.#t.fontSize||r>t.fallLimit+this.#t.fontSize)continue;let l=Math.max(0,t.row-e),f=l/Math.max(1,t.trail-1),d=Math.max(0,1-f),h=l===0;this.#e.save(),this.#e.globalAlpha=h?1:d*.72,this.#e.fillStyle=h?this.#t.headColor:f>.72?this.#t.dimColor:this.#t.bodyColor,this.#e.shadowColor=this.#t.bodyColor,this.#e.shadowBlur=h?this.#t.glow*1.4:this.#t.glow*d,this.#e.filter=this.#t.blur>0?`blur(${this.#t.blur}px)`:"none",this.#e.fillText(n,t.x,r),this.#e.restore()}}};customElements.get("matrix-rain")||customElements.define("matrix-rain",w);var k="01\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BDABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&";function E(){return k[Math.floor(Math.random()*k.length)]}function S(s,t){return s.padEnd(t," ").slice(0,t)}function M(s,t){return s+Math.random()*(t-s)}function m(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}var x=class extends HTMLElement{#s;#e;#M;#i=[];#n=0;#g=2300;#p=34;#t=28;#c=1200;#r=3600;#m=80;#a=220;#h=.6;#x=1.5;#b;#l;#o;#d;#u;#w=null;constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`
      <style>
        :host {
          position: relative;
          display: inline-grid;
          white-space: nowrap;
          /* Host line-height (1/1.05 on .landing-brand/.landing-slogan)
           * cascades into the shadow DOM and clips g/j/p/y descenders
           * at multi-rem font-size. 1.15 is the smallest value that
           * keeps them inside the box across all cycled phrases. */
          line-height: 1.15;
        }

        .text,
        .glitch {
          grid-area: 1 / 1;
          display: inline-block;
          width: var(--glitch-text-width, 17ch);
          max-width: 100%;
          overflow: visible;
          white-space: nowrap;
        }

        .glitch {
          pointer-events: none;
          opacity: 0;
        }

        .glitch-left {
          color: #ff3f7f;
          transform: translateX(calc(var(--glitch-shift, 0.035em) * -1));
        }

        .glitch-right {
          color: var(--cyan, #6ef7ff);
          transform: translateX(var(--glitch-shift, 0.035em));
        }

        :host(.is-scrambling) .glitch-left,
        :host(.is-flickering) .glitch-left {
          animation: glitch-left 120ms steps(2, end) infinite;
        }

        :host(.is-scrambling) .glitch-right,
        :host(.is-flickering) .glitch-right {
          animation: glitch-right 150ms steps(2, end) infinite;
        }

        @keyframes glitch-left {
          0%,
          100% {
            clip-path: inset(0 0 82% 0);
            opacity: calc(0.82 * var(--glitch-opacity, 1));
          }

          35% {
            clip-path: inset(36% 0 46% 0);
          }

          70% {
            clip-path: inset(74% 0 4% 0);
          }
        }

        @keyframes glitch-right {
          0%,
          100% {
            clip-path: inset(72% 0 8% 0);
            opacity: calc(0.72 * var(--glitch-opacity, 1));
          }

          42% {
            clip-path: inset(12% 0 70% 0);
          }

          78% {
            clip-path: inset(46% 0 28% 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :host(.is-scrambling) .glitch-left,
          :host(.is-scrambling) .glitch-right,
          :host(.is-flickering) .glitch-left,
          :host(.is-flickering) .glitch-right {
            animation: none;
          }
        }
      </style>
      <span class="text" part="text"></span>
      <span class="glitch glitch-left" aria-hidden="true"></span>
      <span class="glitch glitch-right" aria-hidden="true"></span>
      <slot hidden></slot>
    `,this.#s=t.querySelector(".text"),this.#e=t.querySelectorAll(".glitch"),this.#M=t.querySelector("slot")}connectedCallback(){window.clearInterval(this.#b),window.clearInterval(this.#l),window.clearTimeout(this.#o),window.clearTimeout(this.#d),window.clearTimeout(this.#u),this.#i=this.#C(),this.#g=Number(this.getAttribute("interval"))||2300,this.#p=Number(this.getAttribute("frame-delay"))||34,this.#t=Number(this.getAttribute("frames"))||28,this.#c=m(this,"flickering-interval-min",1200),this.#r=m(this,"flickering-interval-max",3600),this.#m=m(this,"flickering-duration-min",80),this.#a=m(this,"flickering-duration-max",220),this.#h=m(this,"flickering-intensity-min",.6),this.#x=m(this,"flickering-intensity-max",1.5),this.#n=0,this.#i.length===0&&(this.#i=["Server-Driven"]),this.#f(this.#i[0]),this.#i.length>1&&(this.#b=window.setInterval(()=>this.#_(),this.#g)),this.#w=g(()=>this.#y()),this.#y()}disconnectedCallback(){window.clearInterval(this.#b),window.clearInterval(this.#l),window.clearTimeout(this.#o),window.clearTimeout(this.#d),window.clearTimeout(this.#u),this.#w?.(),this.#w=null}#y(){if(!c()){this.#k();return}window.clearInterval(this.#l),window.clearTimeout(this.#o),window.clearTimeout(this.#d),window.clearTimeout(this.#u),this.classList.remove("is-scrambling"),this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#f(this.#i[this.#n])}#C(){let t=this.#M.assignedNodes({flatten:!0}).map(n=>(n.textContent??"").trim()).filter(Boolean);if(t.length>0)return t;let e=(this.getAttribute("words")||"").split("|").map(n=>n.trim()).filter(Boolean);if(e.length>0)return e;let i=(this.textContent??"").trim();return i?[i]:["Server-Driven"]}#f(t){this.#s.textContent=t,this.#e.forEach(e=>{e.textContent=t})}#_(){if(this.#n=(this.#n+1)%this.#i.length,c()){this.#f(this.#i[this.#n]);return}this.#v(this.#i[this.#n])}#v(t){let e=this.#s.textContent?.trimEnd()??"",i=Math.max(e.length,t.length),n=S(t,i),r=0;window.clearInterval(this.#l),window.clearTimeout(this.#o),this.classList.add("is-scrambling"),this.#l=window.setInterval(()=>{let l=r/this.#t,f=Math.floor(l*i),d="";for(let h=0;h<i;h+=1)d+=h<f?n[h]:E();this.#f(d),r+=1,r>this.#t&&(window.clearInterval(this.#l),this.#f(t),this.#o=window.setTimeout(()=>this.classList.remove("is-scrambling"),180))},this.#p)}#k(){let t=Math.max(0,this.#c),e=Math.max(t,this.#r);e!==0&&(c()||(window.clearTimeout(this.#d),this.#d=window.setTimeout(()=>this.#T(),M(t,e))))}#T(){let t=Math.max(0,this.#m),e=Math.max(t,this.#a),i=Math.max(0,this.#h),n=Math.max(i,this.#x),r=M(i,n);this.style.setProperty("--glitch-shift",`${.035*r}em`),this.style.setProperty("--glitch-opacity",String(Math.min(r,1.6))),this.classList.add("is-flickering"),window.clearTimeout(this.#u),this.#u=window.setTimeout(()=>{this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#k()},M(t,e))}};customElements.get("glitch-cycle-text")||customElements.define("glitch-cycle-text",x);import q from"/static/datasim.js";var o=q;o.setLatency(0,0);o.setHandlerDelay(0);o.setUnreachable(!1);o.setErrorResponse("");var C={flat:{_lf_eq_60:0,_lf_eq_170:0,_lf_eq_310:0,_lf_eq_600:0,_lf_eq_1k:0,_lf_eq_3k:0,_lf_eq_6k:0,_lf_eq_12k:0,_lf_eq_14k:0,_lf_eq_16k:0},bass:{_lf_eq_60:9,_lf_eq_170:7,_lf_eq_310:4,_lf_eq_600:1,_lf_eq_1k:-1,_lf_eq_3k:-2,_lf_eq_6k:-2,_lf_eq_12k:-3,_lf_eq_14k:-4,_lf_eq_16k:-5},studio:{_lf_eq_60:4,_lf_eq_170:2,_lf_eq_310:-1,_lf_eq_600:0,_lf_eq_1k:1,_lf_eq_3k:3,_lf_eq_6k:5,_lf_eq_12k:4,_lf_eq_14k:2,_lf_eq_16k:-2}};o.post("/lf-eq/preset/:name/",async(s,t)=>{let e=s.params.name||"studio";t.patchSignals(C[e]||C.studio)});var T=s=>{let t=document.getElementById(s);return t?t.innerHTML.trim():""};o.post("/lf-select/options/",async(s,t)=>{await t.delay(500),t.patchElements(T("lf-how-section-stage-2"))});o.post("/lf-select/reset/",async(s,t)=>{t.patchElements(T("lf-how-section-stage-3"))});o.post("/lf-tree/collapse/",async(s,t)=>{let e=document.getElementById("lf-tree");if(!e)return;let i=e.cloneNode(!0);for(let n of i.querySelectorAll("neo-tree-item[expanded]"))n.removeAttribute("expanded"),n.hasAttribute("aria-expanded")&&n.setAttribute("aria-expanded","false");t.patchElements(i.outerHTML)});var y=s=>s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"),R=["Open Release Notes","release-2026.05.txt","Release pipeline settings","Changelog 2026.05","Tag version v2026.06","#releases channel","Draft release v2026.06","Pipeline status","Rollback last release"];o.post("/lf-search/suggest/",async(s,t)=>{let e=String(s.signals?.lf_search_q??""),i=e.trim().toLowerCase(),n=i?R.filter(l=>l.toLowerCase().includes(i)).slice(0,6):[],r;i&&n.length===0?r=`<div data-neo-empty-results>No matches for "${y(e.trim())}". Try release, changelog, tag, pipeline, or channel.</div>`:r=n.map(l=>`<neo-option value="${y(l)}">${y(l)}</neo-option>`).join(""),t.patchElements(`<neo-datalist id="lf-search-suggestions" slot="suggestions">${r}</neo-datalist>`)});
