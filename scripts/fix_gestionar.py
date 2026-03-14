import re

with open('frontend/src/features/organizador/pages/GestionarTorneoPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match the disponibilidad section
pattern = r"\{activeTab === 'disponibilidad' && id && \(\s*<div className=\"space-y-4\">.*?\{dispVista === 'configurar' \? \(.*?\) : \(\s*<CalendarioDisponibilidad.*?/>\s*\)\s*\}\s*</div>\s*\)\}"

replacement = """{activeTab === 'disponibilidad' && id && (
          <CanchasManager
            tournamentId={id}
            fechaInicio={torneo?.fechaInicio}
            fechaFin={torneo?.fechaFin}
          />
        )}"""

# Use simpler approach - find start and end markers
start_marker = "{activeTab === 'disponibilidad' && id && ("
end_marker = "        )}"

start_idx = content.find(start_marker)
if start_idx != -1:
    # Find the closing of this block
    # Look for the pattern of the old code
    old_code_start = start_idx
    # Find where this section ends (next closing of activeTab pattern)
    next_section = content.find("{activeTab === 'bracket'", start_idx)
    if next_section != -1:
        # Replace from start_idx to just before next_section
        new_content = content[:start_idx] + replacement + "\n\n        " + content[next_section:]
        with open('frontend/src/features/organizador/pages/GestionarTorneoPage.tsx', 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Done")
    else:
        print("Could not find next section")
else:
    print("Start marker not found")"} 
