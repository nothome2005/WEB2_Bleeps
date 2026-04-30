# Лабораторная работа 1 (Тестирование) — полный blueprint для проекта Bleep

## 1. Что это за проект (контекст для ЛР)

### 1.1. Краткая идея продукта
Bleep — это веб-сервис, в котором пользователь отправляет изображение и получает текстовый prompt/описание, сгенерированное ML-моделью.

Ключевая ценность:
- быстро получить описание изображения без ручного написания;
- использовать результат для дальнейшей работы (AI-генерация, контент, SEO, заметки и т.д.);
- видеть статус длинной обработки и историю задач.

### 1.2. Что уже есть в репозитории (фактическая база)
Текущее состояние ближе к backend foundation:
- REST API для сущности Job;
- JWT-аутентификация (без регистрации/паролей);
- изоляция данных по userId;
- SQLite-хранилище jobs;
- статусная модель job (CREATED, QUEUED, PROCESSING, DONE, ERROR);
- отдельный Python-скрипт baseline для image captioning (как задел под background processing).

### 1.3. Прогноз эволюции проекта по веб-лабораторным
На основе описания Labs 2-4 и структуры репозитория:
1. Базовый CRUD jobs + auth/изоляция (уже реализовано).
2. RabbitMQ и асинхронная обработка (job в очереди, backend не блокируется).
3. Python background service (worker), который реально выполняет heavy-processing (image -> prompt).
4. Event-driven коммуникация: backend публикует событие задачи, worker публикует progress/completed/failed, backend обновляет status/result/error.
5. (Вероятно следующие инкременты) UI загрузки файла, мониторинг статуса, просмотр результата.

## 2. Формализация бизнес-требований

### 2.1. Проблема
Пользователю нужно быстро и предсказуемо получать текстовое описание изображения. Если обработка занимает время, нужен понятный асинхронный flow со статусами и результатом.

### 2.2. Целевая аудитория
- Контент-креатор.
- Студент/исследователь.
- Разработчик, интегрирующий captioning в пайплайн.

### 2.3. Ценности для пользователя
- Экономия времени.
- Стабильность: задача не теряется, можно проверить статус.
- Прозрачность: понятно, в каком состоянии job.
- Безопасность данных: пользователь видит только свои jobs.

### 2.4. Функциональные требования (FR)
FR-01: Пользователь получает access token по userId.
FR-02: Пользователь создает job на обработку изображения.
FR-03: Пользователь просматривает список только своих jobs.
FR-04: Пользователь получает детали конкретной своей job.
FR-05: Система поддерживает валидные переходы статусов job.
FR-06: Система выполняет обработку асинхронно через очередь событий.
FR-07: По завершении обработки в job сохраняется result; при сбое — error.
FR-08: Пользователь может удалить свою job.

### 2.5. Нефункциональные требования (NFR)
NFR-01 (Security): Изоляция данных между пользователями обязательна.
NFR-02 (Reliability): Backend не должен блокироваться долгими задачами.
NFR-03 (Scalability): Worker должен масштабироваться независимо от backend.
NFR-04 (Observability): Важные состояния и ошибки должны быть наблюдаемыми в логах/метриках.
NFR-05 (Usability): Пользовательский flow должен быть понятным (создал -> ожидает -> готово/ошибка).

## 3. Lean Canvas (доп. артефакт на +2)

### 3.1. Problem
- Нет быстрого способа получить качественное текстовое описание изображения.
- Ручные описания нестабильны и занимают время.
- Долгие операции в HTTP приводят к таймаутам и плохому UX.

### 3.2. Customer Segments
- Индивидуальные создатели контента.
- Небольшие digital-команды.
- Студенты/разработчики для учебных и прототипных сценариев.

### 3.3. Unique Value Proposition
"Загрузи изображение — получи готовый prompt асинхронно, безопасно и прозрачно по статусам".

### 3.4. Solution
- Job-based API.
- JWT identity и data isolation.
- RabbitMQ + background worker.
- ML captioning (image -> prompt).

### 3.5. Channels
- Веб-интерфейс.
- REST API для интеграций.

### 3.6. Revenue (если монетизация появится)
- Freemium лимиты.
- Подписка на повышенный throughput/качество.

### 3.7. Cost Structure
- Инфраструктура backend + worker + broker.
- Хранение артефактов.
- Поддержка модели/вычислений.

