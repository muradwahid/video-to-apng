const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { TimelineSection } from './components/TimelineSection';\n" + c;

const startIndex = c.indexOf('{/* Bottom: Timeline (Bento Style Footer) */}');
const endIndex = c.indexOf('<AnimatePresence>');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Bottom: Timeline (Bento Style Footer) */}
      <TimelineSection
        state={state}
        setState={setState}
        handleSplit={handleSplit}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        undo={undo}
        redo={redo}
        history={history}
        handleFocusSelected={handleFocusSelected}
        timelineRef={timelineRef}
        handleMouseDown={handleMouseDown}
        handleContextMenu={handleContextMenu}
        dragOver={dragOver}
        setDragOver={setDragOver}
        handleTimelineDrop={handleTimelineDrop}
        handleSelectClip={handleSelectClip}
        updateClipPosition={updateClipPosition}
        updateClipDuration={updateClipDuration}
        handleSelectTransition={handleSelectTransition}
        theme={THEME}
      />
      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success TimelineSection");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
