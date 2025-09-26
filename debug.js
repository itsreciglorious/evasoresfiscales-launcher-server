// debug.js - Ejecuta esto para verificar el entorno
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== DEBUG DEL LAUNCHER ===');

// Verificar Node.js y npm
console.log('Node.js version:', process.version);
console.log('Plataforma:', process.platform);

// Verificar Java
try {
  const javaVersion = execSync('java -version 2>&1').toString();
  console.log('Java encontrado:', javaVersion.includes('version'));
} catch (error) {
  console.log('Java no encontrado en PATH');
}

// Verificar directorios
const MINECRAFT_DIR = path.join(require('os').homedir(), '.evasoresfiscales');
console.log('Directorio del launcher:', MINECRAFT_DIR);
console.log('Existe directorio:', fs.existsSync(MINECRAFT_DIR));
