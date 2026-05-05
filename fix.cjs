const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');
const index = c.indexOf('function Track(');
if(index !== -1){
    c = c.substring(0, index);
    const importStr = "import { Track, ContextItem } from './components/TimelineTrack';\n";
    
    // Add import statement at the beginning
    const firstImportIndex = c.indexOf('import');
    c = c.substring(0, firstImportIndex) + importStr + c.substring(firstImportIndex);
    
    fs.writeFileSync('src/App.tsx', c);
    console.log("Success");
} else {
    console.log("Not found");
}
