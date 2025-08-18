# ✅ Checklist para Primera Campaña Real a Jooble

## 🎯 **Estado Actual: 95% LISTO**

### **✅ Ya Implementado**
- [x] Payload mínimo correcto
- [x] Ubicaciones funcionando
- [x] UTMs aplicándose a URLs
- [x] Control de límites internos
- [x] Sistema de notificaciones
- [x] Base de datos preparada
- [x] Validaciones completas

### **🔧 Para Activar (30 minutos de configuración)**

#### **1. Configurar Jooble API Key**
```bash
# En .env
JOOBLE_API_KEY=tu_api_key_real_de_jooble
JOOBLE_COUNTRY=es
```

#### **2. Configurar SMTP para Emails (Opcional)**
```bash
# En .env
EMAIL_NOTIFICATIONS=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@tudominio.com
SMTP_PASS=tu_app_password
SMTP_FROM="Job Platform <alerts@tudominio.com>"
```

#### **3. Cambiar a Modo Producción**
```javascript
// En joobleService.js - cambiar línea 74:
if (!this.config.apiKey) {
  // COMENTAR esta línea para usar API real:
  // return this.simulateCreateCampaign(campaignData, offers, budgetInfo);
  
  // DESCOMENTAR para usar API real:
  throw new Error('JOOBLE_API_KEY requerida para modo producción');
}
```

### **🧪 Pasos de Testing Recomendados**

#### **Paso 1: Test con Budget Mínimo**
```javascript
const testCampaign = {
  name: "TEST - Primera Campaña Real",
  maxCPC: 0.10,           // Muy bajo para test
  dailyBudget: 5,         // Solo €5 para test
  startDate: "2025-01-09",
  endDate: "2025-01-10"   // Solo 1 día
};
```

#### **Paso 2: Monitorear Durante 1 Hora**
- Verificar que aparece en Jooble dashboard
- Confirmar que UTMs llegan a Google Analytics
- Revisar que límites internos funcionan

#### **Paso 3: Pausar y Evaluar**
- Verificar spend real vs configurado
- Validar que aplicaciones lleguen con UTMs correctos

## 🚨 **Recomendaciones de Seguridad**

### **Límites Conservadores para Test**
```javascript
const safeTestLimits = {
  maxCPC: 0.05,           // €0.05 máximo por click
  dailyBudget: 10,        // €10 máximo por día
  totalBudget: 50,        // €50 máximo total
  alertThreshold: 0.5     // Alerta al 50% (no 80%)
};
```

### **Monitoring Extra**
- Revisar cada 30 minutos las primeras 2 horas
- Tener pausado manual listo
- Verificar que alertas lleguen por email/dashboard

## 📋 **Comando de Activación**

```bash
# 1. Configurar variables
export JOOBLE_API_KEY="tu_api_key_aqui"
export EMAIL_NOTIFICATIONS=true

# 2. Activar modo producción
# (editar joobleService.js como se indica arriba)

# 3. Reiniciar servidor
npm restart

# 4. Crear primera campaña de test desde UI
```

## ✅ **Confirmación Final**

- [ ] JOOBLE_API_KEY configurada
- [ ] Modo simulación desactivado
- [ ] Límites conservadores para test
- [ ] Monitoring preparado
- [ ] Pausado manual disponible

**Una vez completado → LISTO para primera campaña real** 🚀
