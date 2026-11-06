# S10.run: достижения (прототип)

Концепт страниц достижений для S10.run на примерных данных.

Открыть: https://strofilov-a.github.io/s10-achievements/

| Файл | Что это |
| --- | --- |
| `index.html` | Достижения атлета |
| `coach.html` | Достижения тренера, ученики и витрина учеников |
| `assets/ranks/*.svg` | Значки званий атлета: bronze, silver, gold, platinum, titan, master, champion, elite |
| `assets/coach-ranks/*.svg` | Значки званий тренера, те же имена |
| `assets/tokens.css`, `assets/tokens.json` | Цвета уровней и интерфейса |
| `api-mock/*.json` | Примеры ответов API на данных прототипа |

Состояния открываются переключателем в левом нижнем углу или по хешу адреса:

- атлет: `#new`, `#levelup`, `#rankup`, `#friend`, `#hidden`, `#profile`, `#loading`, `#error`;
- тренер: `#few`, `#empty`, `#levelup`, `#rankup`, `#public`, `#hidden`, `#profile`, `#loading`, `#error`.

Переключатель есть только в прототипе, на сайте его не будет. Правила, расчёт и API описаны в ТЗ.
