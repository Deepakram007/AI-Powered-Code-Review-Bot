import { useEffect, useRef } from 'react';

interface AccuracyRingProps { pct: number; size?: number; }

export default function AccuracyRing({ pct, size = 130 }: AccuracyRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = size / 2 - 12;
    const startAngle = -Math.PI / 2;
    const fillAngle  = startAngle + (2 * Math.PI * Math.min(pct, 100)) / 100;

    // Track
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Glow layer
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, fillAngle);
    ctx.strokeStyle = 'rgba(6,182,212,0.18)';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Main arc gradient
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0,   '#A855F7');
    grad.addColorStop(0.5, '#22D3EE');
    grad.addColorStop(1,   '#4ADE80');
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, fillAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
  }, [pct, size]);

  return (
    <div className="accuracy-ring-wrap">
      <canvas ref={canvasRef} />
      <div className="accuracy-inner">
        <span className="accuracy-pct">{pct.toFixed(1)}%</span>
        <span className="accuracy-lbl">accuracy</span>
      </div>
    </div>
  );
}
