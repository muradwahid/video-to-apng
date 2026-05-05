import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { THEME } from "./Editor";
import { MessageSquare, Play, Pause, ChevronLeft, Send, Check } from "lucide-react";

export function ReviewPanel() {
  const { id } = useParams();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments/${id}`);
      if (res.ok) {
        setComments(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch comments", e);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    try {
      await fetch(`/api/comments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment, author: "Reviewer" })
      });
      setNewComment("");
      fetchComments();
    } catch (e) {
      console.error("Failed to post comment", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-300 font-sans flex flex-col">
      <header className="h-14 bg-[#161616] border-b border-white/5 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-500 hover:text-white"><ChevronLeft size={20}/></Link>
          <div className="font-bold text-white uppercase tracking-widest text-xs">Frame.io Review</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video Player Mock */}
        <div className="flex-1 bg-black flex flex-col p-8 items-center justify-center relative">
           <div className="aspect-video w-full max-w-4xl bg-[#121212] border border-white/5 rounded-lg flex items-center justify-center relative">
              <Play className="text-white/20" size={48} />
              <div className="absolute bottom-4 left-4 right-4 h-12 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 flex items-center px-4 gap-4">
                 <button className="text-white"><Play size={20}/></button>
                 <div className="flex-1 h-1 bg-white/20 rounded relative">
                    {comments.map((c, i) => (
                       <div key={i} className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" style={{left: `${Math.random()*100}%`}} title={c.text}></div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Comments */}
        <div className="w-80 bg-[#161616] border-l border-white/5 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Comments</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.map((c: any) => (
              <div key={c.id} className={`p-3 rounded-lg border ${c.resolved ? 'bg-green-900/10 border-green-500/20' : 'bg-black/40 border-white/5'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-bold text-white">{c.author}</div>
                  <div className="text-[10px] text-gray-500">{(new Date(c.timestamp)).toLocaleTimeString()}</div>
                </div>
                <div className="text-sm text-gray-300">{c.text}</div>
                {c.resolved && <div className="mt-2 text-[10px] text-green-500 uppercase tracking-widest flex items-center gap-1"><Check size={10}/> Resolved</div>}
              </div>
            ))}
            {comments.length === 0 && <div className="text-center text-xs text-gray-500 my-8">No comments yet.</div>}
          </div>
          <div className="p-4 border-t border-white/5 bg-[#121212]">
            <textarea 
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white resize-none h-20 focus:outline-none focus:border-blue-500"
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); }}}
            />
            <div className="flex justify-end mt-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium" onClick={handlePost}>
                 <Send size={14}/> Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
