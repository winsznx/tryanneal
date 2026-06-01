"use client";

import { useEffect, useRef } from "react";

const W = 1280, H = 720;
const TOTAL = 16;
const SCENES = [
  { id: "man",       s: 0,  e: 7  },
  { id: "water",     s: 7,  e: 11 },
  { id: "palms",     s: 11, e: 13 },
  { id: "particles", s: 13, e: 16 },
];

const sr = (n: number) => { const x = Math.sin(n + 1) * 43758.5453; return x - Math.floor(x); };

const PTS = Array.from({ length: 240 }, (_, i) => ({
  x: sr(i*6)*W, y: sr(i*6+1)*H,
  sz: 2.5 + sr(i*6+2)*13, al: 0.25 + sr(i*6+3)*0.75,
  vx: (sr(i*6+4)-.5)*.5, vy: (sr(i*6+5)-.5)*.5,
  star: sr(i*6+6) > 0.38,
}));

export default function GlitchBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    /* ── load assets ─────────────────────────────────── */
    const manImg = new Image();
    let ready = false;

    manImg.src = "/man.jpg";

    let assetTimer: ReturnType<typeof setTimeout>;
    function waitForAssets() {
      if (manImg.complete && manImg.naturalWidth > 0) {
        ready = true;
      } else {
        assetTimer = setTimeout(waitForAssets, 80);
      }
    }
    waitForAssets();

    /* ── helpers ─────────────────────────────────────── */
    const fill = (col: string) => { ctx.fillStyle = col; ctx.fillRect(0,0,W,H); };

    const grain = (op = 0.09) => {
      ctx.save();
      for (let i = 0; i < 1600; i++) {
        ctx.globalAlpha = Math.random() * op;
        ctx.fillStyle = Math.random() > 0.55 ? "#2020bb" : "#000010";
        ctx.fillRect(Math.random()*W, Math.random()*H, 1+Math.random(), 1+Math.random());
      }
      ctx.restore();
    };

    const darkScan = (op = 0.26) => {
      ctx.save(); ctx.globalAlpha = op; ctx.fillStyle = "#000010";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
      ctx.restore();
    };

    const blueScan = (op = 0.72, gap = 3) => {
      ctx.save(); ctx.globalAlpha = op; ctx.fillStyle = "#2828a0";
      for (let y = 0; y < H; y += gap)
        for (let x = 0; x < W; x += 9) ctx.fillRect(x, y, 6, 1);
      ctx.restore();
    };

    // Pre-render dot grid once — reused every frame as a single drawImage
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = W; dotCanvas.height = H;
    const dc = dotCanvas.getContext("2d")!;
    dc.fillStyle = "#5555cc";
    for (let y = 0; y < H; y += 4)
      for (let x = 0; x < W; x += 4) {
        dc.beginPath(); dc.arc(x, y, 1.1, 0, Math.PI * 2); dc.fill();
      }

    const dotGrid = (op = 0.18) => {
      ctx.save();
      ctx.globalAlpha = op;
      ctx.drawImage(dotCanvas, 0, 0);
      ctx.restore();
    };

    const vignette = (str = 0.55) => {
      const g = ctx.createRadialGradient(W/2,H/2,H*.27,W/2,H/2,H*.9);
      g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,`rgba(0,0,10,${str})`);
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    };

    const fadeEdges = (p: number, len = 0.12) => {
      if (p < len) {
        ctx.save(); ctx.globalAlpha = 1 - p/len; fill("#000010"); ctx.restore();
      }
      if (p > 1-len) {
        ctx.save(); ctx.globalAlpha = (p-(1-len))/len; fill("#000010"); ctx.restore();
      }
    };

    /* ── scenes ──────────────────────────────────────── */
    function sceneMan(_st: number, p: number) {
      fill("#00000e");
      if (!manImg.complete || !manImg.naturalWidth) { vignette(); return; }
      const zoom  = 1 + p * 0.09;
      const scale = Math.max(W/manImg.naturalWidth, H/manImg.naturalHeight) * 1.04;
      const dw    = manImg.naturalWidth * scale;
      const dh    = manImg.naturalHeight * scale;
      ctx.save();
      ctx.translate(W/2,H/2); ctx.scale(zoom,zoom); ctx.translate(-W/2,-H/2);
      ctx.drawImage(manImg, (W-dw)/2, (H-dh)/2, dw, dh);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#0000ff"; ctx.globalAlpha = 0.8;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
      const bot = ctx.createLinearGradient(0,H*.52,0,H);
      bot.addColorStop(0,"rgba(0,0,8,0)"); bot.addColorStop(1,"rgba(0,0,8,.82)");
      ctx.fillStyle = bot; ctx.fillRect(0,0,W,H);
      grain(0.09);
      if (p > 0.28) blueScan(Math.min(.58,(p-.28)/.45), 3);
      dotGrid(0.14);
      darkScan(0.22);
      vignette(0.58);
    }

    function sceneWater(t: number) {
      fill("#000010");

      // Large organic dark blobs — the deep water masses
      for (let i = 0; i < 28; i++) {
        const bx = sr(i*5)*W + Math.sin(t*sr(i*5+1)*.8+sr(i*5+2)*6)*40;
        const by = sr(i*5+3)*H + Math.cos(t*sr(i*5+4)*.6+sr(i*5+2)*5)*28;
        const rx = 40 + sr(i*5+6)*180;
        const ry = 20 + sr(i*5+7)*90;
        const rot = sr(i*5+8)*Math.PI;
        ctx.save();
        ctx.globalAlpha = 0.55 + sr(i*5+9)*0.35;
        ctx.translate(bx, by); ctx.rotate(rot);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx,ry));
        g.addColorStop(0,   `rgba(10,15,${(80+sr(i*5+10)*80)|0},1)`);
        g.addColorStop(0.6, `rgba(0,5,${(30+sr(i*5+11)*40)|0},0.8)`);
        g.addColorStop(1,   "rgba(0,0,10,0)");
        ctx.fillStyle = g;
        ctx.scale(rx/Math.max(rx,ry), ry/Math.max(rx,ry));
        ctx.beginPath(); ctx.arc(0,0,Math.max(rx,ry),0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // Bright electric blue highlights — light bouncing off water surface
      for (let i = 0; i < 45; i++) {
        const bx = sr(i*7)*W + Math.sin(t*sr(i*7+1)*1.2+sr(i*7+2)*8)*35;
        const by = sr(i*7+3)*H + Math.cos(t*sr(i*7+4)*.9+sr(i*7+5)*6)*22;
        const pulse = (Math.sin(t*sr(i*7+6)*2.5+sr(i*7+7)*Math.PI*3)+1)/2;
        const rx = 15 + sr(i*7+8)*100;
        const ry = 8  + sr(i*7+9)*45;
        const rot = sr(i*7+10)*Math.PI;
        ctx.save();
        ctx.globalAlpha = pulse * (0.55 + sr(i*7+11)*0.45);
        ctx.translate(bx, by); ctx.rotate(rot);
        const g = ctx.createRadialGradient(0,0,0,0,0,Math.max(rx,ry));
        g.addColorStop(0,   `rgba(160,180,255,1)`);
        g.addColorStop(0.3, `rgba(40,60,${(180+sr(i*7+12)*75)|0},0.7)`);
        g.addColorStop(1,   "rgba(0,0,15,0)");
        ctx.fillStyle = g;
        ctx.scale(rx/Math.max(rx,ry), ry/Math.max(rx,ry));
        ctx.beginPath(); ctx.arc(0,0,Math.max(rx,ry),0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      dotGrid(0.16);
      darkScan(0.20); vignette(0.55);
    }

    function frond(tx: number, ty: number, len: number, angle: number) {
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(len*.12,-len*.06, len*.48,-len*.1, len*.58,len*.07);
      ctx.bezierCurveTo(len*.42,len*.18, len*.1,len*.14, 0,0);
      ctx.fillStyle = "#0d0d60"; ctx.fill();
      ctx.globalAlpha = .7; ctx.strokeStyle = "#3535bb"; ctx.lineWidth = .8; ctx.stroke();
      ctx.restore();
    }

    function palm(bx: number, by: number, sz: number, lean: number) {
      ctx.save(); ctx.strokeStyle = "#1a1a88"; ctx.lineWidth = 11; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bx,by+sz*.28);
      ctx.bezierCurveTo(bx+lean*28,by+sz*.08, bx+lean*55,by-sz*.2, bx+lean*82,by-sz*.56);
      ctx.stroke(); ctx.restore();
      const tx = bx+lean*82, ty = by-sz*.56;
      [-1.0,-.55,-.1,.35,.82,1.18,-1.5,1.6].forEach(a => frond(tx,ty,sz*.54,a));
    }

    function scenePalms() {
      fill("#000000");
      palm(W*.36,H*.74,H*.52,-1);
      palm(W*.6, H*.72,H*.58, 1);

      // Crush blacks
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#00000c";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Wide aged scanlines
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#000000";
      for (let y = 0; y < H; y += 5) ctx.fillRect(0, y, W, 2);
      ctx.restore();

      dotGrid(0.20);
      grain(0.15); darkScan(0.35); vignette(0.85);
    }

    function sceneParticles() {
      fill("#000008");
      PTS.forEach(p => {
        p.x = (p.x+p.vx+W)%W; p.y = (p.y+p.vy+H)%H;
        if (p.star) {
          ctx.save(); ctx.globalAlpha = p.al;
          ctx.strokeStyle = "#3838f5"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
          for (let i = 0; i < 6; i++) {
            const a = (i/6)*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(p.x,p.y);
            ctx.lineTo(p.x+Math.cos(a)*p.sz, p.y+Math.sin(a)*p.sz); ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.save(); ctx.globalAlpha = p.al*.78;
          ctx.fillStyle = "#2525cc"; ctx.beginPath();
          ctx.arc(p.x,p.y,p.sz*.38,0,Math.PI*2); ctx.fill(); ctx.restore();
        }
      });
      dotGrid(0.15);
      darkScan(0.14); vignette(0.48);
    }

    /* ── render loop ──────────────────────────────────── */
    let t0 = 0;
    let rafId: number;

    function render(ts: number) {
      if (!ready) { rafId = requestAnimationFrame(render); return; }
      if (!t0) t0 = ts;
      const t     = ((ts - t0) / 1000) % TOTAL;
      const scene = SCENES.find(s => t >= s.s && t < s.e);
      if (!scene) { rafId = requestAnimationFrame(render); return; }
      const st  = t - scene.s;
      const p   = st / (scene.e - scene.s);

      switch (scene.id) {
        case "man":       sceneMan(st, p);   break;
        case "water":     sceneWater(st);    break;
        case "palms":     scenePalms();      break;
        case "particles": sceneParticles(); break;
      }

      fadeEdges(p, 0.11);
      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(assetTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}
