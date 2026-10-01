import { useEffect, useRef } from "react";
import "./LiquidCodeReveal.css";

interface LiquidCodeRevealProps {
  active: boolean;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

interface Droplet {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export default function LiquidCodeReveal({
  active,
  x,
  y,
  velocityX,
  velocityY,
}: LiquidCodeRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pointerRef = useRef({
    x,
    y,
    vx: velocityX,
    vy: velocityY,
  });

  const dropletsRef = useRef<Droplet[]>([]);

  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    pointerRef.current = {
      x,
      y,
      vx: velocityX,
      vy: velocityY,
    };
  }, [x, y, velocityX, velocityY]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const resize = () => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        1.75
      );

      canvas.width =
        window.innerWidth * dpr;

      canvas.height =
        window.innerHeight * dpr;

      canvas.style.width =
        `${window.innerWidth}px`;

      canvas.style.height =
        `${window.innerHeight}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    const spawnDroplets = () => {
      if (reducedMotion || !active) {
        return;
      }

      const { vx, vy, x, y } =
        pointerRef.current;

      const speed =
        Math.sqrt(vx * vx + vy * vy);

      if (speed < 12) return;

      const amount = Math.min(
        Math.floor(speed / 16),
        4
      );

      for (let i = 0; i < amount; i++) {
        const angle =
          Math.atan2(vy, vx) +
          Math.PI +
          (Math.random() - 0.5);

        const distance =
          125 +
          Math.random() * 70;

        dropletsRef.current.push({
          x:
            x +
            Math.cos(angle) * distance,

          y:
            y +
            Math.sin(angle) * distance,

          radius:
            3 +
            Math.random() * 7,

          vx:
            Math.cos(angle) *
            (0.8 + Math.random() * 2),

          vy:
            Math.sin(angle) *
            (0.8 + Math.random() * 2),

          life: 0,

          maxLife:
            30 +
            Math.random() * 25,
        });
      }
    };

    const updateDroplets = () => {
      dropletsRef.current =
        dropletsRef.current.filter(
          (droplet) => {
            droplet.life += 1;

            droplet.x += droplet.vx;
            droplet.y += droplet.vy;

            droplet.vx *= 0.96;
            droplet.vy *= 0.96;

            droplet.radius *= 0.985;

            return (
              droplet.life <
              droplet.maxLife
            );
          }
        );
    };

    const drawLiquidRim = () => {
      if (!active) return;

      const {
        x,
        y,
        vx,
        vy,
      } = pointerRef.current;

      const speed =
        Math.sqrt(vx * vx + vy * vy);

      const radius =
        165 +
        Math.min(speed * 0.35, 45);

      const stretch =
        Math.min(speed * 0.45, 50);

      const angle =
        Math.atan2(vy, vx);

      ctx.save();

      ctx.translate(x, y);

      ctx.rotate(angle);

      /*
       * Outer gold glow.
       */
      ctx.beginPath();

      ctx.ellipse(
        0,
        0,
        radius + stretch,
        radius - stretch * 0.25,
        0,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "rgba(212, 167, 44, 0.55)";

      ctx.lineWidth = 7;

      ctx.shadowColor =
        "rgba(212, 167, 44, 0.45)";

      ctx.shadowBlur = 25;

      ctx.stroke();

      /*
       * Main liquid edge.
       */
      ctx.beginPath();

      ctx.ellipse(
        0,
        0,
        radius + stretch,
        radius - stretch * 0.25,
        0,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "rgba(255, 244, 194, 0.95)";

      ctx.lineWidth = 2;

      ctx.shadowBlur = 0;

      ctx.stroke();

      /*
       * Gloss highlight.
       */
      ctx.beginPath();

      ctx.ellipse(
        -radius * 0.35,
        -radius * 0.4,
        radius * 0.23,
        radius * 0.07,
        -0.45,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(255, 255, 255, 0.45)";

      ctx.fill();

      ctx.restore();
    };

    const drawDroplets = () => {
      dropletsRef.current.forEach(
        (droplet) => {
          const opacity =
            1 -
            droplet.life /
              droplet.maxLife;

          ctx.beginPath();

          ctx.arc(
            droplet.x,
            droplet.y,
            Math.max(
              droplet.radius,
              0
            ),
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            `rgba(212, 167, 44, ${opacity})`;

          ctx.shadowColor =
            "rgba(212, 167, 44, 0.45)";

          ctx.shadowBlur = 8;

          ctx.fill();

          ctx.shadowBlur = 0;
        }
      );
    };

    const animate = () => {
      ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );

      spawnDroplets();

      updateDroplets();

      drawDroplets();

      drawLiquidRim();

      frameRef.current =
        requestAnimationFrame(
          animate
        );
    };

    animate();

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );

      if (frameRef.current) {
        cancelAnimationFrame(
          frameRef.current
        );
      }
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="liquid-canvas"
      aria-hidden="true"
    />
  );
}