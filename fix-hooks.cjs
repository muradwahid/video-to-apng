const fs = require('fs');

const appFile = fs.readFileSync('src/App.tsx', 'utf8');

// Find start and end in App.tsx
const startIndex = appFile.indexOf('  return () => window.removeEventListener("keydown", handleKeyDown);');
const endIndex = appFile.indexOf('  return (\n    <div \n      className="flex h-screen flex-col');

if (startIndex !== -1 && endIndex !== -1) {
  const restOfLogic = appFile.substring(startIndex, endIndex);

  // Now read the hook we generated earlier
  let hookFile = fs.readFileSync('src/hooks/useWorkspaceEditor.ts', 'utf8');
  
  // The hook has a return statement at the bottom
  const returnIdx = hookFile.indexOf('  return { state, setState');
  
  if (returnIdx !== -1) {
    // Insert the rest of the logic right before the return statement inside the hook
    hookFile = hookFile.substring(0, returnIdx) + restOfLogic + hookFile.substring(returnIdx);
    fs.writeFileSync('src/hooks/useWorkspaceEditor.ts', hookFile);
    
    // Remove the logic from App.tsx
    const newAppFile = appFile.substring(0, startIndex) + appFile.substring(endIndex);
    fs.writeFileSync('src/App.tsx', newAppFile);
    console.log("Success merging rest of logic into hook");
  } else {
    console.log("Could not find return statement in hook");
  }
} else {
  console.log("Could not find start/end indices in App.tsx");
}
