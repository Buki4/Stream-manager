#!/bin/bash
cd "$(dirname "$0")"
echo "Отправка обновлений на GitHub..."
git add .
git commit -m "Auto-update $(date)"
git push origin main
echo ""
echo "✅ Готово! Изменения отправлены. Через пару минут сайт обновится."
sleep 4
