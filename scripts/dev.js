// scripts/dev.js - Script robusto para levantar todos los servicios
const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 INICIANDO JOB PLATFORM - ARQUITECTURA COMPLETA");
console.log("=" .repeat(60));

function runService(name, cmd, args = [], options = {}) {
  console.log(`\n🚀 Iniciando servicio: ${name}`);
  console.log(`📍 Comando: ${cmd} ${args.join(' ')}`);
  console.log(`📁 Directorio: ${options.cwd || process.cwd()}`);
  
  const proc = spawn(cmd, args, {
    stdio: "inherit", // muestra logs en tiempo real
    shell: true,
    ...options,
  });

  proc.on("error", (err) => {
    console.error(`\n❌ Error al iniciar ${name}:`, err.message);
    console.error("🔍 Detalles:", err);
    process.exit(1);
  });

  proc.on("exit", (code) => {
    if (code !== 0) {
      console.error(`\n⚠️  El servicio ${name} salió con código ${code}`);
      process.exit(code);
    } else {
      console.log(`\n✅ Servicio ${name} finalizado correctamente`);
    }
  });

  return proc;
}

// 🎯 Configuración de servicios - Rutas corregidas con comillas
const services = [
  {
    name: "Landing Page (Puerto 3000)",
    cmd: '"C:\\Program Files\\nodejs\\npm.cmd"',
    args: ["run", "dev"],
    cwd: path.join(__dirname, "..", "..", "landing-page")
  },
  {
    name: "Backend API (Puerto 3002)",
    cmd: '"C:\\Program Files\\nodejs\\node.exe"',
    args: ["index.js"],
    cwd: path.join(__dirname, "..", "backend")
  },
  {
    name: "Frontend Dashboard (Puerto 3006)",
    cmd: '"C:\\Program Files\\nodejs\\npm.cmd"',
    args: ["run", "dev"],
    cwd: path.join(__dirname, "..", "frontend")
  }
];

// 🚀 Ejecutar todos los servicios
console.log("📋 Servicios a iniciar:");
services.forEach((service, index) => {
  console.log(`  ${index + 1}. ${service.name}`);
});

console.log("\n⏳ Iniciando servicios...");
console.log("💡 Presiona Ctrl+C para detener todos los servicios\n");

// Ejecutar cada servicio
services.forEach(service => {
  runService(service.name, service.cmd, service.args, { cwd: service.cwd });
});

// 🎉 Mensaje final
console.log("\n" + "=" .repeat(60));
console.log("✅ TODOS LOS SERVICIOS INICIADOS");
console.log("🌍 Landing Page: http://localhost:3000");
console.log("🔧 Backend API: http://localhost:3002");
console.log("🌐 Frontend Dashboard: http://localhost:3006");
console.log("📊 Swagger: http://localhost:3002/swagger");
console.log("=" .repeat(60));
console.log("💡 Los logs aparecerán arriba. Presiona Ctrl+C para detener.\n");
