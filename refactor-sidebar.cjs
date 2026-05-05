const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

c = "import { WorkspaceSidebar } from './components/WorkspaceSidebar';\n" + c;

const startIndex = c.indexOf('{/* Left: Assets & Settings Column */}');
const endIndex = c.indexOf('{/* Center: Preview Section */}');

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Left: Assets & Settings Column */}
        <WorkspaceSidebar 
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          isAssetDragOver={isAssetDragOver}
          handleAssetDragOver={handleAssetDragOver}
          handleAssetDragLeave={handleAssetDragLeave}
          handleAssetDrop={handleAssetDrop}
          fileInputRef={fileInputRef}
          assetSearch={assetSearch}
          setAssetSearch={setAssetSearch}
          state={state}
          handleAssetDragStart={handleAssetDragStart}
          removeAsset={removeAsset}
          pushToHistory={pushToHistory}
          setState={setState}
          handleContextMenu={handleContextMenu}
          THEME={THEME}
        />
        `;

  // Note: App.tsx also has `{/* Center: Preview Section */}`. We just replace everything between them.
  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);
  fs.writeFileSync('src/App.tsx', c);
  console.log("Success WorkspaceSidebar");
} else {
  console.log("Hooks not found", startIndex, endIndex);
}
