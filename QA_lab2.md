# QA Report: Lab 2 (White Box, Unit, Integration, Contract)

## 1. Общая информация

- Проект: Bleep backend (Node.js, Express, SQLite)
- Лабораторная: №2
- Цель: покрыть основной функционал модульными тестами, добавить узкие интеграционные тесты безопасности, реализовать контрактные тесты для 2 бизнес-процессов и посчитать coverage-метрики
- Дата отчета: 2026-04-15
- Тестовый фреймворк: Jest
- HTTP тестирование: Supertest

## 2. Scope тестирования

В scope вошли:

- Unit (white box) тестирование бизнес-логики jobsService
- Narrow integration тестирование безопасности:
  - обязательность Bearer-токена
  - изоляция данных между пользователями
- Contract-тестирование 2 ключевых процессов:
  - выдача токена
  - жизненный цикл job
- Измерение покрытия кода (statement, branch, function, line)

Вне scope:

- E2E/UI
- производительность и нагрузка
- chaos/reliability сценарии очереди (RabbitMQ)
- мутационное тестирование

## 3. Изоляция тестового контура

Тестирование вынесено отдельно от production-кода:

- весь тестовый контур расположен в папке `testing/`
- основной код в `src/` не содержит тестовых артефактов
- используются отдельные helper-файлы для тестового app и in-memory БД

## 4. Реализованный тестовый набор

### 4.1 Unit tests

Файл: `testing/tests/unit/jobsService.test.js`

Покрытые сценарии:

- валидация обязательного title (400)
- валидация description (400)
- получение job по id при отсутствии (404)
- валидация некорректного статуса (400)
- запрет невалидного перехода статусов (409)
- публикация сообщения при переходе CREATED -> QUEUED
- обработка ошибки брокера и трансляция в 500

### 4.2 Narrow integration tests (security)

Файл: `testing/tests/integration/security.integration.test.js`

Покрытые сценарии:

- 401 при отсутствии Authorization заголовка
- строгая изоляция данных по userId:
  - пользователь B не видит job пользователя A в списке
  - пользователь B не получает job пользователя A по id
  - пользователь B не может удалить job пользователя A

### 4.3 Contract tests

#### Процесс 1: Auth token issuance

Файл: `testing/tests/contract/auth.contract.test.js`

Проверяет контракт `POST /auth/token`:

- успешный ответ содержит `accessToken`, `tokenType`, `userId`
- валидация невалидного `userId` возвращает 400 с ожидаемой структурой ошибки

#### Процесс 2: Job lifecycle

Файл: `testing/tests/contract/jobLifecycle.contract.test.js`

Проверяет контракт жизненного цикла job:

- создание job (`POST /jobs`) -> статус CREATED
- переходы статусов (`PATCH /jobs/:id/status`):
  - QUEUED
  - PROCESSING
  - DONE
- сохранение результата в DONE
- консистентность состояния при чтении (`GET /jobs/:id`)
- наличие обязательных полей контракта job-объекта

## 5. Техническая реализация

Ключевые файлы тестового контура:

- `testing/jest.config.js`
- `testing/tests/helpers/testDb.js`
- `testing/tests/helpers/testApp.js`
- `testing/tests/helpers/auth.js`
- `testing/tests/unit/jobsService.test.js`
- `testing/tests/integration/security.integration.test.js`
- `testing/tests/contract/auth.contract.test.js`
- `testing/tests/contract/jobLifecycle.contract.test.js`

NPM-скрипты:

- `npm test`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run test:coverage`

## 6. Результаты прогона

Команда:

```bash
npm run test:coverage
```

Итог:

- Test Suites: 4 passed, 4 total
- Tests: 12 passed, 12 total
- Snapshots: 0 total
- Result: PASS

Отмеченные логи во время прогона:

- `console.error` в unit-сценарии отказа брокера (ожидаемое поведение теста)
- `console.warn` при отсутствии брокера в контрактном lifecycle-тесте (ожидаемое graceful-degradation поведение)

## 7. Метрики покрытия

Глобальные метрики:

- Statements: 59.05%
- Branches: 51.68%
- Functions: 68.18%
- Lines: 59.82%

Файлы с высоким покрытием:

- `src/auth.js`: 100% lines/functions/branches/statements
- `src/services/jobsService.js`: 79.45% statements/lines, 92.3% functions
- `src/routes/jobs.js`: 80% lines/statements

Файлы с низким покрытием (основной резерв роста):

- `src/broker.js`: 0% (нет интеграционного стенда с RabbitMQ в рамках Lab 2)
- `src/db.js`: 0% (инициализация/миграции БД не покрыты отдельными тестами)

HTML coverage report:

- `testing/coverage/lcov-report/index.html`

## 8. Соответствие требованиям лабораторной

1. Взят серверный проект по веб-разработке: выполнено.
2. Основной функционал покрыт модульными тестами: выполнено (jobsService).
3. Безопасность покрыта узкими интеграционными тестами: выполнено (auth + isolation).
4. Метрики покрытия посчитаны: выполнено (statement/branch/function/line).
5. Контрактные тесты для двух бизнес-процессов: выполнено (auth token, job lifecycle).
6. Тестирование отделено от основного проекта: выполнено (папка `testing/`).

## 9. Риски и ограничения

- Отсутствуют тесты на реальную интеграцию с RabbitMQ (в Lab 2 допустимо, но это риск для async части)
- Не покрыты миграционные сценарии и инициализация `src/db.js`
- Нет негативных контрактных сценариев для lifecycle (например, invalid transition как контракт)
- Нет тестов на конкурентные обновления статусов

## 10. Рекомендации по развитию

Приоритет 1:

- добавить integration tests с реальным RabbitMQ через Testcontainers
- покрыть `src/db.js` тестами миграций и инициализации

Приоритет 2:

- расширить контрактные тесты негативными сценариями
- добавить пороги coverage в CI (например, >=70% statements/lines)

Приоритет 3:

- добавить мутационное тестирование (Stryker) для валидации качества набора тестов

## 11. Вывод

Лабораторная работа №2 выполнена: реализован изолированный тестовый контур, добавлены unit, narrow integration и contract тесты, получены и зафиксированы coverage-метрики. Текущий набор тестов стабильно проходит и подтверждает корректность основных бизнес-процессов и критической безопасности доступа к данным.
