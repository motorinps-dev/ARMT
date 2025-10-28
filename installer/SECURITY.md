# Документация по безопасности установщика ARMT VPN

## Обзор системы защиты

Установщик ARMT VPN использует **многоуровневую систему защиты** от несанкционированного копирования и распространения.

## Уровни защиты

### 🔐 Уровень 1: Лицензионная система

#### Генерация ключей
Лицензионные ключи генерируются на сервере с использованием криптографически стойкого алгоритма:

```bash
Формат: XXXX-XXXX-XXXX-XXXX
Пример: ARMT-A1B2-C3D4-E5F6
```

#### Привязка к устройству
- Каждый ключ привязывается к уникальному `machine-id` устройства
- При попытке установки на другом устройстве - отказ
- Максимум 1 активация на ключ (или настраивается)

#### Онлайн валидация
```bash
POST https://api.armt.su/v1/license/validate
{
  "key": "ARMT-XXXX-XXXX-XXXX",
  "machine_id": "abc123...",
  "version": "2.0.1"
}
```

Ответ:
```json
{
  "valid": true,
  "expires_at": "2026-01-01T00:00:00Z",
  "user_id": 123,
  "features": ["premium", "multi_device"]
}
```

### 🔒 Уровень 2: Шифрование компонентов

#### AES-256 шифрование
Все бинарные файлы шифруются перед размещением на CDN:

```bash
# Шифрование файла
openssl enc -aes-256-cbc -salt \
  -in armt-vpn-client \
  -out armt-vpn-client.enc \
  -pass pass:YOUR_SECRET_KEY

# Расшифровка (в установщике)
openssl enc -d -aes-256-cbc \
  -in armt-vpn-client.enc \
  -out armt-vpn-client \
  -pass pass:YOUR_SECRET_KEY
```

#### Динамические ключи
Ключи шифрования генерируются на основе:
- Лицензионного ключа
- Machine ID
- Временной метки
- Секретного salt

### 🛡️ Уровень 3: Code Obfuscation

#### Техники обфускации

1. **Base64 кодирование критических секций**
```bash
CRITICAL_CODE=$(cat critical_section.sh | base64)
```

2. **Динамическая генерация путей**
```bash
# Вместо хардкода:
INSTALL_DIR="/opt/armt-vpn"

# Используется:
INSTALL_DIR="/opt/$(echo 'armt-vpn' | base64 | base64 -d)"
```

3. **Hex encoding для строк**
```bash
# Вместо:
API_URL="https://api.armt.su"

# Используется:
API_URL=$(echo "68747470733a2f2f6170692e61726d742e7375" | xxd -r -p)
```

### 🔍 Уровень 4: Целостность файлов

#### SHA-256 Checksums
Каждый компонент имеет контрольную сумму:

```bash
# Создание checksum
sha256sum armt-vpn-client > armt-vpn-client.sha256

# Проверка в установщике
echo "expected_hash armt-vpn-client" | sha256sum -c -
```

#### Подписи файлов
Для дополнительной защиты используются GPG подписи:

```bash
# Подпись
gpg --detach-sign --armor armt-vpn-client

# Проверка
gpg --verify armt-vpn-client.asc armt-vpn-client
```

### 🌐 Уровень 5: CDN и Rate Limiting

#### Защищенная загрузка
- Файлы доступны только с валидным токеном
- Токен генерируется после валидации лицензии
- Время жизни токена: 5 минут

```bash
DOWNLOAD_TOKEN=$(echo -n "$LICENSE_KEY:$(date +%s)" | sha256sum | cut -d' ' -f1)
wget "https://cdn.armt.su/releases/v2.0.1/client?token=$DOWNLOAD_TOKEN"
```

#### Rate Limiting
- Максимум 3 загрузки в час с одного IP
- Максимум 10 попыток валидации в день
- Автоматическая блокировка при подозрительной активности

### 🔨 Уровень 6: Anti-Debugging

#### Проверки окружения
```bash
# Проверка на виртуальные машины
if grep -q "hypervisor" /proc/cpuinfo; then
    print_warning "Обнаружена виртуальная машина"
fi

# Проверка на debugger
if [[ -n "$BASH_XTRACEFD" ]]; then
    print_error "Обнаружен отладчик"
    exit 1
fi

# Проверка на модифицированную оболочку
if [[ "$BASH_VERSINFO" -lt 4 ]]; then
    print_error "Требуется Bash 4.0+"
    exit 1
fi
```

## Реализация на сервере

### API для валидации лицензий

#### 1. Создание таблицы лицензий

```sql
CREATE TABLE licenses (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(19) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    machine_id VARCHAR(255),
    activation_date TIMESTAMP,
    expiration_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_activations INTEGER DEFAULT 1,
    current_activations INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_license_key ON licenses(license_key);
CREATE INDEX idx_machine_id ON licenses(machine_id);
```

#### 2. API эндпоинт валидации

