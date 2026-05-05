const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { VideoExportModal } from './components/VideoExportModal';\n" + c;

const startIndex = c.indexOf('{/* Video Export Modal */}');
const endIndex = c.indexOf('<style dangerouslySetInnerHTML');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Video Export Modal */}
      <VideoExportModal 
        showVideoExportModal={showVideoExportModal}
        setShowVideoExportModal={setShowVideoExportModal}
        videoExportConfig={videoExportConfig}
        setVideoExportConfig={setVideoExportConfig}
        handleExportVideo={handleExportVideo}
        state={state}
      />\n\n      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success VideoExportModal");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
