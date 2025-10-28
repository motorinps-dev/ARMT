import crypto from 'crypto';

/**
 * Генерация лицензионного ключа в формате ARMT-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const segments = [];
  
  for (let i = 0; i < 3; i++) {
    const segment = crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase();
    segments.push(segment);
  }
  
  return `ARMT-${segments.join('-')}`;
}

/**
 * Генерация токена для загрузки
 */
export function generateDownloadToken(licenseKey: string, machineId: string): string {
  const timestamp = Date.now();
  const payload = `${licenseKey}:${machineId}:${timestamp}`;
  
  return crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
}

/**
 * Валидация формата лицензионного ключа
 */
export function isValidLicenseFormat(key: string): boolean {
  const pattern = /^ARMT-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  return pattern.test(key);
}

/**
 * Хеширование machine ID для безопасного хранения
 */
export function hashMachineId(machineId: string): string {
  return crypto
    .createHash('sha256')
    .update(machineId)
    .digest('hex');
}

/**
 * Генерация случайной даты истечения (для тестов)
 */
export function generateExpirationDate(durationDays: number = 365): Date {
  const date = new Date();
  date.setDate(date.getDate() + durationDays);
  return date;
}
