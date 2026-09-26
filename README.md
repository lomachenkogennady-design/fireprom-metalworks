# ФАЙЕРПРОМ Metalworks

Единый портал: инженерный расчёт гибки/развёрток + коммерческие предложения,
общая база клиентов и история. Next.js 16 (App Router) · PostgreSQL · Drizzle ORM · Tailwind 4.

| Раздел | Путь | Что делает |
| --- | --- | --- |
| Панель | `/` | Статистика, лента операций, полный цикл |
| Технологу | `/bending` | K-фактор (DIN 6935), BA/BD/OSSB, V-матрица, усилие, 2D+3D превью, отверстия, DXF |
| Менеджеру | `/kp` | Тарифы лазер/плазма/ГАР, серийные скидки, зачёт остатка, НДС 22%, импорт DXF, печать |
| История | `/history` | Расчёты, КП и клиенты из PostgreSQL |

---

## ⚠️ Termux (Android / arm64): собирать только через Webpack

Next.js 16 по умолчанию собирает **Turbopack**, а под `android/arm64` для него
нет нативных биндингов — грузятся только WASM, и сборка падает:

```
Error: Turbopack is not supported on this platform (android/arm64)
```

Это **не ошибка кода** — `tsc --noEmit` проходит чисто. Нужен флаг `--webpack`.

### Быстрый старт на телефоне

```bash
cd ~/fireprom-next
npm install

bash scripts/termux.sh doctor   # проверка окружения
bash scripts/termux.sh db       # применить схему к БД
bash scripts/termux.sh dev      # → http://localhost:3000
```

Остальные команды:

```bash
bash scripts/termux.sh build    # прод-сборка (webpack)
bash scripts/termux.sh start    # прод-сервер
bash scripts/termux.sh check    # типы + сборка
```

Или напрямую, без обёртки:

```bash
npx next dev --webpack
npx next build --webpack
npx next start
```

> `npm run build` из `package.json` оставлен на Turbopack — так быстрее собирается
> на Vercel и на обычном Linux/x64. На Termux используйте `--webpack`.

### Если не хватает памяти

```bash
export NODE_OPTIONS=--max-old-space-size=2048
```

(скрипт `termux.sh` ставит это сам)

### Зачем нужен интернет при сборке

`next/font/google` скачивает Inter / JetBrains Mono / Unbounded во время сборки
и кладёт в `.next/cache`. Первая сборка — онлайн, дальше берётся из кеша.

---

## База данных

Схема — `src/db/schema.ts` (4 таблицы: `clients`, `bending_calculations`,
`quotes`, `quote_items`). Миграции не нужны, схема накатывается напрямую:

```bash
npx drizzle-kit push
```

Строка подключения — `DATABASE_URL` в `.env` (шаблон — `.env.example`).
SSL включается автоматически для любого не-локального хоста, так что Supabase,
Neon и RDS работают без правок кода.

---

## Деплой: Vercel + Supabase (Фаза 4)

1. **Supabase** → New project → Settings → Database → Connection string (URI).
   Скопировать пароль, подставить в строку.
2. Накатить схему в облако с любого компьютера/телефона:
   ```bash
   DATABASE_URL="postgresql://postgres.xxx:ПАРОЛЬ@...pooler.supabase.com:5432/postgres?sslmode=require" \
     npx drizzle-kit push
   ```
   (порт **5432** — для схемы, **6543** — пулер для приложения)
3. **GitHub** → запушить репозиторий.
4. **Vercel** → Import Project → Environment Variables → `DATABASE_URL`
   (строка с портом **6543**) → Deploy.

Сборка на Vercel идёт на linux/x64, поэтому Turbopack там работает — менять
ничего не надо.

---

## Проверка здоровья

```
GET /api/health → {"ok":true}
```

## API

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET/POST | `/api/clients` | Список / создание клиентов |
| DELETE | `/api/clients/[id]` | Удаление клиента |
| GET/POST | `/api/calculations` | История / сохранение расчётов гибки |
| GET/DELETE | `/api/calculations/[id]` | Чтение / удаление расчёта |
| GET/POST | `/api/quotes` | Список / создание КП (цены пересчитываются на сервере) |
| GET/DELETE | `/api/quotes/[id]` | КП с позициями / удаление |
| GET | `/api/history` | Сводная лента: расчёты + КП |

---

## Инженерные допущения

- **K-фактор** — таблица DIN 6935 по R/t (0.28 … 0.5)
- **BA** = θ·(R + K·T), **OSSB** = (R+T)·tan(θ/2), **BD** = 2·OSSB − BA
- **V-матрица** = 6…10·T по материалу, **R** ≈ 0.16·V (воздушная гибка)
- **Усилие** ≈ 650·T²/V кН/м × коэффициент материала
- **Мин. полка** = 0.7·V — короче деталь проваливается в матрицу
- **DXF**: слои `CUT` (контур), `BEND` (пунктир + угол/направление),
  `HOLES` (окружности + разметка центров), `TEXT`
