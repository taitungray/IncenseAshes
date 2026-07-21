const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// Clean and recreate www directory
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir);

function copyFileToWww(file) {
  const srcPath = path.join(srcDir, file);
  if (!fs.existsSync(srcPath)) return;
  fs.copyFileSync(srcPath, path.join(destDir, file));
  console.log(`Copied ${file}`);
}

// Files to copy
const filesToCopy = [
  'index.html',
  'style.css',
  'manifest.json',
  'sw.js'
];

filesToCopy.forEach(copyFileToWww);

// Recursively copy directories
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest);
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

['assets', 'js'].forEach(dir => {
  const dirSrc = path.join(srcDir, dir);
  if (fs.existsSync(dirSrc)) {
    copyDir(dirSrc, path.join(destDir, dir));
    console.log(`Copied ${dir} directory`);
  }
});

console.log('Build completed! Files prepared in www/');