### 3.8. Key Metrics
- Доля успешно завершенных jobs.
- Среднее время обработки.
- Ошибки на 1000 jobs.
- Конверсия create -> done.

### 3.9. Unfair Advantage
- Четкая event-driven архитектура в учебном проекте с готовой трассировкой статусов.

## 4. User Story Mapping (для визуальной карты)

Ниже текстовая форма карты (готова к переносу в Excalidraw/Draw.io).

### 4.1. User и Goal
User A: Authenticated User
Goal: Получить prompt из изображения быстро и надежно.

User B: System Operator/Developer (внутренний)
Goal: Поддерживать стабильную асинхронную обработку без блокировки HTTP.

### 4.2. Backbone: Activities -> Steps -> User Tasks

Activity 1: Авторизация
- Step 1.1: Запросить токен
- Tasks:
  - T1 (Must): получить JWT по userId
  - T2 (Should): обработка невалидного userId

Activity 2: Управление задачами
- Step 2.1: Создать job
- Tasks:
  - T3 (Must): создать job со статусом CREATED
  - T4 (Should): валидация обязательных полей

- Step 2.2: Просмотреть свои jobs
- Tasks:
  - T5 (Must): список только текущего userId
  - T6 (Should): сортировка/фильтры (если появятся)

- Step 2.3: Просмотреть job детально
- Tasks:
  - T7 (Must): доступ только к своей job
  - T8 (Could): расширенная история статусов

Activity 3: Асинхронная обработка
- Step 3.1: Отправить job в очередь
- Tasks:
  - T9 (Must): CREATED -> QUEUED
  - T10 (Must): публикация события в RabbitMQ

- Step 3.2: Выполнить обработку в worker
- Tasks:
  - T11 (Must): QUEUED -> PROCESSING
  - T12 (Must): PROCESSING -> DONE/ERROR
  - T13 (Should): идемпотентность обработки

Activity 4: Получение результата
- Step 4.1: Увидеть финальный статус и результат
- Tasks:
  - T14 (Must): получить result в DONE
  - T15 (Must): получить error в ERROR

Activity 5: Очистка данных
- Step 5.1: Удалить job
- Tasks:
  - T16 (Must): удаление только своей job

### 4.3. Нарезка инкрементов (минимум 2)

Инкремент 1 (MVP Foundation):
- T1, T3, T5, T7, T16
- Плюс обязательная security-изоляция по userId
- Плюс базовая валидация

Инкремент 2 (Async Core):
- T9, T10, T11, T12, T14, T15
- Реализация очереди и фонового сервиса

Инкремент 3 (Stability/Quality, если нужно):
- T2, T4, T6, T8, T13
- Улучшения reliability/observability

## 5. 5 User Stories + Acceptance Criteria

Ниже 5 историй в формате As a / I want / so that.

### US-01 Token
As an authenticated user, I want to receive a JWT token by my userId so that I can access protected job endpoints.

Acceptance Criteria:
1. Given валидный userId, when клиент вызывает endpoint token issuance, then система возвращает 200 и accessToken.
2. Given пустой или нестроковый userId, when вызывается endpoint, then система возвращает 400.
3. Given отсутствующий/битый token в защищенном endpoint, when выполняется запрос, then система возвращает 401.

### US-02 Create Job
As an authenticated user, I want to create a processing job so that the system can process my image asynchronously.

Acceptance Criteria:
1. Given валидный token и валидный payload, when POST /jobs, then система создает job и возвращает 201.
2. Created job содержит userId текущего пользователя.
3. Начальный статус job — CREATED.
4. Если обязательные поля отсутствуют/невалидны, возвращается 400.

### US-03 Isolated Access
As an authenticated user, I want to see only my own jobs so that my data remains private.

Acceptance Criteria:
1. Given user A и user B, when user A запрашивает список jobs, then он видит только jobs user A.
2. Given job принадлежит user B, when user A запрашивает GET /jobs/:id, then возвращается 404 (или 403 в другой политике, но консистентно).
3. Любое изменение/удаление чужой job недоступно.

### US-04 Async Processing Lifecycle
As an authenticated user, I want my job to move through async statuses so that I understand progress and final outcome.

Acceptance Criteria:
1. Разрешены только переходы:
   - CREATED -> QUEUED
   - QUEUED -> PROCESSING|ERROR
   - PROCESSING -> DONE|ERROR
2. Любой невалидный переход возвращает 409.
3. DONE и ERROR являются терминальными.
4. При DONE сохраняется result; при ERROR сохраняется error.

