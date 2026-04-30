# Лабораторные WEB 2 семестр

Проект: Лабораторная работа №2 (Backend, JWT auth + data isolation).

- Node.js + Express backend
- SQLite как хранилище
- CRUD для сущности `Job` (Create/Read/Update/Delete)
- JWT-аутентификация без регистрации и паролей
- Изоляция jobs по `userId`

## Run

```bash
npm install
npm start
```

Server: `http://localhost:3000`

## Testing (Lab 2)

Тесты вынесены в отдельный контур `testing/`, чтобы не смешиваться с production-кодом.

Установка зависимостей:

```bash
npm install
```

Запуск всех тестов:

```bash
npm test
```

Отдельные наборы:

```bash
npm run test:unit
npm run test:integration
npm run test:contract
```

Покрытие и метрики (line/statement/branch/function):

```bash
npm run test:coverage
```

HTML-отчет после прогона: `testing/coverage/lcov-report/index.html`

## Run with Docker

```bash
docker compose up --build
```

Server: `http://localhost:3000`

Stop:

```bash
docker compose down
```

Delete DB volume (optional reset):

```bash
docker compose down -v
```

## Windows BAT helpers

Все bat-скрипты находятся в папке `scripts/`.

- `scripts\run_local.bat` - запуск backend локально
- `scripts\docker_up.bat` - запуск через Docker
- `scripts\docker_down.bat` - остановка Docker stack
- `scripts\docker_logs.bat` - live-логи backend
- `scripts\api_create_job.bat [TITLE]` - создать job
- `scripts\api_list_jobs.bat` - список jobs
- `scripts\api_get_job.bat JOB_ID` - получить job
- `scripts\api_set_status.bat JOB_ID STATUS [RESULT] [ERROR]` - сменить статус (дополнительно)
- `scripts\demo_full_cycle.bat` - полный сценарий lifecycle (дополнительно)

## REST API

### Health

- `GET /health`

### Jobs

All `/jobs` endpoints require header:

`Authorization: Bearer <accessToken>`

- `POST /auth/token`
  - body: `{ "userId": "student-1" }`
  - returns JWT access token for this user

- `POST /jobs`
  - body: `{ "title": "Job name", "description": "optional" }`
  - creates job in `CREATED` for current `userId`

- `GET /jobs`
  - list current user's jobs only

- `GET /jobs/:id`
  - get one job only if it belongs to current user

- `PUT /jobs/:id`
  - body: `{ "title": "New title", "description": "optional" }`
  - updates base job fields for current user's job

- `DELETE /jobs/:id`
  - removes current user's job by id

- `PATCH /jobs/:id/status`
  - body: `{ "status": "QUEUED|PROCESSING|DONE|ERROR", "result": "...", "error": "..." }`
  - transition validation is enforced (optional extension for next labs)

## Entity modules

Описание модулей всех сущностей системы: [docs/entities-modules.md](docs/entities-modules.md)

## Allowed transitions

- `CREATED -> QUEUED`
- `QUEUED -> PROCESSING | ERROR`
- `PROCESSING -> DONE | ERROR`

`DONE` and `ERROR` are terminal states.
