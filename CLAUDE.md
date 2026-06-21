# Projektregeln – Mini Game (Building Challenge #1)

Diese Regeln gelten für **jede** Session in diesem Projekt und sind verbindlich.

## Git & Push (oberste Priorität)

- **Push-Ziel ist immer `origin`** → mein eigenes Repo:
  `https://github.com/bartl-s/mini-game-06-2026.git`
  Dieses Ziel **niemals ändern** und **niemals woandershin pushen** (insbesondere nicht zum Original-Template `sebaskauf/building-challenge-starter`).

- **Nach jedem abgeschlossenen Arbeitsschritt sofort committen und pushen.**
  Immer dann, wenn wieder ein Stück fertig ist – kein Timer, sondern an den Fortschritt gekoppelt. Ablauf:
  ```bash
  git add -A
  git commit -m "<kurze, klare Message>"
  git push
  ```
  Lieber häufig und kleinteilig committen als selten und groß.

- **Sessionstart:** Zuerst kurz orientieren, dann nahtlos weiterbauen:
  ```bash
  git log --oneline -10
  git status
  ```
  Danach weiterarbeiten – weiterhin mit Push nach jedem Schritt.

## Ziel

Mein kompletter Fortschritt landet fortlaufend und nachvollziehbar in meinem eigenen Repo.