### US-05 Get Final Result
As an authenticated user, I want to view the final prompt for my completed job so that I can use it in my workflow.

Acceptance Criteria:
1. Given status DONE, when GET job detail, then response содержит непустой result.
2. Given status ERROR, then response содержит причину error.
3. При промежуточных статусах result может отсутствовать.

## 6. Функциональные тест-кейсы (приоритизированные)

Ниже формат максимально близкий к требуемой структуре. Для "Actual Result / Status / Executed By / Date of execution" оставлены шаблонные значения для заполнения при выполнении.

### TC-001 (P0)
Test case ID: TC-001
Test case description: Выдача JWT при валидном userId
Prerequisites:
- Backend запущен
Test steps:
1. Отправить POST /auth/token с body {"userId":"student-1"}
Test data:
- userId = student-1
Expected Result:
- HTTP 200
- В response присутствует accessToken (непустая строка)
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-002 (P0)
Test case ID: TC-002
Test case description: Отклонение выдачи токена при пустом userId
Prerequisites:
- Backend запущен
Test steps:
1. Отправить POST /auth/token с body {"userId":""}
Test data:
- userId = ""
Expected Result:
- HTTP 400
- Сообщение об ошибке валидации
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-003 (P0)
Test case ID: TC-003
Test case description: Создание job валидным пользователем
Prerequisites:
- Получен валидный JWT
Test steps:
1. POST /jobs с Authorization: Bearer <token>
2. Передать валидный payload (title, description)
Test data:
- title = "caption for sunset"
- description = "user uploaded image"
Expected Result:
- HTTP 201
- Job создана, содержит id, userId текущего пользователя, status=CREATED
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-004 (P0)
Test case ID: TC-004
Test case description: Запрет создания job без токена
Prerequisites:
- Backend запущен
Test steps:
1. POST /jobs без заголовка Authorization
Test data:
- валидный payload
Expected Result:
- HTTP 401
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-005 (P0)
Test case ID: TC-005
Test case description: Изоляция списка jobs между user A и user B
Prerequisites:
- Есть 2 токена: userA, userB
- У каждого создано минимум по 1 job
Test steps:
1. GET /jobs от userA
2. Проверить, что нет job userB
3. GET /jobs от userB
4. Проверить, что нет job userA
Test data:
- userA=student-1, userB=student-2
Expected Result:
- Каждый пользователь видит только свои данные
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-006 (P0)
Test case ID: TC-006
Test case description: Доступ к чужой job по id запрещен
Prerequisites:
- userB имеет job id=JB
- userA имеет валидный token
Test steps:
1. userA выполняет GET /jobs/JB
Test data:
- чужой id job
Expected Result:
- HTTP 404 (в текущей политике сокрытия ресурса)
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-007 (P0)
Test case ID: TC-007
Test case description: Валидный переход статуса CREATED -> QUEUED
Prerequisites:
- Существует job в CREATED пользователя
Test steps:
1. PATCH /jobs/:id/status body {"status":"QUEUED"}
Test data:
- status = QUEUED
Expected Result:
- HTTP 200
- status обновлен на QUEUED
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-008 (P0)
Test case ID: TC-008
Test case description: Невалидный переход CREATED -> DONE отклоняется
Prerequisites:
- Существует job в CREATED
Test steps:
1. PATCH /jobs/:id/status body {"status":"DONE","result":"..."}
Test data:
- status = DONE
Expected Result:
- HTTP 409
- Сообщение о невалидном переходе
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P0

### TC-009 (P1)
Test case ID: TC-009
Test case description: Финальный статус DONE содержит result
Prerequisites:
- Job переведена в PROCESSING
Test steps:
1. PATCH /jobs/:id/status -> DONE с result
2. GET /jobs/:id
Test data:
- result = "a cat sitting on a wooden chair"
Expected Result:
- status = DONE
- result заполнен
- error = null
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P1

### TC-010 (P1)
Test case ID: TC-010
Test case description: Финальный статус ERROR содержит error message
Prerequisites:
- Job переведена в QUEUED или PROCESSING
Test steps:
1. PATCH /jobs/:id/status -> ERROR
2. GET /jobs/:id
Test data:
- error = "worker timeout"
Expected Result:
- status = ERROR
- error заполнен
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P1

