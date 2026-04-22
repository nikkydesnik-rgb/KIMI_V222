#!/bin/bash

echo "========================================"
echo "  ИСПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ"
echo "========================================"
echo ""

# Check if Node.js is installed
if command -v node &> /dev/null; then
    echo "Node.js найден, запуск сервера..."
    node start.js
    exit 0
fi

# Fallback to Python
if command -v python3 &> /dev/null; then
    echo "Python3 найден, запуск сервера..."
    python3 server.py
    exit 0
fi

if command -v python &> /dev/null; then
    echo "Python найден, запуск сервера..."
    python server.py
    exit 0
fi

echo ""
echo "ОШИБКА: Ни Node.js, ни Python не найдены!"
echo ""
echo "Установите одно из следующего:"
echo "  - Node.js: https://nodejs.org"
echo "  - Python:  https://python.org"
echo ""
read -p "Нажмите Enter для выхода..."
