# Лабораторные WEB 2 семестр

Проект: Лабораторная работа №1 (Backend, CRUD + DB).

- Node.js + Express backend
- SQLite как хранилище
- CRUD для сущности `Job` (Create/Read/Update/Delete)
- Без RabbitMQ, AI, WebSocket, JWT

## Run

```bash
npm install
npm start
```

Server: `http://localhost:3000`

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

- `POST /jobs`
  - body: `{ "title": "Job name", "description": "optional" }`
  - creates job in `CREATED`

- `GET /jobs`
  - list all jobs

- `GET /jobs/:id`
  - get one job

- `PUT /jobs/:id`
  - body: `{ "title": "New title", "description": "optional" }`
  - updates base job fields

- `DELETE /jobs/:id`
  - removes job by id

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
