# Vocab

A small vocabulary trainer that runs as a single static page, with no build step and no dependencies. It works well on a phone and can be added to the home screen.

Word lists are **not** part of this repository. You load them from a file on your device or from a GitHub repository of your choice, which can be private.

## Study modes

| Mode | What it does |
|---|---|
| **Train** | Adaptive practice. Each word starts as multiple choice and moves to typing once you know it. Missed words come back within a few questions and stay more frequent in later sessions (Leitner boxes plus a time-since-last-seen factor). |
| **Discover** | Get to know a list before testing: flip through cards, or see the whole list at once. |
| **Choose** | Multiple choice in either direction. Distractors come from the same list, with the same part of speech when possible. |
| **Write** | Type the full answer. Diacritics, case, punctuation and leading articles are ignored, small typos count as "almost", and you can mark an answer as right yourself (synonyms). |
| **In context** | Uses each word's example sentence: fill the gap, or give the meaning of the highlighted word. |
| **Senses** | For words with more than one sense: say which sense a meaning belongs to, or pick the right meaning for a given sense (the other sense is always among the options). |
| **Hard words** | Your most-missed words, ready to train or write again. |

Every mode can run in either direction (term → meaning, meaning → term, or both). Lists can be split into sections, so you can study one part at a time.

## Senses: one word, several meanings

An entry can carry its meaning in several **senses**: an older and a current meaning, regional usages, a technical and an everyday meaning, and so on. You can then:

- study one sense or accept any of them,
- get a second try when you type the meaning from the *other* sense,
- limit practice to words whose senses actually differ,
- drill the difference in **Senses** mode.

`samples/french-regional.json` shows this with words that mean different things in France and in Switzerland.

## List format

JSON is recommended:

```json
{
  "id": "my-list",
  "title": "My list",
  "from": { "name": "French", "lang": "fr-FR", "font": "Optional Google Font name" },
  "to":   { "name": "English", "lang": "en" },
  "senses": [
    { "id": "a", "label": "France" },
    { "id": "b", "label": "Switzerland" }
  ],
  "items": [
    {
      "term": "le dîner",
      "translit": "",
      "form": "",
      "alts": ["dîner"],
      "pos": "noun",
      "meaning": { "a": "dinner", "b": "lunch" },
      "note": "Shown after answering.",
      "context": "Le [dîner] est servi à midi.",
      "contextTranslation": "Lunch is served at noon.",
      "ref": "Example 1",
      "group": "Section 1"
    }
  ]
}
```

Only `term` and `meaning` are required.

- **`meaning`**: a plain string if the list has a single sense, or an object keyed by sense id. If a sense is left out, the first sense's meaning applies (the meaning is the same).
- **Several accepted answers**: separate them with `;` or `,`. Text in parentheses is shown but not required, e.g. `"strength, valor; wealth (rare)"`.
- **`translit`**: a romanization. It is shown under the term and also accepted as a typed answer (can be turned off).
- **`form`**: the word as it appears in the example sentence, if different from the dictionary form. It is also accepted as a typed answer.
- **`context`**: an example sentence with the word in `[brackets]`. It is used by **In context** mode.
- **`group`**: a section name. Lists with sections show filter chips.
- **`from.lang`**: a BCP-47 language code. It is used for text-to-speech, and right-to-left scripts are handled automatically.
- **`from.font`**: an optional Google Fonts family for the terms.

CSV/TSV also works, with a header row: `term, translit, pos, meaning:France, meaning:Switzerland, note, context, group` (or just `term, meaning`).

## Loading lists

- **From a file**: tap *Open file*. On iPhone, this opens the Files app, which includes folders from Git apps such as Working Copy. A loaded list is kept in the browser; open the file again to update it.
- **From GitHub**: in *Settings → GitHub repository*, enter the owner, repository, an optional folder and a token. Then *From GitHub* lists every `.json`, `.csv` and `.tsv` file and marks which ones have changed.
  - For a private repository, create a **fine-grained personal access token** (GitHub → Settings → Developer settings) with access to *only that repository* and the single permission *Contents: Read-only*.
  - The token is saved only in this browser's local storage and is sent only to `api.github.com`.
  - Note that all of an account's GitHub Pages sites share one origin (`<user>.github.io`). Your other Pages sites can therefore read this storage, so only use the token on sites you control.

## Progress and storage

Progress, lists and settings live in the browser's local storage. Nothing is sent anywhere. Safari may clear storage for sites you haven't opened in a while, unless the page has been added to the home screen. Use *Settings → Progress → Export* for a backup, or to move progress to another device.

## Hosting

Push the repository to GitHub, then go to *Settings → Pages → Deploy from a branch*, choose `main` and `/ (root)`. The app is served at `https://<user>.github.io/<repo>/`. In Safari, use *Share → Add to Home Screen* for a full-screen app.

To run it locally, run `python3 -m http.server` in the folder and open http://localhost:8000.