### TC-011 (P1)
Test case ID: TC-011
Test case description: Удаление собственной job
Prerequisites:
- Есть job пользователя
Test steps:
1. DELETE /jobs/:id
2. GET /jobs/:id
Test data:
- id существующей своей job
Expected Result:
- DELETE возвращает 204
- Повторный GET возвращает 404
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P1

### TC-012 (P2)
Test case ID: TC-012
Test case description: Невалидный статус отклоняется
Prerequisites:
- Есть job пользователя
Test steps:
1. PATCH /jobs/:id/status с body {"status":"FINISHED"}
Test data:
- status = FINISHED
Expected Result:
- HTTP 400 invalid status
Actual Result: TBD
Status: Not executed
Created By: QA Student
Date of creation: 2026-03-21
Executed By: TBD
Date of execution: TBD
Priority: P2

## 7. Чеклист для инкремента 1 (MVP Foundation)

### 7.1. Auth
- [ ] Token endpoint доступен.
- [ ] Валидный userId возвращает JWT.
- [ ] Невалидный userId корректно отклоняется.
- [ ] Защищенные endpoints без токена возвращают 401.

### 7.2. CRUD Jobs
- [ ] Создание job работает.
- [ ] Список jobs возвращается.
- [ ] Детали job по id возвращаются.
- [ ] Обновление title/description работает.
- [ ] Удаление job работает.

### 7.3. Data Isolation
- [ ] User A не видит jobs User B в списке.
- [ ] User A не читает job User B по id.
- [ ] User A не обновляет/не удаляет job User B.

### 7.4. Status Lifecycle
- [ ] CREATED -> QUEUED разрешен.
- [ ] QUEUED -> PROCESSING разрешен.
- [ ] PROCESSING -> DONE разрешен.
- [ ] PROCESSING -> ERROR разрешен.
- [ ] Невалидные переходы возвращают 409.
- [ ] DONE/ERROR терминальные.

### 7.5. Error Handling
- [ ] Единый формат ошибок для API.
- [ ] Валидационные ошибки имеют корректные HTTP-коды.
- [ ] Непредвиденные ошибки не раскрывают внутренние детали.

### 7.6. Regression Basics
- [ ] После изменений в статусах базовый CRUD не сломан.
- [ ] После изменений в auth не сломана изоляция.
- [ ] После миграций БД старые записи читаются корректно.

## 8. Спецификации графиков/диаграмм для других нейросетей

Ниже готовые ТЗ на визуализации. Это можно напрямую отдавать модели, которая рисует схемы.

### G-01: Product Scope Diagram
Цель: показать границы системы Bleep и внешних акторов.
Что должно быть на схеме:
- Actors: User, Backend API, RabbitMQ, Python Worker, ML model, SQLite.
- Потоки:
  1) User -> Backend: create/list/get jobs.
  2) Backend -> RabbitMQ: publish job request.
  3) Worker <- RabbitMQ: consume request.
  4) Worker -> ML model: infer caption.
  5) Worker -> RabbitMQ: publish completed/failed/progress.
  6) Backend <- RabbitMQ: consume events, update DB.
  7) User -> Backend: poll status/result.
Формат: C4 Context или простая контекстная блок-схема.

### G-02: User Story Map Board
Цель: визуальная карта Activities/Steps/Tasks + slicing на инкременты.
Что должно быть:
- Горизонтально: Activities (Auth, Manage Jobs, Async Processing, Result, Cleanup).
- Под каждой Activity: Steps.
- Ниже Steps: User tasks карточками с приоритетом Must/Should/Could.
- Горизонтальные swimline для Increment 1 и Increment 2.

### G-03: Job State Machine
Цель: отразить allowed transitions.
Состояния:
- CREATED, QUEUED, PROCESSING, DONE, ERROR.
Переходы:
- CREATED -> QUEUED
- QUEUED -> PROCESSING
- QUEUED -> ERROR
- PROCESSING -> DONE
- PROCESSING -> ERROR
Ограничения:
- DONE, ERROR terminal.
- Любой другой переход — rejected (409).

### G-04: Sequence Diagram "Create Job -> Async -> Done"
Участники:
- User, Backend API, DB, RabbitMQ, Worker, ML Model.
Шаги:
1. User POST /jobs.
2. Backend сохраняет CREATED в DB.
3. Backend publish transcription.request -> RabbitMQ.
4. Backend обновляет job в QUEUED.
5. Worker consume request, ставит PROCESSING event.
6. Worker вызывает ML model.
7. Worker publish completed(result).
8. Backend consume completed, обновляет job в DONE + result.
9. User GET /jobs/:id и видит DONE/result.