```typescript
// server/routes/license.ts
import { Router } from 'express';
import crypto from 'crypto';

router.post('/api/v1/license/validate', async (req, res) => {
    const { key, machine_id, version } = req.body;
    
    // Валидация формата
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Invalid license format' 
        });
    }
    
    // Проверка в базе данных
    const license = await db.query(
        'SELECT * FROM licenses WHERE license_key = $1',
        [key]
    );
    
    if (!license.rows.length) {
        return res.status(404).json({ 
            valid: false, 
            error: 'License not found' 
        });
    }
    
    const lic = license.rows[0];
    
    // Проверка активности
    if (!lic.is_active) {
        return res.status(403).json({ 
            valid: false, 
            error: 'License deactivated' 
        });
    }
    
    // Проверка срока действия
    if (new Date(lic.expiration_date) < new Date()) {
        return res.status(403).json({ 
            valid: false, 
            error: 'License expired' 
        });
    }
    
    // Проверка привязки к устройству
    if (lic.machine_id && lic.machine_id !== machine_id) {
        return res.status(403).json({ 
            valid: false, 
            error: 'License bound to another device' 
        });
    }
    
    // Проверка лимита активаций
    if (lic.current_activations >= lic.max_activations) {
        return res.status(403).json({ 
            valid: false, 
            error: 'Activation limit reached' 
        });
    }
    
    // Первая активация - привязываем к устройству
    if (!lic.machine_id) {
        await db.query(
            'UPDATE licenses SET machine_id = $1, activation_date = NOW(), current_activations = current_activations + 1 WHERE license_key = $2',
            [machine_id, key]
        );
    }
    
    // Генерация download токена
    const downloadToken = crypto
        .createHash('sha256')
        .update(`${key}:${machine_id}:${Date.now()}`)
        .digest('hex');
    
    // Сохраняем токен в Redis с TTL 5 минут
    await redis.setex(`download:${downloadToken}`, 300, JSON.stringify({
        license_key: key,
        machine_id: machine_id
    }));
    
    res.json({
        valid: true,
        expires_at: lic.expiration_date,
        download_token: downloadToken,
        version: '2.0.1'
    });
});
```

#### 3. Генерация лицензий

```typescript
// Утилита для генерации лицензий
function generateLicenseKey(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
        const segment = crypto
            .randomBytes(2)
            .toString('hex')
            .toUpperCase()
            .substring(0, 4);
        segments.push(segment);
    }
    return `ARMT-${segments.join('-')}`;
}

// API для создания лицензии (только для админов)
router.post('/api/admin/licenses/create', requireAdmin, async (req, res) => {
    const { user_id, duration_days, max_activations } = req.body;
    
    const licenseKey = generateLicenseKey();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + duration_days);
    
    await db.query(
        'INSERT INTO licenses (license_key, user_id, expiration_date, max_activations) VALUES ($1, $2, $3, $4)',
        [licenseKey, user_id, expirationDate, max_activations || 1]
    );
    
    res.json({
        license_key: licenseKey,
        expires_at: expirationDate
    });
});
```

## Дополнительные меры защиты

### 1. IP Whitelist для CDN
```nginx
# nginx config
geo $allowed_ip {
    default 0;
    192.168.1.0/24 1;  # Ваши сервера
}

location /releases/ {
    if ($allowed_ip = 0) {
        return 403;
    }
    # ... остальная конфигурация
}
```

### 2. User-Agent проверка
```bash
# В установщике
CUSTOM_UA="ARMT-Installer/2.0.1 (Linux; Protected)"
wget --user-agent="$CUSTOM_UA" ...
```

### 3. Лог всех установок
```typescript
// Логирование попыток установки
await db.query(
    'INSERT INTO installation_logs (license_key, machine_id, ip_address, user_agent, success) VALUES ($1, $2, $3, $4, $5)',
    [key, machine_id, req.ip, req.headers['user-agent'], true]
);
```

### 4. Алерты при подозрительной активности
```typescript
// Проверка на злоупотребления
const recentAttempts = await db.query(
    'SELECT COUNT(*) FROM installation_logs WHERE ip_address = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
    [req.ip]
);

if (recentAttempts.rows[0].count > 5) {
    // Отправить алерт администратору
    await sendAlert({
        type: 'suspicious_activity',
        ip: req.ip,
        attempts: recentAttempts.rows[0].count
    });
    return res.status(429).json({ error: 'Too many requests' });
}
```

## Мониторинг и аналитика

### Dashboard метрики
- Количество активных лицензий
- Попытки валидации (успешные/неуспешные)
- География установок
- Версии клиента
- Подозрительная активность

### Алерты
- Попытки брутфорса лицензий
- Множественные установки с одного IP
- Попытки обхода проверок
- Истекающие лицензии

## Заключение

Эта многоуровневая система защиты делает практически невозможным:
- ✅ Копирование установщика без лицензии
- ✅ Использование одного ключа на нескольких устройствах
- ✅ Reverse engineering критического кода
- ✅ Обход онлайн-проверки
- ✅ Подделку файлов клиента

**Важно**: Регулярно обновляйте алгоритмы защиты и мониторьте попытки взлома.
