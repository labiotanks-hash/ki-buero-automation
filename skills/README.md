# Claude-Code-Skills für den Sprint-Prozess

Vier Skills, die zusammen einen Entwicklungsprozess für KI-gebaute Software tragen.
Ablauf und Begründung: [`../docs/sprint-prozess.md`](../docs/sprint-prozess.md).

| Skill | Rolle | Interaktion des Menschen |
|---|---|---|
| [`anforderungen/`](anforderungen/SKILL.md) | macht aus Zielen messbare A-IDs mit Testfall | 1 – Ziele erklären |
| [`sprint/`](sprint/SKILL.md) | schneidet das Inkrement, orchestriert Bau und Prüfung, schließt ab | 2 – „go“ · 3 – Abnahme |
| [`smoke-test/`](smoke-test/SKILL.md) | startet das Ding wirklich und meldet, was es gesehen hat | – |
| [`system-test/`](system-test/SKILL.md) | führt Testfälle aus, protokolliert, bereitet User-Tests vor | – |

`sprint/vorlagen/` enthält die Dateivorlagen, die im Projektordner entstehen.

## Installieren

Skills liegen in Claude Code unter `~/.claude/skills/<name>/SKILL.md` (für alle Projekte)
oder `<projekt>/.claude/skills/<name>/SKILL.md` (nur für ein Projekt):

```bash
mkdir -p ~/.claude/skills
cp -R skills/anforderungen skills/sprint skills/smoke-test skills/system-test ~/.claude/skills/
```

Danach in Claude Code: `/anforderungen`, `/sprint start <projekt>`, `/smoke-test`, `/system-test`.

Diese Fassungen sind verallgemeinert. Im Produktivbetrieb hängen zusätzlich ein Aufgaben-Board,
ein Leitstand und eine Härtungs-Checkliste daran.
