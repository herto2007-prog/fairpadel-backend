import re
import os

with open('src/modules/admin/admin-torneos.controller.ts', 'r', encoding='utf-8') as f:
    content = f.read()

with open('src/modules/admin/inscripcion-manual-endpoints.txt', 'r', encoding='utf-8') as f:
    new_endpoints = f.read()

marker = '// OVERVIEW / DASHBOARD DEL TORNEO'
content = content.replace(marker, new_endpoints + '\n  // ' + marker)

with open('src/modules/admin/admin-torneos.controller.ts', 'w', encoding='utf-8') as f:
    f.write(content)

os.remove('src/modules/admin/inscripcion-manual-endpoints.txt')
print('Done')
