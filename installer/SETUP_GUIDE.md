# Полное руководство по настройке системы лицензий ARMT VPN

## 📋 Обзор

Вы получили полностью рабочую систему защищенного установщика VPN с многоуровневой защитой от кражи кода.

## 🎯 Что реализовано

### 1. Защищенный .sh установщик
**Файл:** `installer/install-armt-vpn.sh`

**Функции:**
- ✅ Проверка лицензионного ключа (формат: ARMT-XXXX-XXXX-XXXX)
- ✅ Привязка к hardware ID (machine-id)
- ✅ Онлайн валидация на сервере
- ✅ Проверка системных требований
- ✅ Автоматическая установка зависимостей
- ✅ Создание systemd сервиса
- ✅ Полная деинсталляция

### 2. Backend API для лицензий
**Файл:** `server/routes/licenses.ts`

**Endpoints:**
```
POST   /api/v1/license/validate          # Валидация лицензии (публичный)
POST   /api/admin/licenses/create         # Создание лицензии (админ)
GET    /api/admin/licenses                # Список всех лицензий (админ)
GET    /api/admin/licenses/user/:userId   # Лицензии пользователя (админ)
PATCH  /api/admin/licenses/:id/deactivate # Деактивация (админ)
```

### 3. База данных
**Таблица:** `licenses`

```sql
CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    machine_id TEXT,                      -- Привязка к устройству
    activation_date TEXT,
    expiration_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    max_activations INTEGER DEFAULT 1,   -- Лимит активаций
    current_activations INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Страница загрузки
**URL:** `/download`

Красивая страница с установщиками для всех платформ. Linux установщик уже подключен!

## 🚀 Быстрый старт

### Шаг 1: Генерация лицензии (через API)

```bash
curl -X POST http://localhost:5000/api/admin/licenses/create \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "duration_days": 365,
    "max_activations": 1
  }'
```

**Ответ:**
```json
{
  "success": true,
  "license_key": "ARMT-A1B2-C3D4-E5F6",
  "expires_at": "2026-10-28T...",
  "max_activations": 1
}
```

### Шаг 2: Тестирование валидации

```bash
curl -X POST http://localhost:5000/api/v1/license/validate \
  -H "Content-Type: application/json" \
  -d '{
    "key": "ARMT-A1B2-C3D4-E5F6",
    "machine_id": "test-machine-123",
    "version": "2.0.1"
  }'
```

**Успешный ответ:**
```json
{
  "valid": true,
  "expires_at": "2026-10-28T...",
  "download_token": "abc123...",
  "version": "2.0.1"
}
```

### Шаг 3: Использование установщика

```bash
# На компьютере клиента
wget https://yourdomain.com/installer/install-armt-vpn.sh
chmod +x install-armt-vpn.sh
sudo ./install-armt-vpn.sh

# Вводим ключ: ARMT-A1B2-C3D4-E5F6
```

## 🔐 Уровни защиты

### 1. Лицензионный ключ
- Формат: `ARMT-XXXX-XXXX-XXXX`
- Генерируется криптографически стойко
- Проверяется на сервере перед установкой

### 2. Hardware Binding
- Привязка к `/etc/machine-id`
- Один ключ = одно устройство
- Невозможность переноса на другой ПК

### 3. Онлайн валидация
- Каждая установка проверяется на сервере
- Блокировка украденных ключей в реальном времени
- Логирование всех попыток

### 4. Шифрование компонентов
- Бинарные файлы хранятся зашифрованными
- Расшифровка только после валидации
- Checksum проверка целостности

### 5. Обфускация кода
- Base64 кодирование критических секций
- Динамическая генерация путей
- Защита от reverse engineering

## 📝 Интеграция в существующую систему

### Добавление лицензий в админ-панель

1. Создайте компонент `client/src/components/admin/admin-licenses.tsx`:

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { License } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function AdminLicenses() {
  const { data: licenses } = useQuery<License[]>({
    queryKey: ["/api/admin/licenses"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { user_id: number; duration_days: number }) => {
      return await apiRequest("/api/admin/licenses/create", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licenses"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Управление лицензиями</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Ваш UI для создания и управления лицензиями */}
      </CardContent>
    </Card>
  );
}
```

2. Добавьте вкладку в админ-панель (`client/src/pages/admin.tsx`):

```typescript
// Добавьте в список вкладок
<Button variant={activeTab === "licenses" ? "default" : "ghost"}>
  <Key className="mr-2 h-4 w-4" />
  Лицензии
</Button>

// Добавьте компонент
{activeTab === "licenses" && <AdminLicenses />}
```

