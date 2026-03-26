# АУДИТ ПАРСЕРОВ DROPSTAB И CRYPTORANK

**Дата аудита:** 25 марта 2026
**Версия:** NestJS + Puppeteer

---

## 1. ТЕКУЩЕЕ СОСТОЯНИЕ БАЗЫ ДАННЫХ

| Коллекция | Количество | Источник |
|-----------|------------|----------|
| investors | 40 | Dropstab + CryptoRank |
| fundraising | 67 | Dropstab + CryptoRank |
| unlocks | 19 | CryptoRank |
| projects | 0 | Не парсим (биржевой слой) |
| funds | 0 | Не реализовано |
| activity | 0 | Не наполнено |
| categories | 0 | Не наполнено |

---

## 2. ЧТО РАБОТАЕТ ✅

### Dropstab
- **Извлечение __NEXT_DATA__** — работает через Puppeteer
- **Прокси** — подключен и работает (31.6.33.171:50100)
- **Первая страница investors** — парсит 20 записей
- **Первая страница fundraising** — парсит 50 записей
- **Парсинг структуры `fallbackBody.content`** — работает

### CryptoRank  
- **Извлечение __NEXT_DATA__** — работает
- **Первая страница funding-rounds** — парсит 16-20 записей
- **Первая страница investors/funds** — парсит 20 записей
- **Unlocks** — парсит 19 записей
- **Парсинг структуры `fallbackRounds.data`** — работает

---

## 3. КРИТИЧЕСКИЕ ПРОБЛЕМЫ 🔴

### Проблема №1: ПАГИНАЦИЯ НЕ РАБОТАЕТ

**Описание:**
Оба сайта (Dropstab и CryptoRank) используют **клиентскую пагинацию** через JavaScript API. 
SSR (Server-Side Rendering) через `__NEXT_DATA__` возвращает только **fallback данные** — первую страницу.

**Доказательство:**
```
Page 1 → fallbackBody.content = 20 investors
Page 2 → fallbackBody.content = 20 investors (ТЕ ЖЕ САМЫЕ!)
Page 5 → fallbackBody.content = 20 investors (ТЕ ЖЕ САМЫЕ!)
```

**Результат:**
- Dropstab: вместо 7,723 инвесторов получаем только 20
- Dropstab: вместо 387 страниц fundraising получаем только 1 (50 записей)
- CryptoRank: вместо 10,929 funding rounds получаем только 20

**Почему это происходит:**
Next.js сайты используют `getServerSideProps` или `getStaticProps` для первой страницы,
но последующие страницы загружаются через клиентский API (`fetch` в браузере).
`?page=X` параметр игнорируется на SSR уровне.

---

### Проблема №2: ВНУТРЕННИЙ API НЕДОСТУПЕН

**Описание:**
Реальные данные передаются через внутренний API:
- Dropstab: нет публичного API документации
- CryptoRank: есть API, но требует ключ

**Попытки найти API:**
```bash
# Пробовали _next/data route
https://dropstab.com/_next/data/{buildId}/investors.json?page=5
# Результат: те же fallback данные

# Пробовали api subdomain
https://api.dropstab.com/v1/investors?page=2
# Результат: 404
```

---

### Проблема №3: БРАУЗЕР ПАДАЕТ ПРИ ДЛИТЕЛЬНОМ ПАРСИНГЕ

**Описание:**
При парсинге большого количества страниц (>50) Puppeteer падает:
```
Protocol error: Connection closed.
Attempted to use detached Frame
```

**Причина:** Утечка памяти или таймауты при длительной работе

---

## 4. АРХИТЕКТУРНЫЕ ОГРАНИЧЕНИЯ

### Текущая архитектура:
```
Browser (Puppeteer) → Страница → __NEXT_DATA__ → Parse → MongoDB
```

### Проблема:
`__NEXT_DATA__` содержит только данные первоначального рендеринга (SSR).
Пагинация происходит через XHR/fetch запросы, которые мы не перехватываем.

### Необходимая архитектура:
```
Browser → Intercept XHR → Parse API Response → MongoDB
     или
Direct API → Parse JSON → MongoDB
```

---

## 5. ВОЗМОЖНЫЕ РЕШЕНИЯ

### Решение А: Перехват XHR запросов (Рекомендуется)

```typescript
// В Puppeteer перехватывать network requests
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/api/') && url.includes('investors')) {
    const data = await response.json();
    // Сохранить данные
  }
});

// Скроллить страницу чтобы триггерить lazy loading
await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight);
});
```

**Плюсы:** Получаем реальные данные
**Минусы:** Медленно, нестабильно, сайт может заблокировать

---

### Решение Б: Использовать официальные API

**Dropstab:**
- Нет публичного API
- Возможно есть партнерский доступ

**CryptoRank:**
- Есть публичный API: https://api.cryptorank.io/v1/
- Требует API ключ (платный?)

---

### Решение В: Реверс-инжиниринг внутреннего API

Через DevTools найти эндпоинты:
```
Dropstab внутренний API (предположительно):
POST https://dropstab.com/api/investors
Body: { page: 2, size: 20, sort: "rating" }

CryptoRank внутренний API:
GET https://cryptorank.io/api/funding-rounds?page=2&limit=20
```

---

## 6. РЕКОМЕНДАЦИИ

### Краткосрочно (быстрый фикс):
1. Использовать то что есть (40 investors, 67 fundraising, 19 unlocks)
2. Запускать парсинг чаще для обновления первой страницы

### Среднесрочно:
1. Реализовать перехват XHR в Puppeteer
2. Добавить прокрутку страницы для lazy loading
3. Увеличить пул браузеров для стабильности

### Долгосрочно:
1. Получить API ключ CryptoRank
2. Найти/получить доступ к Dropstab API
3. Или написать собственный crawler с headless browser который эмулирует пользователя

---

## 7. КОД КОТОРЫЙ НУЖНО ИЗМЕНИТЬ

### browser.service.ts — добавить XHR intercept:
```typescript
async extractWithXhrIntercept(url: string, apiPattern: string): Promise<any[]> {
  const page = await this.getPage();
  const interceptedData: any[] = [];
  
  page.on('response', async (response) => {
    if (response.url().includes(apiPattern)) {
      try {
        const json = await response.json();
        interceptedData.push(...(json.data || json.content || []));
      } catch {}
    }
  });
  
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  // Scroll to trigger lazy loading
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await this.sleep(500);
  }
  
  return interceptedData;
}
```

---

## 8. ИТОГ

| Аспект | Статус |
|--------|--------|
| Базовый парсинг | ✅ Работает |
| Пагинация | ❌ НЕ РАБОТАЕТ |
| Прокси | ✅ Работает |
| Стабильность | ⚠️ Браузер падает |
| Полнота данных | ❌ 0.5% от возможного |

**Главная проблема:** Сайты используют клиентскую пагинацию, SSR возвращает только fallback.

**Без решения проблемы пагинации невозможно получить полные данные.**
