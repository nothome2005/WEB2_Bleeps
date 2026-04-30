# Backend Lab 3 - Message Broker & Async Processing

## ✅ Реалізація

### Що було додано:

#### 1. **RabbitMQ интеграція**
- Оновлений `docker-compose.yml` - додана RabbitMQ служба
- Порти: `5672` (AMQP), `15672` (Management UI)
- Health check для забезпечення готовності перед запуском backend

#### 2. **Message Broker Service** (`src/broker.js`)
- Підключення до RabbitMQ через `amqplib`
- Декларація exchange `transcription` (topic)
- Декларація queue `transcription.requests`
- Bind queue до routing key `transcription.request`
- Graceful error handling и fallback

#### 3. **Ідемпотентність**
- Новий стовпець `idempotency_key` типу UUID в таблиці jobs
- Унікальний індекс на `idempotency_key` для попередження дублювання
- Миграція БД - автоматична для існуючих таблиць

#### 4. **Async Publishing**
- Оновлений `JobsService` для публікації повідомлень при переході на QUEUED
- Структура повідомлення:
  ```json
  {
    "jobId": 1,
    "userId": "test-user-1",
    "title": "Job Title",
    "idempotencyKey": "uuid-string",
    "timestamp": "2026-03-26T07:10:00Z"
  }
  ```

#### 5. **Graceful Degradation**
- Backend продовжує роботу, навіть якщо RabbitMQ недоступна
- Логування попередження про недосяжність брокера
- При оновленні статусу на QUEUED логується намір публікування

#### 6. **Dependencies**
- `amqplib` ^0.10.3 - AMQP client
- `uuid` ^9.0.1 - генерація унікальних ключів

---

## 🧪 Тестування

### Статус переходів:
✅ `CREATED` → `QUEUED` (з публікацією в очередь)
✅ `QUEUED` → `PROCESSING | ERROR`
✅ `PROCESSING` → `DONE | ERROR`

### Приклад сценарію:
```bash
# 1. Отримати токен
POST /auth/token
{ "userId": "test-user-1" }

# 2. Створити job (автоматично в CREATED статусі з idempotency_key)
POST /jobs
{ "title": "Process Image", "description": "..." }

# 3. Оновити на QUEUED (публікує в RabbitMQ)
PATCH /jobs/:id/status
{ "status": "QUEUED" }

# 4. Backend отримує повідомлення з очереди та оновлює на PROCESSING
# (реалізується в worker сервісі)

# 5. Worker публікує результат, backend оновлює на DONE/ERROR
```

---

## 🎯 Завдання ВИКОНАНО:

✅ Підключити RabbitMQ - **Done** (docker-compose)
✅ Backend публікує `transcription.request` - **Done** (broker.js)
✅ Backend оновлює статус job на QUEUED - **Done** (jobsService.js)
✅ Реалізована ідемпотентність job - **Done** (idempotency_key UUID)
✅ Jobs можуть переходити у QUEUED - **Done** (тестовано)
✅ Backend не блокується - **Done** (async processing)

---

## 🚀 Запуск

### З Docker:
```bash
docker compose up --build
```
- Backend: `http://localhost:3000`
- RabbitMQ Management: `http://localhost:15672` (guest/guest)

### Локально (без RabbitMQ):
```bash
npm install
npm start
```
Server запустится з graceful degradation

---

## 📁 Файли змінені/створені:

- ✨ `src/broker.js` - новий (RabbitMQ service)
- ✏️ `src/server.js` - ініціалізація broker
- ✏️ `src/services/jobsService.js` - публікація при QUEUED
- ✏️ `src/repositories/jobsRepository.js` - підтримка idempotency_key
- ✏️ `src/routes/jobs.js` - передача broker залежності
- ✏️ `src/db.js` - міграція для idempotency_key
- ✏️ `docker-compose.yml` - RabbitMQ служба
- ✏️ `package.json` - додані amqplib, uuid

---

## 🔄 Arc Flow:
```
Client Request
    ↓
POST /jobs (create) → DB + UUID idempotency_key
    ↓
PATCH /jobs/:id/status (to QUEUED)
    ↓
Backend publishes message to RabbitMQ
    ├─ Exchange: transcription (topic)
    ├─ Routing Key: transcription.request
    └─ Queue: transcription.requests
    ↓
Worker (future) consumes message
    ├─ Idempotency check (prevent duplicates)
    └─ Process job
    ↓
Worker publishes result back
    ↓
Backend updates status (PROCESSING → DONE/ERROR)
```

---

**Lab 3 Complete** ✅
