# Entity modules (system overview)

Документ описує модулі сутностей, які будуть у системі `Bleep` по мірі розвитку лабораторних.

## 1) Job (реалізовано в Lab 1)

Призначення: одиниця задачі обробки.

Поля:

- `id`
- `title`
- `description`
- `status`
- `result`
- `error`
- `createdAt`
- `updatedAt`

Модулі:

- `src/db.js` — підключення SQLite, схема таблиці `jobs`
- `src/server.js` — CRUD API для `Job`

## 2) User (план для Lab 2)

Призначення: логічна ізоляція даних за `userId`.

Поля (мінімум):

- `id`
- `externalId` або `username` (без пароля)
- `createdAt`

Модулі:

- `auth` module: видача JWT, middleware валідації токена
- `users` module: прив'язка jobs до `userId`

## 3) JobEvent (план для Lab 4)

Призначення: події асинхронної обробки.

Поля:

- `id`
- `jobId`
- `type` (`progress|completed|failed`)
- `payload`
- `createdAt`

Модулі:

- backend consumer/publisher (RabbitMQ)
- worker publisher (Python background service)

## 4) Artifact (план для Lab 5)

Призначення: результат обробки, збережений у S3/MinIO.

Поля:

- `id`
- `jobId`
- `s3Key`
- `mimeType`
- `createdAt`

Модулі:

- storage module (S3/MinIO adapter)
- link між `jobs` і `artifact`

## 5) RealtimeChannel (план для Lab 6/8)

Призначення: доставлення статусів у реальному часі через WebSocket.

Поля (логічні):

- `connectionId`
- `userId`
- `subscribedJobIds`

Модулі:

- ws gateway (backend)
- frontend ws client з reconnect/fallback
