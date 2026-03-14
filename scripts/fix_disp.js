const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/features/organizador/pages/GestionarTorneoPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Simple text replacement
const startMarker = "{activeTab === 'disponibilidad' && id && (";
const endMarker = "        )}";  // This appears after the disponibilidad block

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.log('Start marker not found');
    process.exit(1);
}

// Find where bracket section starts (this is after disponibilidad)
const bracketMarker = "{activeTab === 'bracket'";
const bracketIdx = content.indexOf(bracketMarker, startIdx);

if (bracketIdx === -1) {
    console.log('Bracket marker not found');
    process.exit(1);
}

// Build new content
const before = content.substring(0, startIdx);
const after = content.substring(bracketIdx);

const replacement = `{activeTab === 'disponibilidad' && id && (
          <CanchasManager
            tournamentId={id}
            fechaInicio={torneo?.fechaInicio}
            fechaFin={torneo?.fechaFin}
          />
        )}

        `;

const newContent = before + replacement + after;
fs.writeFileSync(filePath, newContent);
console.log('Fixed GestionarTorneoPage.tsx');
