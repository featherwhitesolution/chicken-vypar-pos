const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');
let changedFiles = 0;
let totalReplaced = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Regex to match $ that is NOT followed by {
  const regex = /\$(?!\{)/g;
  if (regex.test(content)) {
    const newContent = content.replace(regex, '₹');
    fs.writeFileSync(file, newContent, 'utf8');
    // Using regex.source to re-match and count because /g state
    const matches = content.match(/\$(?!\{)/g);
    totalReplaced += matches ? matches.length : 0;
    changedFiles++;
    console.log('Updated:', file);
  }
});

console.log('Replaced', totalReplaced, 'occurrences in', changedFiles, 'files.');
