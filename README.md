# Looping Tool

Дашборд для мониторинга DeFi looping/leverage позиций на различных протоколах (Aave и др.). Показывает рынки с ключевыми метриками: APY на supply/borrow, LTV, нетто-ставки.

## Стек

- **Фронтенд:** React 19, Vite, Tailwind CSS, TanStack Table
- **Бэкенд:** Express, tsx
- **Shared:** общие TypeScript типы
- **Монорепо:** npm Workspaces

## Запуск в dev-режиме

```bash
# Установить зависимости
npm install

# Создать .env в корне проекта и заполнить RPC_URL
cp .env.example .env

# Запустить (два терминала)
npm run dev --workspace=@looping-tool/backend
npm run dev --workspace=@looping-tool/frontend
```

## Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `RPC_URL` | Да | Ethereum RPC endpoint |
| `PORT` | Нет | Порт бэкенда (по умолчанию 3001) |
| `PROXY_URL` | Нет | SOCKS5/HTTP прокси для внешних запросов |
| `REFRESH_INTERVAL_MS` | Нет | Интервал автообновления данных (мс) |

## Продакшен (Docker)

```bash
docker build -t looping-tool .
docker run --env-file .env -p 3001:3001 looping-tool
```

Бэкенд раздаёт собранный фронтенд как статику на том же порту.

## Структура проекта

```
packages/
  shared/     # TypeScript типы
  backend/    # Express API сервер
  frontend/   # React SPA (Vite)
```
