import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const TransitionPreviewIcon = ({ type }: { type: string }) => {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setKey(k => k + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const variantsA = {
    'fade': { opacity: [1, 0, 0] },
    'cross-dissolve': { opacity: [1, 0, 0] },
    'slide-left': { x: ['0%', '-100%', '-100%'] },
    'slide-right': { x: ['0%', '100%', '100%'] },
    'slide-up': { y: ['0%', '-100%', '-100%'] },
    'zoom-in': { scale: [1, 2, 2], opacity: [1, 0, 0] },
    'blur': { filter: ['blur(0px)', 'blur(10px)', 'blur(10px)'], opacity: [1, 0, 0] },
    'glitch': { x: ['0%', '-5%', '5%', '-5%', '0%'], opacity: [1, 0, 0] },
    'pulse': { filter: ['brightness(1)', 'brightness(2)', 'brightness(2)'], opacity: [1, 0, 0] },
    'wipe': { clipPath: ['inset(0 0 0 0)', 'inset(0 100% 0 0)', 'inset(0 100% 0 0)'] },
    'iris': { clipPath: ['circle(100% at 50% 50%)', 'circle(0% at 50% 50%)', 'circle(0% at 50% 50%)'] },
    'rotate': { rotate: [0, 180, 180], opacity: [1, 0, 0], scale: [1, 0, 0] },
    'spiral': { rotate: [0, 360, 360], scale: [1, 0, 0] },
  };

  const variantsB = {
    'fade': { opacity: [0, 1, 1] },
    'cross-dissolve': { opacity: [0, 1, 1] },
    'slide-left': { x: ['100%', '0%', '0%'] },
    'slide-right': { x: ['-100%', '0%', '0%'] },
    'slide-up': { y: ['100%', '0%', '0%'] },
    'zoom-in': { scale: [0, 1, 1], opacity: [0, 1, 1] },
    'blur': { filter: ['blur(10px)', 'blur(0px)', 'blur(0px)'], opacity: [0, 1, 1] },
    'glitch': { opacity: [0, 1, 1] },
    'pulse': { filter: ['brightness(2)', 'brightness(1)', 'brightness(1)'], opacity: [0, 1, 1] },
    'wipe': { clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0)', 'inset(0 0 0 0)'] },
    'iris': { clipPath: ['circle(0% at 50% 50%)', 'circle(100% at 50% 50%)', 'circle(100% at 50% 50%)'] },
    'rotate': { rotate: [-180, 0, 0], opacity: [0, 1, 1], scale: [0, 1, 1] },
    'spiral': { rotate: [-360, 0, 0], scale: [0, 1, 1] },
  };

  const animA = (variantsA as any)[type] || variantsA['fade'];
  const animB = (variantsB as any)[type] || variantsB['fade'];

  return (
    <div className="relative w-24 h-16 overflow-hidden bg-black rounded shadow-lg border border-white/10 flex items-center justify-center">
       <motion.div 
         key={`a-${key}`}
         className="absolute inset-0 bg-blue-600 flex items-center justify-center text-white font-bold text-xs"
         animate={animA}
         transition={{ duration: 1, times: [0, 0.5, 1], ease: "easeInOut" }}
       >
         A
       </motion.div>
       <motion.div 
         key={`b-${key}`}
         className="absolute inset-0 bg-orange-600 flex items-center justify-center text-white font-bold text-xs opacity-0"
         animate={animB}
         transition={{ duration: 1, times: [0, 0.5, 1], ease: "easeInOut" }}
       >
         B
       </motion.div>
    </div>
  );
};
