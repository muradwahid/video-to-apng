const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { PreviewSection } from './components/PreviewSection';\n" + c;

const startIndex = c.indexOf('{/* Center: Preview Section */}');
const endIndex = c.indexOf('{/* Right: Inspector (Contextual Focus) */}');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Center: Preview Section */}
        <PreviewSection
          state={state}
          setState={setState}
          showCropTool={showCropTool}
          setShowCropTool={setShowCropTool}
          handleApplyCrop={handleApplyCrop}
          theme={THEME}
        />
        `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success PreviewSection");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
