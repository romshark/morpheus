/*! Morpheus v0.1.0 | MIT License | https://github.com/romshark/morpheus */
var b=window.matchMedia("(prefers-reduced-motion: reduce)");function h(){return b.matches||document.documentElement.hasAttribute("data-pref-reduced-motion")}function g(s){b.addEventListener("change",s);let t=new MutationObserver(s);return t.observe(document.documentElement,{attributes:!0,attributeFilter:["data-pref-reduced-motion"]}),()=>{b.removeEventListener("change",s),t.disconnect()}}var _="\u65E5\uFF8A\uFF90\uFF8B\uFF70\uFF73\uFF7C\uFF85\uFF93\uFF86\uFF7B\uFF9C\uFF82\uFF75\uFF98\uFF71\uFF8E\uFF83\uFF8F\uFF79\uFF92\uFF74\uFF76\uFF77\uFF91\uFF95\uFF97\uFF7E\uFF88\uFF7D\uFF80\uFF87\uFF8D0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";function a(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}function w(s,t,e){return s.getAttribute(t)||e}function u(s,t){return s+Math.random()*(t-s)}function k(s){return s[Math.floor(Math.random()*s.length)]}var x=class extends HTMLElement{static observedAttributes=["charset","font-size","column-gap","density","fps","speed-min","speed-max","trail-min","trail-max","fade-opacity","head-color","body-color","dim-color","glow","blur","mutate-rate","max-fall-ratio","max-fall-height","fall-variance"];#s;#e;#y=[];#M=0;#i;#n;#v=!0;#b=null;#f=0;#t;#g;#o;#p;#l;#m;#r;constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.#s=t.querySelector("canvas"),this.#e=this.#s.getContext("2d",{alpha:!0}),this.#i=new ResizeObserver(()=>this.#c()),this.#n=new IntersectionObserver(e=>{this.#v=e[e.length-1].isIntersecting,this.#d()})}connectedCallback(){this.#u(),this.#i.observe(this),this.#n.observe(this),this.#b=g(()=>this.#h()),this.#h()}disconnectedCallback(){this.#a(),this.#i.disconnect(),this.#n.disconnect(),this.#b?.(),this.#b=null}#h(){if(h()){this.#a(),this.style.display="none";return}this.style.display="",this.#c(),this.#d()}#d(){this.#v&&!h()?this.#E():this.#a()}attributeChangedCallback(){this.isConnected&&(this.#u(),this.#c())}#u(){let t=this.getAttribute("charset")||_;this.#t={chars:Array.from(t),fontSize:a(this,"font-size",18),columnGap:a(this,"column-gap",1),density:a(this,"density",.88),fps:a(this,"fps",30),speedMin:a(this,"speed-min",8),speedMax:a(this,"speed-max",24),trailMin:a(this,"trail-min",9),trailMax:a(this,"trail-max",28),fadeOpacity:a(this,"fade-opacity",.09),headColor:w(this,"head-color","#eafff2"),bodyColor:w(this,"body-color","#00ff8a"),dimColor:w(this,"dim-color","#047a43"),glow:a(this,"glow",12),blur:a(this,"blur",0),mutateRate:a(this,"mutate-rate",.035),maxFallRatio:a(this,"max-fall-ratio",.72),maxFallHeight:a(this,"max-fall-height",0),fallVariance:a(this,"fall-variance",.18)},this.#t.chars.length===0&&(this.#t.chars=Array.from(_))}#c(){let t=this.getBoundingClientRect(),e=Math.max(1,t.width),i=Math.max(1,t.height),n=Math.min(window.devicePixelRatio||1,2);this.#s.width=Math.floor(e*n),this.#s.height=Math.floor(i*n),this.#s.style.width=`${e}px`,this.#s.style.height=`${i}px`,this.#e.setTransform(n,0,0,n,0,0),this.#g=e,this.#o=i,this.#p=this.#_(),this.#k(),this.#q()}#_(){return this.#t.maxFallHeight>0?Math.min(this.#o,this.#t.maxFallHeight):this.#o*Math.max(.05,Math.min(this.#t.maxFallRatio,1))}#k(){this.#l=Math.max(4,this.#t.fontSize),this.#m=Math.max(4,this.#t.fontSize+this.#t.columnGap),this.#r=Math.ceil(this.#p/this.#l)+2;let t=Math.ceil(this.#g/this.#m);this.#y=Array.from({length:t},(e,i)=>{let n=Math.random()<=this.#t.density,r=i*this.#m+u(-this.#m*.12,this.#m*.12);return this.#w(r,n)})}#w(t,e=!0){let i=Math.round(u(this.#t.trailMin,this.#t.trailMax));return{x:t,row:this.#x(),speed:u(this.#t.speedMin,this.#t.speedMax),trail:i,active:e,elapsed:0,fallLimit:this.#S(),cells:new Map}}#x(){return Math.floor(u(-this.#r,0))}#S(){let t=Math.max(0,this.#t.fallVariance),e=this.#p*Math.max(.05,1-t),i=Math.min(this.#o,this.#p*(1+t));return u(e,i)}#E(){this.#a(),!h()&&(this.#f=requestAnimationFrame(t=>this.#T(t)))}#a(){cancelAnimationFrame(this.#f)}#T(t){let e=1e3/Math.max(1,this.#t.fps);t-this.#M>=e&&(this.#M=t,this.#R()),this.#f=requestAnimationFrame(i=>this.#T(i))}#q(){this.#e.clearRect(0,0,this.#g,this.#o)}#C(){this.#e.save(),this.#e.globalCompositeOperation="destination-out",this.#e.fillStyle=`rgba(0, 0, 0, ${this.#t.fadeOpacity})`,this.#e.fillRect(0,0,this.#g,this.#o),this.#e.restore()}#R(){this.#C();let t=this.#e;t.font=`${this.#t.fontSize}px "Roboto Mono", "SFMono-Regular", Consolas, monospace`,t.textAlign="center",t.textBaseline="top",t.shadowColor=this.#t.bodyColor;let e=this.#t.blur>0;e&&(t.filter=`blur(${this.#t.blur}px)`),this.#y.forEach(i=>{i.active&&(this.#L(i),this.#I(i))}),t.globalAlpha=1,t.shadowBlur=0,e&&(t.filter="none")}#L(t){for(t.elapsed+=t.speed;t.elapsed>=this.#l;){t.elapsed-=this.#l,t.row+=1,t.cells.set(t.row,k(this.#t.chars));for(let e of t.cells.keys())e<t.row-t.trail&&t.cells.delete(e);if((t.row-t.trail)*this.#l>t.fallLimit){Object.assign(t,this.#w(t.x,Math.random()<=this.#t.density)),t.row=this.#x();break}}}#I(t){let e=this.#e;for(let[i,n]of t.cells){let r=n;Math.random()<this.#t.mutateRate&&(r=k(this.#t.chars),t.cells.set(i,r));let o=i*this.#l;if(o<-this.#t.fontSize||o>t.fallLimit+this.#t.fontSize)continue;let f=Math.max(0,t.row-i),d=f/Math.max(1,t.trail-1),c=Math.max(0,1-d),p=f===0;e.globalAlpha=p?1:c*.72,e.fillStyle=p?this.#t.headColor:d>.72?this.#t.dimColor:this.#t.bodyColor,e.shadowBlur=p?this.#t.glow*1.4:this.#t.glow*c,e.fillText(r,t.x,o)}}};customElements.get("matrix-rain")||customElements.define("matrix-rain",x);var T="01\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BDABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&";function E(){return T[Math.floor(Math.random()*T.length)]}function q(s,t){return s.padEnd(t," ").slice(0,t)}function y(s,t){return s+Math.random()*(t-s)}function m(s,t,e){let i=Number(s.getAttribute(t));return Number.isFinite(i)?i:e}var M=class extends HTMLElement{#s;#e;#y;#M;#i=[];#n=0;#v=2300;#b=34;#f=28;#t=1200;#g=3600;#o=80;#p=220;#l=.6;#m=1.5;#r;#h;#d;#u;#c;#_=null;#k;#w=!0;constructor(){super(),this.#k=new IntersectionObserver(e=>{this.#w=e[e.length-1].isIntersecting,this.#x()});let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.#s=t.querySelector(".text"),this.#e=t.querySelectorAll(".glitch"),this.#y=t.querySelector("slot"),this.#M=[this.#s,...this.#e].map(e=>{let i=document.createTextNode("");return e.appendChild(i),i})}connectedCallback(){window.clearInterval(this.#r),window.clearInterval(this.#h),window.clearTimeout(this.#d),window.clearTimeout(this.#u),window.clearTimeout(this.#c),this.#r=void 0,this.#i=this.#E(),this.#v=Number(this.getAttribute("interval"))||2300,this.#b=Number(this.getAttribute("frame-delay"))||34,this.#f=Number(this.getAttribute("frames"))||28,this.#t=m(this,"flickering-interval-min",1200),this.#g=m(this,"flickering-interval-max",3600),this.#o=m(this,"flickering-duration-min",80),this.#p=m(this,"flickering-duration-max",220),this.#l=m(this,"flickering-intensity-min",.6),this.#m=m(this,"flickering-intensity-max",1.5),this.#n=0,this.#i.length===0&&(this.#i=["Server-Driven"]),this.#a(this.#i[0]),this.#k.observe(this),this.#_=g(()=>this.#x()),this.#x()}disconnectedCallback(){window.clearInterval(this.#r),window.clearInterval(this.#h),window.clearTimeout(this.#d),window.clearTimeout(this.#u),window.clearTimeout(this.#c),this.#k.disconnect(),this.#_?.(),this.#_=null}#x(){this.#w&&this.#i.length>1?this.#r===void 0&&(this.#r=window.setInterval(()=>this.#T(),this.#v)):(window.clearInterval(this.#r),this.#r=void 0),this.#w&&!h()?this.#C():this.#S()}#S(){window.clearInterval(this.#h),window.clearTimeout(this.#d),window.clearTimeout(this.#u),window.clearTimeout(this.#c),this.classList.remove("is-scrambling"),this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#a(this.#i[this.#n])}#E(){let t=this.#y.assignedNodes({flatten:!0}).map(n=>(n.textContent??"").trim()).filter(Boolean);if(t.length>0)return t;let e=(this.getAttribute("words")||"").split("|").map(n=>n.trim()).filter(Boolean);if(e.length>0)return e;let i=(this.textContent??"").trim();return i?[i]:["Server-Driven"]}#a(t){for(let e of this.#M)e.data=t}#T(){if(this.#n=(this.#n+1)%this.#i.length,h()){this.#a(this.#i[this.#n]);return}this.#q(this.#i[this.#n])}#q(t){let e=this.#s.textContent?.trimEnd()??"",i=Math.max(e.length,t.length),n=q(t,i),r=0;window.clearInterval(this.#h),window.clearTimeout(this.#d),this.classList.add("is-scrambling"),this.#h=window.setInterval(()=>{let o=r/this.#f,f=Math.floor(o*i),d="";for(let c=0;c<i;c+=1)d+=c<f?n[c]:E();this.#a(d),r+=1,r>this.#f&&(window.clearInterval(this.#h),this.#a(t),this.#d=window.setTimeout(()=>this.classList.remove("is-scrambling"),180))},this.#b)}#C(){let t=Math.max(0,this.#t),e=Math.max(t,this.#g);e!==0&&(h()||(window.clearTimeout(this.#u),this.#u=window.setTimeout(()=>this.#R(),y(t,e))))}#R(){let t=Math.max(0,this.#o),e=Math.max(t,this.#p),i=Math.max(0,this.#l),n=Math.max(i,this.#m),r=y(i,n);this.style.setProperty("--glitch-shift",`${.035*r}em`),this.style.setProperty("--glitch-opacity",String(Math.min(r,1.6))),this.classList.add("is-flickering"),window.clearTimeout(this.#c),this.#c=window.setTimeout(()=>{this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.#C()},y(t,e))}};customElements.get("glitch-cycle-text")||customElements.define("glitch-cycle-text",M);import R from"/static/datasim.js";var l=R;l.setLatency(0,0);l.setHandlerDelay(0);l.setUnreachable(!1);l.setErrorResponse("");var C={flat:{_lf_eq_60:0,_lf_eq_170:0,_lf_eq_310:0,_lf_eq_600:0,_lf_eq_1k:0,_lf_eq_3k:0,_lf_eq_6k:0,_lf_eq_12k:0,_lf_eq_14k:0,_lf_eq_16k:0},bass:{_lf_eq_60:9,_lf_eq_170:7,_lf_eq_310:4,_lf_eq_600:1,_lf_eq_1k:-1,_lf_eq_3k:-2,_lf_eq_6k:-2,_lf_eq_12k:-3,_lf_eq_14k:-4,_lf_eq_16k:-5},studio:{_lf_eq_60:4,_lf_eq_170:2,_lf_eq_310:-1,_lf_eq_600:0,_lf_eq_1k:1,_lf_eq_3k:3,_lf_eq_6k:5,_lf_eq_12k:4,_lf_eq_14k:2,_lf_eq_16k:-2}};l.post("/lf-eq/preset/:name/",async(s,t)=>{let e=s.params.name||"studio";t.patchSignals(C[e]||C.studio)});var S=s=>{let t=document.getElementById(s);return t?t.innerHTML.trim():""};l.post("/lf-select/options/",async(s,t)=>{await t.delay(500),t.patchElements(S("lf-how-section-stage-2"))});l.post("/lf-select/reset/",async(s,t)=>{t.patchElements(S("lf-how-section-stage-3"))});l.post("/lf-tree/collapse/",async(s,t)=>{let e=document.getElementById("lf-tree");if(!e)return;let n=new DOMParser().parseFromString(e.outerHTML,"text/html").getElementById("lf-tree");if(n){for(let r of n.querySelectorAll("neo-tree-item[expanded]"))r.setAttribute("expanded","false");t.patchElements(n.outerHTML,{mode:"replace"})}});var v=s=>s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"),L=["Open Release Notes","release-2026.05.txt","Release pipeline settings","Changelog 2026.05","Tag version v2026.06","#releases channel","Draft release v2026.06","Pipeline status","Rollback last release"];l.post("/lf-search/suggest/",async(s,t)=>{let e=String(s.signals?.lf_search_q??""),i=e.trim().toLowerCase(),n=i?L.filter(o=>o.toLowerCase().includes(i)).slice(0,6):[],r;i&&n.length===0?r=`<div data-neo-empty-results>No matches for "${v(e.trim())}". Try release, changelog, tag, pipeline, or channel.</div>`:r=n.map(o=>`<neo-option value="${v(o)}">${v(o)}</neo-option>`).join(""),t.patchElements(`<neo-datalist id="lf-search-suggestions" slot="suggestions">${r}</neo-datalist>`)});
