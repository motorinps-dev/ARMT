import { Router } from 'express';
import storage from '../storage';
import { validateLicenseSchema, type ValidateLicense } from '@shared/schema';
import { generateDownloadToken, generateLicenseKey } from '../license-utils';

const router = Router();

/**
 * Публичный эндпоинт для валидации лицензии (используется установщиком)
 * POST /api/v1/license/validate
 */
router.post('/api/v1/license/validate', (req, res) => {
  try {
    // Валидация входных данных
    const validation = validateLicenseSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid request format',
        details: validation.error.errors
      });
    }

    const { key, machine_id } = validation.data;

    // Поиск лицензии в базе
    const license = storage.licenses.findByKey(key);

    if (!license) {
      return res.status(404).json({
        valid: false,
        error: 'License not found'
      });
    }

    // Проверка активности
    if (!license.is_active) {
      return res.status(403).json({
        valid: false,
        error: 'License is deactivated'
      });
    }

    // Проверка срока действия
    const now = new Date();
    const expirationDate = new Date(license.expiration_date);

    if (expirationDate < now) {
      return res.status(403).json({
        valid: false,
        error: 'License expired',
        expired_at: license.expiration_date
      });
    }

    // Проверка привязки к устройству
    if (license.machine_id) {
      if (license.machine_id !== machine_id) {
        return res.status(403).json({
          valid: false,
          error: 'License is bound to another device'
        });
      }
    } else {
      // Первая активация - проверяем лимит
      if (license.current_activations >= license.max_activations) {
        return res.status(403).json({
          valid: false,
          error: 'Activation limit reached'
        });
      }

      // Активируем лицензию
      storage.licenses.activate(key, machine_id);
    }

    // Генерация токена для загрузки
    const downloadToken = generateDownloadToken(key, machine_id);

    // Успешная валидация
    res.json({
      valid: true,
      expires_at: license.expiration_date,
      download_token: downloadToken,
      version: '2.0.1'
    });

  } catch (error: any) {
    console.error('License validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Админский эндпоинт для создания лицензии
 * POST /api/admin/licenses/create
 */
router.post('/api/admin/licenses/create', (req, res) => {
  // Требуем admin middleware (добавить позже)
  // if (!req.user?.is_admin) {
  //   return res.status(403).json({ error: 'Access denied' });
  // }

  try {
    const { user_id, duration_days, max_activations } = req.body;

    if (!user_id || !duration_days) {
      return res.status(400).json({ 
        error: 'user_id and duration_days are required' 
      });
    }

    // Генерация ключа
    const licenseKey = generateLicenseKey();

    // Вычисление даты истечения
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + duration_days);

    // Создание лицензии
    const license = storage.licenses.create({
      license_key: licenseKey,
      user_id: parseInt(user_id),
      expiration_date: expirationDate.toISOString(),
      is_active: 1,
      max_activations: max_activations || 1
    });

    res.json({
      success: true,
      license_key: license.license_key,
      expires_at: license.expiration_date,
      max_activations: license.max_activations
    });

  } catch (error: any) {
    console.error('License creation error:', error);
    res.status(500).json({
      error: 'Failed to create license',
      details: error.message
    });
  }
});

/**
 * Админский эндпоинт для получения всех лицензий
 * GET /api/admin/licenses
 */
router.get('/api/admin/licenses', (req, res) => {
  try {
    const licenses = storage.licenses.list();
    res.json(licenses);
  } catch (error: any) {
    console.error('Error fetching licenses:', error);
    res.status(500).json({
      error: 'Failed to fetch licenses'
    });
  }
});

/**
 * Админский эндпоинт для получения лицензий пользователя
 * GET /api/admin/licenses/user/:userId
 */
router.get('/api/admin/licenses/user/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const licenses = storage.licenses.findByUserId(userId);
    res.json(licenses);
  } catch (error: any) {
    console.error('Error fetching user licenses:', error);
    res.status(500).json({
      error: 'Failed to fetch user licenses'
    });
  }
});

/**
 * Админский эндпоинт для деактивации лицензии
 * PATCH /api/admin/licenses/:id/deactivate
 */
router.patch('/api/admin/licenses/:id/deactivate', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = storage.licenses.update(id, { is_active: 0 });

    if (!updated) {
      return res.status(404).json({ error: 'License not found' });
    }

    res.json({
      success: true,
      license: updated
    });
  } catch (error: any) {
    console.error('Error deactivating license:', error);
    res.status(500).json({
      error: 'Failed to deactivate license'
    });
  }
});

export default router;
