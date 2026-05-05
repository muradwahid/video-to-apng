const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { InspectorSection } from './components/InspectorSection';\n" + c;

const startIndex = c.indexOf('{/* Right: Inspector (Contextual Focus) */}');
const endIndex = c.indexOf('</main>');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Right: Inspector (Contextual Focus) */}
        <InspectorSection
          activeTab={activeTab}
          state={state}
          setState={setState}
          handleResetTab={handleResetTab}
          showCropTool={showCropTool}
          setShowCropTool={setShowCropTool}
          handleConvert={handleConvert}
          isProcessing={isProcessing}
          progress={progress}
          theme={THEME}
        />
      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success InspectorSection");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
