/*! Morpheus v0.1.0 | MIT License | https://github.com/romshark/morpheus */
var p=window.matchMedia("(prefers-reduced-motion: reduce)");function c(){return p.matches||document.documentElement.hasAttribute("data-pref-reduced-motion")}function g(s){p.addEventListener("change",s);let t=new MutationObserver(s);return t.observe(document.documentElement,{attributes:!0,attributeFilter:["data-pref-reduced-motion"]}),()=>{p.removeEventListener("change",s),t.disconnect()}}var M="\u65E5\uFF8A\uFF90\uFF8B\uFF70\uFF73\uFF7C\uFF85\uFF93\uFF86\uFF7B\uFF9C\uFF82\uFF75\uFF98\uFF71\uFF8E\uFF83\uFF8F\uFF79\uFF92\uFF74\uFF76\uFF77\uFF91\uFF95\uFF97\uFF7E\uFF88\uFF7D\uFF80\uFF87\uFF8D0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";function a(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}function b(s,t,e){return s.getAttribute(t)||e}function u(s,t){return s+Math.random()*(t-s)}function _(s){return s[Math.floor(Math.random()*s.length)]}var w=class extends HTMLElement{static observedAttributes=["charset","font-size","column-gap","density","fps","speed-min","speed-max","trail-min","trail-max","fade-opacity","head-color","body-color","dim-color","glow","blur","mutate-rate","max-fall-ratio","max-fall-height","fall-variance"];#n;#e;#x=[];#s=0;#r;#b;#M=!0;#d=null;#w=0;#t;#u;#a;#f;#l;#i;#o;constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.#n=t.querySelector("canvas"),this.#e=this.#n.getContext("2d",{alpha:!0}),this.#r=new ResizeObserver(()=>this.#g()),this.#b=new IntersectionObserver(e=>{this.#M=e[e.length-1].isIntersecting,this.#c()})}connectedCallback(){this.#m(),this.#r.observe(this),this.#b.observe(this),this.#d=g(()=>this.#h()),this.#h()}disconnectedCallback(){this.#v(),this.#r.disconnect(),this.#b.disconnect(),this.#d?.(),this.#d=null}#h(){if(c()){this.#v(),this.style.display="none";return}this.style.display="",this.#g(),this.#c()}#c(){this.#M&&!c()?this.#p():this.#v()}attributeChangedCallback(){this.isConnected&&(this.#m(),this.#g())}#m(){let t=this.getAttribute("charset")||M;this.#t={chars:Array.from(t),fontSize:a(this,"font-size",18),columnGap:a(this,"column-gap",1),density:a(this,"density",.88),fps:a(this,"fps",30),speedMin:a(this,"speed-min",8),speedMax:a(this,"speed-max",24),trailMin:a(this,"trail-min",9),trailMax:a(this,"trail-max",28),fadeOpacity:a(this,"fade-opacity",.09),headColor:b(this,"head-color","#eafff2"),bodyColor:b(this,"body-color","#00ff8a"),dimColor:b(this,"dim-color","#047a43"),glow:a(this,"glow",12),blur:a(this,"blur",0),mutateRate:a(this,"mutate-rate",.035),maxFallRatio:a(this,"max-fall-ratio",.72),maxFallHeight:a(this,"max-fall-height",0),fallVariance:a(this,"fall-variance",.18)},this.#t.chars.length===0&&(this.#t.chars=Array.from(M))}#g(){let t=this.getBoundingClientRect(),e=Math.max(1,t.width),i=Math.max(1,t.height),n=Math.min(window.devicePixelRatio||1,2);this.#n.width=Math.floor(e*n),this.#n.height=Math.floor(i*n),this.#n.style.width=`${e}px`,this.#n.style.height=`${i}px`,this.#e.setTransform(n,0,0,n,0,0),this.#u=e,this.#a=i,this.#f=this.#_(),this.#k(),this.#S()}#_(){return this.#t.maxFallHeight>0?Math.min(this.#a,this.#t.maxFallHeight):this.#a*Math.max(.05,Math.min(this.#t.maxFallRatio,1))}#k(){this.#l=Math.max(4,this.#t.fontSize),this.#i=Math.max(4,this.#t.fontSize+this.#t.columnGap),this.#o=Math.ceil(this.#f/this.#l)+2;let t=Math.ceil(this.#u/this.#i);this.#x=Array.from({length:t},(e,i)=>{let n=Math.random()<=this.#t.density,r=i*this.#i+u(-this.#i*.12,this.#i*.12);return this.#y(r,n)})}#y(t,e=!0){let i=Math.round(u(this.#t.trailMin,this.#t.trailMax));return{x:t,row:this.#C(),speed:u(this.#t.speedMin,this.#t.speedMax),trail:i,active:e,elapsed:0,fallLimit:this.#E(),cells:new Map}}#C(){return Math.floor(u(-this.#o,0))}#E(){let t=Math.max(0,this.#t.fallVariance),e=this.#f*Math.max(.05,1-t),i=Math.min(this.#a,this.#f*(1+t));return u(e,i)}#p(){this.#v(),!c()&&(this.#w=requestAnimationFrame(t=>this.#T(t)))}#v(){cancelAnimationFrame(this.#w)}#T(t){let e=1e3/Math.max(1,this.#t.fps);t-this.#s>=e&&(this.#s=t,this.#R()),this.#w=requestAnimationFrame(i=>this.#T(i))}#S(){this.#e.clearRect(0,0,this.#u,this.#a)}#q(){this.#e.save(),this.#e.globalCompositeOperation="destination-out",this.#e.fillStyle=`rgba(0, 0, 0, ${this.#t.fadeOpacity})`,this.#e.fillRect(0,0,this.#u,this.#a),this.#e.restore()}#R(){this.#q(),this.#e.font=`${this.#t.fontSize}px "Roboto Mono", "SFMono-Regular", Consolas, monospace`,this.#e.textAlign="center",this.#e.textBaseline="top",this.#x.forEach(t=>{t.active&&(this.#L(t),this.#I(t))})}#L(t){for(t.elapsed+=t.speed;t.elapsed>=this.#l;){t.elapsed-=this.#l,t.row+=1,t.cells.set(t.row,_(this.#t.chars));for(let e of t.cells.keys())e<t.row-t.trail&&t.cells.delete(e);if((t.row-t.trail)*this.#l>t.fallLimit){Object.assign(t,this.#y(t.x,Math.random()<=this.#t.density)),t.row=this.#C();break}}}#I(t){for(let[e,i]of t.cells){let n=i;Math.random()<this.#t.mutateRate&&(n=_(this.#t.chars),t.cells.set(e,n));let r=e*this.#l;if(r<-this.#t.fontSize||r>t.fallLimit+this.#t.fontSize)continue;let l=Math.max(0,t.row-e),f=l/Math.max(1,t.trail-1),d=Math.max(0,1-f),h=l===0;this.#e.save(),this.#e.globalAlpha=h?1:d*.72,this.#e.fillStyle=h?this.#t.headColor:f>.72?this.#t.dimColor:this.#t.bodyColor,this.#e.shadowColor=this.#t.bodyColor,this.#e.shadowBlur=h?this.#t.glow*1.4:this.#t.glow*d,this.#e.filter=this.#t.blur>0?`blur(${this.#t.blur}px)`:"none",this.#e.fillText(n,t.x,r),this.#e.restore()}}};customElements.get("matrix-rain")||customElements.define("matrix-rain",w);var k="01\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BDABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&";function S(){return k[Math.floor(Math.random()*k.length)]}function E(s,t){return s.padEnd(t," ").slice(0,t)}function y(s,t){return s+Math.random()*(t-s)}function m(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}var v=class extends HTMLElement{#n;#e;#x;#s=[];#r=0;#b=2300;#M=34;#d=28;#w=1200;#t=3600;#u=80;#a=220;#f=.6;#l=1.5;#i;#o;#h;#c;#m;#g=null;#_;#k=!0;constructor(){super(),this.#_=new IntersectionObserver(e=>{this.#k=e[e.length-1].isIntersecting,this.#y()});let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.#n=t.querySelector(".text"),this.#e=t.querySelectorAll(".glitch"),this.#x=t.querySelector("slot")}connectedCallback(){window.clearInterval(this.#i),window.clearInterval(this.#o),window.clearTimeout(this.#h),window.clearTimeout(this.#c),window.clearTimeout(this.#m),this.#i=void 0,this.#s=this.#E(),this.#b=Number(this.getAttribute("interval"))||2300,this.#M=Number(this.getAttribute("frame-delay"))||34,this.#d=Number(this.getAttribute("frames"))||28,this.#w=m(this,"flickering-interval-min",1200),this.#t=m(this,"flickering-interval-max",3600),this.#u=m(this,"flickering-duration-min",80),this.#a=m(this,"flickering-duration-max",220),this.#f=m(this,"flickering-intensity-min",.6),this.#l=m(this,"flickering-intensity-max",1.5),this.#r=0,this.#s.length===0&&(this.#s=["Server-Driven"]),this.#p(this.#s[0]),this.#_.observe(this),this.#g=g(()=>this.#y()),this.#y()}disconnectedCallback(){window.clearInterval(this.#i),window.clearInterval(this.#o),window.clearTimeout(this.#h),window.clearTimeout(this.#c),window.clearTimeout(this.#m),this.#_.disconnect(),this.#g?.(),this.#g=null}#y(){this.#k&&this.#s.length>1?this.#i===void 0&&(this.#i=window.setInterval(()=>this.#v(),this.#b)):(window.clearInterval(this.#i),this.#i=void 0),this.#k&&!c()?this.#S():this.#C()}#C(){window.clearInterval(this.#o),window.clearTimeout(this.#h),window.clearTimeout(this.#c),window.clearTimeout(this.#m),this.classList.remove("is-scrambling"),this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#p(this.#s[this.#r])}#E(){let t=this.#x.assignedNodes({flatten:!0}).map(n=>(n.textContent??"").trim()).filter(Boolean);if(t.length>0)return t;let e=(this.getAttribute("words")||"").split("|").map(n=>n.trim()).filter(Boolean);if(e.length>0)return e;let i=(this.textContent??"").trim();return i?[i]:["Server-Driven"]}#p(t){this.#n.textContent=t,this.#e.forEach(e=>{e.textContent=t})}#v(){if(this.#r=(this.#r+1)%this.#s.length,c()){this.#p(this.#s[this.#r]);return}this.#T(this.#s[this.#r])}#T(t){let e=this.#n.textContent?.trimEnd()??"",i=Math.max(e.length,t.length),n=E(t,i),r=0;window.clearInterval(this.#o),window.clearTimeout(this.#h),this.classList.add("is-scrambling"),this.#o=window.setInterval(()=>{let l=r/this.#d,f=Math.floor(l*i),d="";for(let h=0;h<i;h+=1)d+=h<f?n[h]:S();this.#p(d),r+=1,r>this.#d&&(window.clearInterval(this.#o),this.#p(t),this.#h=window.setTimeout(()=>this.classList.remove("is-scrambling"),180))},this.#M)}#S(){let t=Math.max(0,this.#w),e=Math.max(t,this.#t);e!==0&&(c()||(window.clearTimeout(this.#c),this.#c=window.setTimeout(()=>this.#q(),y(t,e))))}#q(){let t=Math.max(0,this.#u),e=Math.max(t,this.#a),i=Math.max(0,this.#f),n=Math.max(i,this.#l),r=y(i,n);this.style.setProperty("--glitch-shift",`${.035*r}em`),this.style.setProperty("--glitch-opacity",String(Math.min(r,1.6))),this.classList.add("is-flickering"),window.clearTimeout(this.#m),this.#m=window.setTimeout(()=>{this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#S()},y(t,e))}};customElements.get("glitch-cycle-text")||customElements.define("glitch-cycle-text",v);import q from"/static/datasim.js";var o=q;o.setLatency(0,0);o.setHandlerDelay(0);o.setUnreachable(!1);o.setErrorResponse("");var C={flat:{_lf_eq_60:0,_lf_eq_170:0,_lf_eq_310:0,_lf_eq_600:0,_lf_eq_1k:0,_lf_eq_3k:0,_lf_eq_6k:0,_lf_eq_12k:0,_lf_eq_14k:0,_lf_eq_16k:0},bass:{_lf_eq_60:9,_lf_eq_170:7,_lf_eq_310:4,_lf_eq_600:1,_lf_eq_1k:-1,_lf_eq_3k:-2,_lf_eq_6k:-2,_lf_eq_12k:-3,_lf_eq_14k:-4,_lf_eq_16k:-5},studio:{_lf_eq_60:4,_lf_eq_170:2,_lf_eq_310:-1,_lf_eq_600:0,_lf_eq_1k:1,_lf_eq_3k:3,_lf_eq_6k:5,_lf_eq_12k:4,_lf_eq_14k:2,_lf_eq_16k:-2}};o.post("/lf-eq/preset/:name/",async(s,t)=>{let e=s.params.name||"studio";t.patchSignals(C[e]||C.studio)});var T=s=>{let t=document.getElementById(s);return t?t.innerHTML.trim():""};o.post("/lf-select/options/",async(s,t)=>{await t.delay(500),t.patchElements(T("lf-how-section-stage-2"))});o.post("/lf-select/reset/",async(s,t)=>{t.patchElements(T("lf-how-section-stage-3"))});o.post("/lf-tree/collapse/",async(s,t)=>{let e=document.getElementById("lf-tree");if(!e)return;let i=e.cloneNode(!0);for(let n of i.querySelectorAll("neo-tree-item[expanded]"))n.removeAttribute("expanded"),n.hasAttribute("aria-expanded")&&n.setAttribute("aria-expanded","false");t.patchElements(i.outerHTML)});var x=s=>s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"),R=["Open Release Notes","release-2026.05.txt","Release pipeline settings","Changelog 2026.05","Tag version v2026.06","#releases channel","Draft release v2026.06","Pipeline status","Rollback last release"];o.post("/lf-search/suggest/",async(s,t)=>{let e=String(s.signals?.lf_search_q??""),i=e.trim().toLowerCase(),n=i?R.filter(l=>l.toLowerCase().includes(i)).slice(0,6):[],r;i&&n.length===0?r=`<div data-neo-empty-results>No matches for "${x(e.trim())}". Try release, changelog, tag, pipeline, or channel.</div>`:r=n.map(l=>`<neo-option value="${x(l)}">${x(l)}</neo-option>`).join(""),t.patchElements(`<neo-datalist id="lf-search-suggestions" slot="suggestions">${r}</neo-datalist>`)});
