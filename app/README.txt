==================================================
   СИСТЕМА ФОРМИРОВАНИЯ ИСПОЛНИТЕЛЬНОЙ ДОКУМЕНТАЦИИ
==================================================

БЫСТРЫЙ СТАРТ
--------------

Windows:
    Дважды щелкните по файлу start.bat

Linux / Mac:
    В терминале выполните:
    ./start.sh


ВАЖНО ДЛЯ СБОРКИ (Windows):
    Ошибка ENOENT / Cannot resolve entry module index.html означает,
    что команда запущена не из папки приложения.

    Правильно:
    cd /d C:\ПУТЬ\К\ПАПКЕ\ПРИЛОЖЕНИЯ
    npm install
    npm run build


    Если при сборке появляется ошибка lightningcss вида:
    Unexpected token Function("--spacing")
    обновите проект до текущей версии (в ней уже включен CSS minifier esbuild).

РЕКОМЕНДУЕМЫЙ локальный запуск (UI + DOCX рендер в одном процессе):
    npm run build
    python backend_render.py
    (или python3 backend_render.py)

Альтернативно (только выдача статических файлов UI):
    node start.js
    или
    python server.py

Для стабильного серверного заполнения DOCX (альтернативный движок):
    python backend_render.py
    (нужны Flask + docxtpl)

После запуска приложение откроется в браузере автоматически.
Адрес: http://localhost:3456


ТРЕБОВАНИЯ
-----------
  - Node.js (https://nodejs.org) ИЛИ
  - Python 3 (https://python.org)
  - Для backend_render.py: pip install flask docxtpl
  - Для backend_render.py нужен собранный фронт в папке dist
  - После обновления версии очистите кэш браузера (Ctrl+F5)

На большинстве систем что-то одно уже установлено.


ФАЙЛЫ
------
  start.bat     - Запуск на Windows (двойной клик)
  start.sh      - Запуск на Linux/Mac
  start.js      - Node.js сервер
  server.py     - Python сервер статики (fallback)
  backend_render.py - Основной локальный сервер (UI + API рендера DOCX)
  dist/         - Собранное приложение
  README.txt    - Этот файл


ОСОБЕННОСТИ
-----------
  - Все данные хранятся локально в браузере
  - Для работы не нужен интернет
  - Приложение рассчитано на работу на одном ПК (без деплоя в интернет)
  - Закройте консоль (Ctrl+C) для остановки сервера
