const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { AppHeader } from './components/AppHeader';\n" + c;

const startIndex = c.indexOf('{/* Header Navigation */}');
const endIndex = c.indexOf('{/* Main Workspace (Bento Layout) */}');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Header Navigation */}
      <AppHeader 
         activeTab={activeTab}
         setActiveTab={setActiveTab}
         state={state}
         setShowVideoExportModal={setShowVideoExportModal}
         theme={THEME}
      />
      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success AppHeader");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
