import React from "react";

interface Props {
  data: number[];
  color?: string;
  height?: number;
}

export const AudioWaveform: React.FC<Props> = ({ data, color = "#2563EB", height = 40 }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-center w-full h-full p-1 overflow-hidden" title="Audio Waveform">
      {data.map((value, i) => {
        const isPeak = value > 0.75;
        const isLoud = value > 0.45;
        const isDip = value < 0.15;
        
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              height: `${Math.max(5, value * 100)}%`,
              backgroundColor: isPeak ? '#EF4444' : isLoud ? '#F59E0B' : color,
              flex: isPeak ? '2.5 1 0%' : isLoud ? '1.5 1 0%' : isDip ? '0.5 1 0%' : '1 1 0%',
              margin: '0 1px',
              opacity: isPeak ? 1 : isLoud ? 0.9 : isDip ? 0.4 : 0.7,
              boxShadow: isPeak ? '0 0 6px rgba(239, 68, 68, 0.8)' : 'none',
              transformOrigin: 'center'
            }}
          />
        );
      })}
    </div>
  );
};
