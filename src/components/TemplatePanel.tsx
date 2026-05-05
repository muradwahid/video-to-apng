import React from 'react';
import { LayoutTemplate, Play, Share2, Download, Instagram, Youtube, Video, Zap, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { Template } from '../types';

const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Social' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'youtube', label: 'YouTube' },
];

const PRESET_TEMPLATES: any[] = [
  {
    id: 'youtube-outro',
    name: 'YouTube Outro',
    description: 'Perfect for end-screens with social links',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&h=300&fit=crop',
    category: 'social'
  },
  {
    id: 'cinematic-story',
    name: 'Cinematic Story',
    description: 'Clean marketing template for SaaS or physical goods',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&h=300&fit=crop',
    category: 'marketing'
  },
  {
    id: 'cinematic-vlog',
    name: 'Cinematic Vlog',
    description: 'Widescreen 2.35:1 aspect ratio with color grading filters',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=200&h=300&fit=crop',
    category: 'youtube'
  }
];

interface TemplatePanelProps {
  onApply?: (templateId: string) => void;
}

export const TemplatePanel: React.FC<TemplatePanelProps> = ({ onApply }) => {
  const [activeCat, setActiveCat] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const filteredTemplates = PRESET_TEMPLATES.filter(t => {
    const matchesCat = activeCat === 'all' || t.category === activeCat;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="relative group">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500">
           <Search size={10} />
        </div>
        <input 
          type="text"
          placeholder="FIND STYLES..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-[8px] font-bold uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={cn(
              "whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter transition-all",
              activeCat === cat.id ? "bg-white text-black" : "text-gray-500 hover:text-gray-300 bg-white/5"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredTemplates.map(template => (
          <div 
            key={template.id} 
            onClick={() => onApply?.(template.id)}
            className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-white/5 bg-black/40 hover:border-blue-500/50 transition-all cursor-pointer"
          >
            <img src={template.thumbnail} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" alt={template.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 flex flex-col justify-end">
               <h5 className="text-[10px] font-bold text-white uppercase tracking-widest">{template.name}</h5>
               <p className="text-[8px] text-gray-400 line-clamp-1">{template.description}</p>
            </div>
            <div className="absolute top-2 right-2 flex gap-1 transform translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
               <button className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"><Play size={10} fill="currentColor" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
         <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-1">Organization</h4>
         <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
               <Download size={14} className="text-gray-500 group-hover:text-blue-400" />
               <span className="text-[8px] font-bold uppercase tracking-tighter">Import JSON</span>
            </button>
            <button className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
               <Video size={14} className="text-gray-500 group-hover:text-emerald-400" />
               <span className="text-[8px] font-bold uppercase tracking-tighter">Save Current</span>
            </button>
         </div>
      </div>

      <div className="mt-auto p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl relative overflow-hidden group">
         <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/10 blur-2xl group-hover:scale-150 transition-transform"></div>
         <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-purple-400" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-300">Magic Templates</span>
         </div>
         <p className="text-[8px] text-purple-200/50 leading-relaxed mb-2">Let AI build your story. Upload your clips and tell us the vibe.</p>
         <button className="text-[8px] font-bold text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors flex items-center gap-1">Generate Structure <LayoutTemplate size={8} /></button>
      </div>
    </div>
  );
};
