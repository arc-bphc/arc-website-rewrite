"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function OrbitCursor() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 60, stiffness: 600, mass: 1 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const angleRef = useRef(0);
  const animationRef = useRef(null);

  const [hoveredBox, setHoveredBox] = useState(null);

  const corners = Array.from({ length: 4 }, () => ({
    x: useSpring(useMotionValue(0), springConfig),
    y: useSpring(useMotionValue(0), springConfig),
    rotate: useSpring(useMotionValue(0), springConfig),
  }));

  useEffect(() => {
    const animate = () => {
      if(!hoveredBox){
        angleRef.current += 0.0256;
      }
      const angle = angleRef.current;
      const cx = mouseX.get();
      const cy = mouseY.get();
      const offsets = [0, 90, 180, 270];

      if (!hoveredBox) {
        corners.forEach((corner, i) => {
          const offsetAngle = (offsets[i] * Math.PI) / 180;
          const x = cx + Math.cos(angle + offsetAngle) * 20 - 5;
          const y = cy + Math.sin(angle + offsetAngle) * 20 - 5;
          const r = ((angle * 180) / Math.PI + offsets[i] + 135);

          corner.x.set(x);
          corner.y.set(y);
          corner.rotate.set(r);
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [hoveredBox]);

  const handleMouseMove = useCallback((e) => {
    const x = e.clientX;
    const y = e.clientY;
    mouseX.set(x);
    mouseY.set(y);

    const target = e.target.closest("button, a, input, textarea, [data-cursor-hover]");

    if (target && target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      const dx =  (mouseX.get() - (rect.left + rect.width/2))/(rect.width/2)*10
      const dy =  (mouseY.get() - (rect.top + rect.height/2))/(rect.height/2)*10
      const padding = -4;
      const centerComp = 10;
      const offset = Math.round(angleRef.current/(2*Math.PI))*360;
      const cornersXY = [
        { x: rect.left - padding - centerComp + dx, y: rect.top - padding - centerComp + dy, r: 0 + offset },
        { x: rect.right + padding - centerComp + dx, y: rect.top - padding - centerComp + dy, r: 90 + offset },
        { x: rect.right + padding - centerComp + dx, y: rect.bottom + padding - centerComp + dy, r: 180 + offset },
        { x: rect.left - padding - centerComp + dx, y: rect.bottom + padding - centerComp + dy, r: 270 + offset },
      ];

      angleRef.current = offset*Math.PI/180;

      cornersXY.forEach((p, i) => {
        corners[i].x.set(p.x);
        corners[i].y.set(p.y);
        corners[i].rotate.set(p.r);
      });

      setHoveredBox(rect);
    } else {
      setHoveredBox(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-50 hidden lg:block">
        {/* Central Cursor Dot */}
        <motion.div
          className="absolute w-2 h-2 bg-white rounded-full shadow-lg"
          style={{
            x: mouseX,
            y: mouseY,
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Orbiting Corners */}
        {corners.map((corner, i) => (
          <motion.div
            key={i}
            className="absolute w-5 h-5 pointer-events-none"
            style={{
              x: corner.x,
              y: corner.y,
              rotate: corner.rotate,
              transform: "translate(-50%, -50%)",
            }}
            transition={{
              type: "tween",
              duration: 1,
              ease: "easeInOut",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M2 2L2 10M2 2L10 2"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="butt"
              />
            </svg>
          </motion.div>
        ))}
      </div>
    </>
  );
}
