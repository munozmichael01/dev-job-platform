const crypto = require('crypto');

class CredentialsManager {
  constructor() {
    // Clave de encriptación (en producción debería venir de variables de entorno)
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-for-development-only-32';
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Encripta las credenciales usando AES-256-GCM
   * @param {Object} credentials - Objeto con las credenciales a encriptar
   * @returns {string} - Credenciales encriptadas en formato JSON
   */
  encryptCredentials(credentials) {
    try {
      const text = JSON.stringify(credentials);
      const iv = crypto.randomBytes(16);
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Retornar IV + authTag + datos encriptados
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encriptando credenciales:', error);
      throw new Error('Error en encriptación');
    }
  }

  /**
   * Desencripta las credenciales
   * @param {string} encryptedData - Datos encriptados
   * @returns {Object} - Credenciales desencriptadas
   */
  decryptCredentials(encryptedData) {
    try {
      const parts = encryptedData.split(':');
      
      // Verificar formato: iv:authTag:encrypted o iv:encrypted (para compatibilidad)
      if (parts.length === 2) {
        // Formato antiguo sin authTag - usar método simple
        return this.decryptCredentialsLegacy(encryptedData);
      }
      
      if (parts.length !== 3) {
        throw new Error('Formato de datos encriptados inválido');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error desencriptando credenciales:', error);
      throw new Error('Error en desencriptación');
    }
  }

  /**
   * Método legacy para desencriptar datos del formato antiguo
   * @param {string} encryptedData - Datos encriptados en formato antiguo
   * @returns {Object} - Credenciales desencriptadas
   */
  decryptCredentialsLegacy(encryptedData) {
    try {
      // Cambiar temporalmente a AES-256-CBC para el formato legacy
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error en desencriptación legacy:', error);
      throw new Error('Error en desencriptación legacy');
    }
  }

  /**
   * Obtiene las credenciales desencriptadas de un usuario para un canal específico
   * @param {number} userId - ID del usuario
   * @param {string} channelId - ID del canal
   * @returns {Object|null} - Credenciales desencriptadas o null si no existen
   */
  async getUserChannelCredentials(userId, channelId) {
    try {
      const { supabase } = require('../db/db');
      const baseCode = String(channelId || '').split('-')[0];
      const { data: channel, error: channelError } = await supabase
        .from('DistributionChannels')
        .select('Id, Code')
        .eq('Code', baseCode)
        .single();
      if (channelError) {
        return null;
      }

      const { data: row, error } = await supabase
        .from('ChannelCredentials')
        .select('CredentialsEncrypted, ConfigurationData')
        .eq('UserId', userId)
        .eq('ChannelId', channel.Id)
        .eq('IsActive', true)
        .maybeSingle();
      if (error) throw error;
      if (!row) return null;

      const credentials = this.decryptCredentials(row.CredentialsEncrypted);
      
      // Agregar configuración si existe
      if (row.ConfigurationData) {
        try {
          credentials._config = typeof row.ConfigurationData === 'string'
            ? JSON.parse(row.ConfigurationData)
            : row.ConfigurationData;
        } catch (e) {
          console.warn('Error parseando configuración:', e);
        }
      }

      return credentials;
    } catch (error) {
      console.error('Error obteniendo credenciales del usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las credenciales de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Object} - Objeto con credenciales por canal
   */
  async getAllUserCredentials(userId) {
    try {
      const { supabase } = require('../db/db');
      const { data: rows, error } = await supabase
        .from('ChannelCredentials')
        .select('CredentialsEncrypted, ConfigurationData, DistributionChannels(Code)')
        .eq('UserId', userId)
        .eq('IsActive', true)
        .eq('IsValidated', true);
      if (error) throw error;

      const credentials = {};
      
      for (const row of rows || []) {
        const channelCode = row.DistributionChannels?.Code;
        if (!channelCode) continue;
        try {
          credentials[channelCode] = this.decryptCredentials(row.CredentialsEncrypted);
          
          // Agregar configuración si existe
          if (row.ConfigurationData) {
            try {
              credentials[channelCode]._config = typeof row.ConfigurationData === 'string'
                ? JSON.parse(row.ConfigurationData)
                : row.ConfigurationData;
            } catch (e) {
              console.warn('Error parseando configuración para', channelCode, e);
            }
          }
        } catch (error) {
          console.error(`Error desencriptando credenciales para canal ${channelCode}:`, error);
        }
      }

      return credentials;
    } catch (error) {
      console.error('Error obteniendo todas las credenciales del usuario:', error);
      throw error;
    }
  }
}

module.exports = CredentialsManager;
