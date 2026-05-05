const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { TimelineContextMenu } from './components/TimelineContextMenu';\n" + c;

const startIndex = c.indexOf('{/* Context Menu */}');
const endIndex = c.indexOf('{/* Header Navigation */}');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Context Menu */}
      <TimelineContextMenu 
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        state={state}
        setState={setState}
        pushToHistory={pushToHistory}
        handleSplit={handleSplit}
        handleGroupClips={handleGroupClips}
        handleUngroupClips={handleUngroupClips}
        duplicateClip={duplicateClip}
        moveClipTrack={moveClipTrack}
        removeClip={removeClip}
        clearAssets={clearAssets}
        fileInputRef={fileInputRef}
        audioEngine={audioEngine}
      />
      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success");
} else {
  console.log("Hooks not found");
}
