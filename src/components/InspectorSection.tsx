import React from "react";
import { RefreshCw, Monitor } from "lucide-react";
import { APNGConverter } from "@/src/components/APNGConverter";
import { PropertyInspector } from "@/src/components/PropertyInspector";
import { TimelineState } from "@/src/types";

interface InspectorSectionProps {
  activeTab: "media" | "effects" | "color" | "audio" | "export";
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  handleResetTab: () => void;
  showCropTool: boolean;
  setShowCropTool: (show: boolean) => void;
  handleConvert: (options: any) => void;
  isProcessing: boolean;
  progress: string;
  theme: any;
}

export function InspectorSection({
  activeTab,
  state,
  setState,
  handleResetTab,
  showCropTool,
  setShowCropTool,
  handleConvert,
  isProcessing,
  progress,
  theme
}: InspectorSectionProps) {
  return (
    <section className="w-72 flex flex-col gap-2">
      <div className="rounded-lg border p-4 flex flex-col h-full overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
             <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white" title={`Active Tab: ${activeTab}`}>
               {activeTab === "export" ? "APNG Optimizer" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Controls`}
             </h2>
           </div>
           {activeTab !== "export" && state.selectedClipId && (
             <button
               title={`Reset ${activeTab} settings to default`}
               onClick={handleResetTab}
               className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
             >
               <RefreshCw className="h-3 w-3" />
             </button>
           )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {activeTab === "export" ? (
            <APNGConverter 
              onConvert={handleConvert} 
              isProcessing={isProcessing} 
              progress={progress} 
            />
          ) : (
            <PropertyInspector 
              state={state}
              setState={setState}
              activeTab={activeTab}
              onToggleCrop={() => setShowCropTool(!showCropTool)}
              isCropping={showCropTool}
            />
          )}
        </div>

        <div className="mt-4 space-y-4 pt-6 border-t border-white/5 opacity-50 grayscale hover:grayscale-0 transition-all shrink-0">
          <div className="flex items-center gap-2">
            <Monitor className="h-3 w-3 text-gray-500" />
            <h4 className="text-[9px] font-bold uppercase tracking-widest">Global Output</h4>
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-blue-600/40" />
            </div>
            <div className="flex justify-between text-[9px] font-mono"><span className="text-gray-600">Disk Cache</span><span>12.4 GB</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
