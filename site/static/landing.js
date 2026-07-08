var b=window.matchMedia("(prefers-reduced-motion: reduce)");function c(){return b.matches||document.documentElement.hasAttribute("data-pref-reduced-motion")}function g(i){b.addEventListener("change",i);let r=new MutationObserver(i);return r.observe(document.documentElement,{attributes:!0,attributeFilter:["data-pref-reduced-motion"]}),()=>{b.removeEventListener("change",i),r.disconnect()}}var y="\u65E5\uFF8A\uFF90\uFF8B\uFF70\uFF73\uFF7C\uFF85\uFF93\uFF86\uFF7B\uFF9C\uFF82\uFF75\uFF98\uFF71\uFF8E\uFF83\uFF8F\uFF79\uFF92\uFF74\uFF76\uFF77\uFF91\uFF95\uFF97\uFF7E\uFF88\uFF7D\uFF80\uFF87\uFF8D0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";function a(i,r,t){let e=Number(i.getAttribute(r));return Number.isFinite(e)?e:t}function x(i,r,t){return i.getAttribute(r)||t}function u(i,r){return i+Math.random()*(r-i)}function _(i){return i[Math.floor(Math.random()*i.length)]}var v=class extends HTMLElement{constructor(){super();this.columns=[];this.lastFrameTime=0;this.unwatchReducedMotion=null;this.animationFrame=0;let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.canvas=t.querySelector("canvas"),this.context=this.canvas.getContext("2d",{alpha:!0}),this.resizeObserver=new ResizeObserver(()=>this.resize())}connectedCallback(){this.readOptions(),this.resizeObserver.observe(this),this.unwatchReducedMotion=g(()=>this.applyReducedMotion()),this.applyReducedMotion()}disconnectedCallback(){this.stop(),this.resizeObserver.disconnect(),this.unwatchReducedMotion?.(),this.unwatchReducedMotion=null}applyReducedMotion(){if(c()){this.stop(),this.style.display="none";return}this.style.display="",this.resize(),this.start()}attributeChangedCallback(){this.isConnected&&(this.readOptions(),this.resize())}readOptions(){let t=this.getAttribute("charset")||y;this.options={chars:Array.from(t),fontSize:a(this,"font-size",18),columnGap:a(this,"column-gap",1),density:a(this,"density",.88),fps:a(this,"fps",30),speedMin:a(this,"speed-min",8),speedMax:a(this,"speed-max",24),trailMin:a(this,"trail-min",9),trailMax:a(this,"trail-max",28),fadeOpacity:a(this,"fade-opacity",.09),headColor:x(this,"head-color","#eafff2"),bodyColor:x(this,"body-color","#00ff8a"),dimColor:x(this,"dim-color","#047a43"),glow:a(this,"glow",12),blur:a(this,"blur",0),mutateRate:a(this,"mutate-rate",.035),maxFallRatio:a(this,"max-fall-ratio",.72),maxFallHeight:a(this,"max-fall-height",0),fallVariance:a(this,"fall-variance",.18)},this.options.chars.length===0&&(this.options.chars=Array.from(y))}resize(){let t=this.getBoundingClientRect(),e=Math.max(1,t.width),s=Math.max(1,t.height),n=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.floor(e*n),this.canvas.height=Math.floor(s*n),this.canvas.style.width=`${e}px`,this.canvas.style.height=`${s}px`,this.context.setTransform(n,0,0,n,0,0),this.width=e,this.height=s,this.fallLimit=this.resolveFallLimit(),this.createColumns(),this.clear()}resolveFallLimit(){return this.options.maxFallHeight>0?Math.min(this.height,this.options.maxFallHeight):this.height*Math.max(.05,Math.min(this.options.maxFallRatio,1))}createColumns(){this.cellHeight=Math.max(4,this.options.fontSize),this.columnStep=Math.max(4,this.options.fontSize+this.options.columnGap),this.rowCount=Math.ceil(this.fallLimit/this.cellHeight)+2;let t=Math.ceil(this.width/this.columnStep);this.columns=Array.from({length:t},(e,s)=>{let n=Math.random()<=this.options.density,o=s*this.columnStep+u(-this.columnStep*.12,this.columnStep*.12);return this.createColumn(o,n)})}createColumn(t,e=!0){let s=Math.round(u(this.options.trailMin,this.options.trailMax));return{x:t,row:this.randomTopStartRow(),speed:u(this.options.speedMin,this.options.speedMax),trail:s,active:e,elapsed:0,fallLimit:this.randomColumnFallLimit(),cells:new Map}}randomTopStartRow(){return Math.floor(u(-this.rowCount,0))}randomColumnFallLimit(){let t=Math.max(0,this.options.fallVariance),e=this.fallLimit*Math.max(.05,1-t),s=Math.min(this.height,this.fallLimit*(1+t));return u(e,s)}start(){this.stop(),!c()&&(this.animationFrame=requestAnimationFrame(t=>this.tick(t)))}stop(){cancelAnimationFrame(this.animationFrame)}tick(t){let e=1e3/Math.max(1,this.options.fps);t-this.lastFrameTime>=e&&(this.lastFrameTime=t,this.drawFrame()),this.animationFrame=requestAnimationFrame(s=>this.tick(s))}clear(){this.context.clearRect(0,0,this.width,this.height)}fadePreviousFrame(){this.context.save(),this.context.globalCompositeOperation="destination-out",this.context.fillStyle=`rgba(0, 0, 0, ${this.options.fadeOpacity})`,this.context.fillRect(0,0,this.width,this.height),this.context.restore()}drawFrame(){this.fadePreviousFrame(),this.context.font=`${this.options.fontSize}px "Roboto Mono", "SFMono-Regular", Consolas, monospace`,this.context.textAlign="center",this.context.textBaseline="top",this.columns.forEach(t=>{t.active&&(this.advanceColumn(t),this.drawColumn(t))})}advanceColumn(t){for(t.elapsed+=t.speed;t.elapsed>=this.cellHeight;){t.elapsed-=this.cellHeight,t.row+=1,t.cells.set(t.row,_(this.options.chars));for(let e of t.cells.keys())e<t.row-t.trail&&t.cells.delete(e);if((t.row-t.trail)*this.cellHeight>t.fallLimit){Object.assign(t,this.createColumn(t.x,Math.random()<=this.options.density)),t.row=this.randomTopStartRow();break}}}drawColumn(t){for(let[e,s]of t.cells){let n=s;Math.random()<this.options.mutateRate&&(n=_(this.options.chars),t.cells.set(e,n));let o=e*this.cellHeight;if(o<-this.options.fontSize||o>t.fallLimit+this.options.fontSize)continue;let p=Math.max(0,t.row-e),f=p/Math.max(1,t.trail-1),d=Math.max(0,1-f),l=p===0;this.context.save(),this.context.globalAlpha=l?1:d*.72,this.context.fillStyle=l?this.options.headColor:f>.72?this.options.dimColor:this.options.bodyColor,this.context.shadowColor=this.options.bodyColor,this.context.shadowBlur=l?this.options.glow*1.4:this.options.glow*d,this.context.filter=this.options.blur>0?`blur(${this.options.blur}px)`:"none",this.context.fillText(n,t.x,o),this.context.restore()}}};v.observedAttributes=["charset","font-size","column-gap","density","fps","speed-min","speed-max","trail-min","trail-max","fade-opacity","head-color","body-color","dim-color","glow","blur","mutate-rate","max-fall-ratio","max-fall-height","fall-variance"];customElements.get("matrix-rain")||customElements.define("matrix-rain",v);var k="01\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BDABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&";function R(){return k[Math.floor(Math.random()*k.length)]}function S(i,r){return i.padEnd(r," ").slice(0,r)}function w(i,r){return i+Math.random()*(r-i)}function m(i,r,t){let e=Number(i.getAttribute(r));return Number.isFinite(e)?e:t}var M=class extends HTMLElement{constructor(){super();this.words=[];this.wordIndex=0;this.intervalDelay=2300;this.frameDelay=34;this.frames=28;this.flickeringIntervalMin=1200;this.flickeringIntervalMax=3600;this.flickeringDurationMin=80;this.flickeringDurationMax=220;this.flickeringIntensityMin=.6;this.flickeringIntensityMax=1.5;this.unwatchReducedMotion=null;let t=this.attachShadow({mode:"open"});t.innerHTML=`
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
    `,this.textElement=t.querySelector(".text"),this.glitchLayers=t.querySelectorAll(".glitch"),this.slotElement=t.querySelector("slot")}connectedCallback(){window.clearInterval(this.cycleTimer),window.clearInterval(this.scrambleTimer),window.clearTimeout(this.scrambleGlitchTimer),window.clearTimeout(this.flickerDelayTimer),window.clearTimeout(this.flickerDurationTimer),this.words=this.readWords(),this.intervalDelay=Number(this.getAttribute("interval"))||2300,this.frameDelay=Number(this.getAttribute("frame-delay"))||34,this.frames=Number(this.getAttribute("frames"))||28,this.flickeringIntervalMin=m(this,"flickering-interval-min",1200),this.flickeringIntervalMax=m(this,"flickering-interval-max",3600),this.flickeringDurationMin=m(this,"flickering-duration-min",80),this.flickeringDurationMax=m(this,"flickering-duration-max",220),this.flickeringIntensityMin=m(this,"flickering-intensity-min",.6),this.flickeringIntensityMax=m(this,"flickering-intensity-max",1.5),this.wordIndex=0,this.words.length===0&&(this.words=["Server-Driven"]),this.setText(this.words[0]),this.words.length>1&&(this.cycleTimer=window.setInterval(()=>this.cyclePhrase(),this.intervalDelay)),this.unwatchReducedMotion=g(()=>this.applyReducedMotion()),this.applyReducedMotion()}disconnectedCallback(){window.clearInterval(this.cycleTimer),window.clearInterval(this.scrambleTimer),window.clearTimeout(this.scrambleGlitchTimer),window.clearTimeout(this.flickerDelayTimer),window.clearTimeout(this.flickerDurationTimer),this.unwatchReducedMotion?.(),this.unwatchReducedMotion=null}applyReducedMotion(){if(!c()){this.scheduleFlicker();return}window.clearInterval(this.scrambleTimer),window.clearTimeout(this.scrambleGlitchTimer),window.clearTimeout(this.flickerDelayTimer),window.clearTimeout(this.flickerDurationTimer),this.classList.remove("is-scrambling"),this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.setText(this.words[this.wordIndex])}readWords(){let t=this.slotElement.assignedNodes({flatten:!0}).map(n=>(n.textContent??"").trim()).filter(Boolean);if(t.length>0)return t;let e=(this.getAttribute("words")||"").split("|").map(n=>n.trim()).filter(Boolean);if(e.length>0)return e;let s=(this.textContent??"").trim();return s?[s]:["Server-Driven"]}setText(t){this.textElement.textContent=t,this.glitchLayers.forEach(e=>{e.textContent=t})}cyclePhrase(){if(this.wordIndex=(this.wordIndex+1)%this.words.length,c()){this.setText(this.words[this.wordIndex]);return}this.scrambleTo(this.words[this.wordIndex])}scrambleTo(t){let e=this.textElement.textContent?.trimEnd()??"",s=Math.max(e.length,t.length),n=S(t,s),o=0;window.clearInterval(this.scrambleTimer),window.clearTimeout(this.scrambleGlitchTimer),this.classList.add("is-scrambling"),this.scrambleTimer=window.setInterval(()=>{let p=o/this.frames,f=Math.floor(p*s),d="";for(let l=0;l<s;l+=1)d+=l<f?n[l]:R();this.setText(d),o+=1,o>this.frames&&(window.clearInterval(this.scrambleTimer),this.setText(t),this.scrambleGlitchTimer=window.setTimeout(()=>this.classList.remove("is-scrambling"),180))},this.frameDelay)}scheduleFlicker(){let t=Math.max(0,this.flickeringIntervalMin),e=Math.max(t,this.flickeringIntervalMax);e!==0&&(c()||(window.clearTimeout(this.flickerDelayTimer),this.flickerDelayTimer=window.setTimeout(()=>this.startFlicker(),w(t,e))))}startFlicker(){let t=Math.max(0,this.flickeringDurationMin),e=Math.max(t,this.flickeringDurationMax),s=Math.max(0,this.flickeringIntensityMin),n=Math.max(s,this.flickeringIntensityMax),o=w(s,n);this.style.setProperty("--glitch-shift",`${.035*o}em`),this.style.setProperty("--glitch-opacity",String(Math.min(o,1.6))),this.classList.add("is-flickering"),window.clearTimeout(this.flickerDurationTimer),this.flickerDurationTimer=window.setTimeout(()=>{this.classList.remove("is-flickering"),this.style.removeProperty("--glitch-shift"),this.style.removeProperty("--glitch-opacity"),this.scheduleFlicker()},w(t,e))}};customElements.get("glitch-cycle-text")||customElements.define("glitch-cycle-text",M);import E from"/static/datasim.js";var h=E;h.setLatency(0,0);h.setHandlerDelay(0);h.setUnreachable(!1);h.setErrorResponse("");var T={flat:{_lf_eq_60:0,_lf_eq_170:0,_lf_eq_310:0,_lf_eq_600:0,_lf_eq_1k:0,_lf_eq_3k:0,_lf_eq_6k:0,_lf_eq_12k:0,_lf_eq_14k:0,_lf_eq_16k:0},bass:{_lf_eq_60:9,_lf_eq_170:7,_lf_eq_310:4,_lf_eq_600:1,_lf_eq_1k:-1,_lf_eq_3k:-2,_lf_eq_6k:-2,_lf_eq_12k:-3,_lf_eq_14k:-4,_lf_eq_16k:-5},studio:{_lf_eq_60:4,_lf_eq_170:2,_lf_eq_310:-1,_lf_eq_600:0,_lf_eq_1k:1,_lf_eq_3k:3,_lf_eq_6k:5,_lf_eq_12k:4,_lf_eq_14k:2,_lf_eq_16k:-2}};h.post("/lf-eq/preset/:name/",async(i,r)=>{let t=i.params.name||"studio";r.patchSignals(T[t]||T.studio)});var C=i=>{let r=document.getElementById(i);return r?r.innerHTML.trim():""};h.post("/lf-select/options/",async(i,r)=>{await r.delay(500),r.patchElements(C("lf-how-section-stage-2"))});h.post("/lf-select/reset/",async(i,r)=>{r.patchElements(C("lf-how-section-stage-3"))});h.post("/lf-tree/collapse/",async(i,r)=>{let t=document.getElementById("lf-tree");if(!t)return;let e=t.cloneNode(!0);for(let s of e.querySelectorAll("neo-tree-item[expanded]"))s.removeAttribute("expanded"),s.hasAttribute("aria-expanded")&&s.setAttribute("aria-expanded","false");r.patchElements(e.outerHTML)});
