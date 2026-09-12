# Telegram channel -> question dataset

Empty until you supply an export. Nothing here is generated from live data yet;
the files that appeared during testing were built from a synthetic fixture and
have been deleted so they cannot be mistaken for real questions.

## Why the channel cannot just be scraped

`https://t.me/s/AspirantsOfTetDsc` answers **HTTP 302** and redirects to the plain
landing page, which contains no messages:

```
$ curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://t.me/s/AspirantsOfTetDsc
302 -> https://t.me/AspirantsOfTetDsc
```

Telegram serves the scrapeable `/s/` feed only for channels whose owner has
enabled a public web preview. This channel has not, so its posts are not
published as HTML anywhere and there is nothing to fetch. The linked
`@AspirantsOfDsc` behaves the same way.

## How to get the data out

**Telegram Desktop export — no credentials, no code, recommended.**

1. Open Telegram Desktop and go to the channel.
2. ⋮ (top right) -> **Export chat history**.
3. Format: **JSON** (the "Machine-readable JSON" option — *not* HTML).
4. Under "Include", tick **Photos** only if you also want the image list.
5. Choose a date range if you do not want the whole history.
6. Telegram writes a folder containing `result.json`.

Then run:

```bash
node scripts/telegram-export-to-dataset.mjs "path/to/result.json"
```

Add `--no-db` to skip the read-only duplicate check against your live banks.

The script **never writes to the database.** Its only database access is
reading existing question text so it can tell you which extracted rows you
already have.

## What comes out

| File | Contents |
|---|---|
| `questions.json` / `questions.csv` | the dataset, in the project's bank column shape |
| `needs-review.csv` | rows whose answer key a human must confirm |
| `skipped.csv` | every message that yielded nothing, with the reason |
| `report.md` | counts, medium split, answer-key confidence, duplicate analysis |

## Expect a lot of review work

The channel describes its own content as "Daily Current Affairs Polls",
"Genaral Knowledge images and Polls", "Daily Exams" and "DSC content". That
matters for what is recoverable:

- **Quiz polls** give a clean question and four options, but Telegram's JSON
  export does **not** record which option is correct. The script stores the
  crowd favourite as `most_voted_guess` and flags the row — a poll crowd is
  wrong often enough on hard items that this is not an answer key.
- **Image posts** cannot be read at all without OCR. They are listed in
  `skipped.csv` so you can decide whether Telugu/English OCR is worth it.
- **Text posts** are the best case: where the post states "Ans: B" or
  "సమాధానం: 2", the key is taken directly and marked `stated`.

`subject`, `chapter`, `topic` and `difficulty` come out blank on purpose —
nothing in a post says which blueprint section a question belongs to.

## Before any of it reaches the live banks

These are a third party's posts. Previous-paper questions are government
material, but items and explanations written by the channel are not yours to
resell — this project takes payments, so confirm you have the right to use
them. Run the duplicate check too: `already_in_db = yes` rows are already in
your banks, and importing them would recreate the duplication the recent
science and social-studies cleanups removed.