### G-05: Sequence Diagram "Failure Path"
Шаги аналогично до PROCESSING, затем:
- Worker ловит исключение/таймаут.
- Worker publish failed(error).
- Backend обновляет status=ERROR, error message.
- User GET /jobs/:id и видит ERROR.

### G-06: Test Coverage Matrix
Ось X: User stories US-01..US-05.
Ось Y: Test cases TC-001..TC-012.
Каждая ячейка: covered / partially / no.
Дополнительно:
- Цвета по приоритету P0/P1/P2.

### G-07: Risk Heatmap
Оси:
- Вероятность (Low/Med/High)
- Влияние (Low/Med/High)
Риски:
- R1: Утечка данных между users.
- R2: Потеря сообщений broker.
- R3: Дублирование обработки job.
- R4: Невалидные status transitions.
- R5: Долгое выполнение блокирует backend.

### G-08: Test Pyramid for Bleep
Слои:
- Unit: сервисы валидации, статусные переходы, auth parsing.
- Integration: repository + SQLite, API + middleware.
- API/E2E: токен, CRUD, изоляция, lifecycle.
- UI/E2E (когда frontend появится): upload -> wait -> result.
Отметить, что E2E меньше по количеству, но критичны для бизнес flow.

## 9. План тестирования инкрементов

### 9.1. Incr-1 Test Scope
Входит:
- auth token issuance
- protected CRUD jobs
- data isolation
- status transitions (базовая проверка)

Не входит:
- реальная ML-инференция
- high-load/performance tests
- UI сценарии (если UI еще нет)

### 9.2. Incr-2 Test Scope
Входит:
- RabbitMQ publish/consume
- worker execution path (stub -> real)
- async event handling
- failure handling + retries/idempotency

Не входит (если не реализовано):
- S3/MinIO storage
- websocket push

## 10. Контрольные вопросы — короткие ответы для протокола

1. Объект тестирования
Это компонент/система, которую проверяют (API endpoint, service, DB schema, UI flow). Примеры: auth middleware (unit/integration), jobs API (API testing), очередь RabbitMQ (integration/system).

2. Роль QA в SDLC
QA обеспечивает раннюю валидацию требований, предотвращение дефектов, управляемый уровень рисков и объективный критерий готовности инкремента.

3. Тестовая пирамида и проблема исчерпывающего тестирования
Исчерпывающее тестирование невозможно из-за комбинаторного взрыва. Пирамида помогает распределить проверки: много unit, меньше integration, еще меньше e2e.

4. Валидация и верификация
Верификация: "делаем продукт правильно" (соответствие спецификации). Валидация: "делаем правильный продукт" (соответствие пользовательской потребности).

5. Типы тестирования и место в SDLC
Unit/Integration/API/System/Acceptance/Regression/Non-functional (perf, security). Ранние этапы: unit+integration; перед релизом: system+acceptance+regression.

6. Проблемы waterfall и тестирование
Позднее обнаружение дефектов, дорогая обратная связь, жесткость изменений требований.

7. Shift left и Agile testing
Shift left переносит тест-дизайн и проверки в ранние стадии; в Agile тестирование идет непрерывно в каждом спринте/инкременте.

8. Типы требований и как тестировать
Функциональные — по test cases/AC; нефункциональные — perf/security/reliability тестами; бизнес-требования — acceptance/UAT.

9. User stories
Краткое описание ценности для роли пользователя в формате As a / I want / so that, с привязкой к AC.

10. Тест-кейсы: структура и назначение
Тест-кейс задает воспроизводимую процедуру проверки ожидаемого поведения и фиксирует результат выполнения.

## 11. Что передать другой нейросети как вход

Рекомендуемый пакет входа для генерации графиков:
1. Разделы 4, 8, 9 из этого документа.
2. Список US-01..US-05 и TC-001..TC-012.
3. Статусная модель Job и переходы.
4. Ограничения проекта:
- без registration/password
- асинхронная обработка вне HTTP
- изоляция jobs по userId

Готовые промпт-формулы:
- "Построй User Story Map по Activities/Steps/Tasks и разрежь на Increment 1/2".
- "Нарисуй state machine для Job со строгими allowed transitions и terminal states".
- "Сделай sequence diagram успешной и ошибочной асинхронной обработки".
- "Собери test coverage matrix US x TC и выдели P0/P1/P2".
