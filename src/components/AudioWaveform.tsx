import React from "react";

interface Props {
  data: number[];
  color?: string;
  height?: number;
}

export const AudioWaveform: React.FC<Props> = ({ data, color = "#2563EB", height = 40 }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex items-center gap-[1px] w-full h-full p-1 opacity-60">
      {data.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-full"
          style={{
            height: `${Math.max(10, value * 100)}%`,
            backgroundColor: color,
            minWidth: '1px'
          }}
        />
      ))}
    </div>
  );
};