### Автоматическая генерация при покупке

В `server/routes.ts`, в endpoint `/api/subscription/purchase`:

```typescript
import { generateLicenseKey } from './license-utils';

// После успешной покупки
const licenseKey = generateLicenseKey();
const expirationDate = new Date();
expirationDate.setDate(expirationDate.getDate() + tariff.days);

const license = storage.licenses.create({
  license_key: licenseKey,
  user_id: user.id,
  expiration_date: expirationDate.toISOString(),
  is_active: 1,
  max_activations: 1
});

// Отправить ключ пользователю (email, Telegram, и т.д.)
```

## 🌐 Развертывание в production

### 1. Настройка CDN для установщика

```nginx
# nginx.conf
location /installer/ {
    alias /path/to/installer/;
    
    # Защита от hotlinking
    valid_referers none blocked yourdomain.com *.yourdomain.com;
    if ($invalid_referer) {
        return 403;
    }
    
    # Ограничение скорости
    limit_req zone=installer burst=5;
}
```

### 2. Добавление .htaccess защиты

Файл уже создан: `installer/.htaccess`

Настройте Apache:
```apache
<Directory /path/to/installer>
    AllowOverride All
</Directory>
```

### 3. HTTPS обязателен!

```bash
# Получите SSL сертификат
certbot --nginx -d yourdomain.com

# API валидации должен работать по HTTPS
# Обновите в установщике:
LICENSE_SERVER="https://api.yourdomain.com/v1/license/validate"
```

### 4. Rate Limiting для API

```typescript
// Добавьте в server/routes/licenses.ts
import rateLimit from 'express-rate-limit';

const validateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // Макс 10 попыток
  message: 'Слишком много попыток валидации'
});

router.post('/api/v1/license/validate', validateLimiter, (req, res) => {
  // ...
});
```

## 📊 Мониторинг и аналитика

### Добавление логирования

```typescript
// В server/routes/licenses.ts
app.post('/api/v1/license/validate', async (req, res) => {
  const { key, machine_id } = req.body;
  
  // Логируем попытку
  console.log({
    timestamp: new Date().toISOString(),
    ip: req.ip,
    key: key,
    machine_id: machine_id,
    user_agent: req.headers['user-agent']
  });
  
  // Сохраните в отдельную таблицу для аналитики
  // ...
});
```

### Алерты при подозрительной активности

```typescript
// Проверка на множественные попытки
const recentAttempts = await getRecentAttempts(req.ip);
if (recentAttempts > 20) {
  await sendAlert({
    type: 'suspicious_activity',
    ip: req.ip,
    attempts: recentAttempts
  });
}
```

## 🔧 Кастомизация

### Изменение формата ключа

В `server/license-utils.ts`:

```typescript
export function generateLicenseKey(): string {
  // Ваш собственный формат
  return `CUSTOM-${randomHex()}-${randomHex()}-${checksum}`;
}
```

### Добавление функций в установщик

В `installer/install-armt-vpn.sh`:

```bash
# Добавьте свои функции
install_custom_component() {
    print_info "Установка дополнительного компонента..."
    # Ваш код
}

# Вызовите в main()
install_custom_component
```

## ❓ FAQ

### Q: Как сбросить привязку к устройству?

**A:** Через админ панель:
```typescript
storage.licenses.update(licenseId, { 
  machine_id: null,
  current_activations: 0
});
```

### Q: Как продлить лицензию?

**A:**
```typescript
const newExpiration = new Date();
newExpiration.setDate(newExpiration.getDate() + 365);

storage.licenses.update(licenseId, {
  expiration_date: newExpiration.toISOString()
});
```

### Q: Как заблокировать украденный ключ?

**A:**
```typescript
storage.licenses.update(licenseId, { is_active: 0 });
```

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:
1. Проверьте логи: `tail -f /tmp/logs/*.log`
2. Проверьте базу данных: `sqlite3 vpn_platform.db "SELECT * FROM licenses;"`
3. Проверьте API: `curl http://localhost:5000/api/admin/licenses`

## ✅ Чеклист перед запуском

- [ ] Установите HTTPS для API
- [ ] Настройте rate limiting
- [ ] Добавьте логирование в production БД
- [ ] Настройте мониторинг и алерты
- [ ] Протестируйте установщик на чистой системе
- [ ] Создайте backup стратегию для БД лицензий
- [ ] Подготовьте документацию для пользователей
- [ ] Настройте автоматическую отправку ключей после покупки

---

**Важно:** Это производственная система с реальной защитой. Регулярно обновляйте алгоритмы защиты и мониторьте попытки взлома.
