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
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Retornar IV + datos encriptados
      return iv.toString('hex') + ':' + encrypted;
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
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error desencriptando credenciales:', error);
      throw new Error('Error en desencriptación');
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
      await poolPromise;
      const { pool } = require('../db/db');
      const result = await pool.request()
        .input('userId', userId)
        .input('channelId', channelId)
        .query(`
          SELECT EncryptedCredentials, ConfigurationData 
          FROM UserChannelCredentials 
          WHERE UserId = @userId AND ChannelId = @channelId AND IsActive = 1
        `);

      if (result.recordset.length === 0) {
        return null;
      }

      const row = result.recordset[0];
      const credentials = this.decryptCredentials(row.EncryptedCredentials);
      
      // Agregar configuración si existe
      if (row.ConfigurationData) {
        try {
          const config = JSON.parse(row.ConfigurationData);
          credentials._config = config;
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
      await poolPromise;
      const { pool } = require('../db/db');
      const result = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT ChannelId, EncryptedCredentials, ConfigurationData 
          FROM UserChannelCredentials 
          WHERE UserId = @userId AND IsActive = 1 AND IsValidated = 1
        `);

      const credentials = {};
      
      for (const row of result.recordset) {
        try {
          credentials[row.ChannelId] = this.decryptCredentials(row.EncryptedCredentials);
          
          // Agregar configuración si existe
          if (row.ConfigurationData) {
            try {
              const config = JSON.parse(row.ConfigurationData);
              credentials[row.ChannelId]._config = config;
            } catch (e) {
              console.warn('Error parseando configuración para', row.ChannelId, e);
            }
          }
        } catch (error) {
          console.error(`Error desencriptando credenciales para canal ${row.ChannelId}:`, error);
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