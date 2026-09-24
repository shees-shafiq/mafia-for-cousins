'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/context/SocketContext';

/**
 * NewsTicker — "Ghost News" banner under the phase bar.
 * Plays queued messages from eliminated players one at a time, each scrolling
 * right → left once, then removes it and moves on to the next.
 */
export default function NewsTicker() {
  const { newsQueue, dismissNews } = useSocket();
  const current = newsQueue[0];

  // Longer messages scroll for longer so reading speed stays roughly constant
  const durationSec = current ? 7 + current.text.length * 0.06 : 0;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key="ticker"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full overflow-hidden bg-red-950/90 border-b border-red-800/60 backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-stretch">
            <span className="flex-shrink-0 px-2.5 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 z-10">
              👻 Ghost News
            </span>
            <div className="relative flex-1 overflow-hidden py-1.5">
              <span
                key={current.id}
                className="ticker-track text-xs font-semibold text-red-50"
                style={{ animationDuration: `${durationSec}s` }}
                onAnimationEnd={() => dismissNews(current.id)}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: current.color }}
                />
                <span className="font-black text-white">{current.name}:</span>{' '}
                {current.text}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
