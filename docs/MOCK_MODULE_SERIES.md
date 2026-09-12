# SGT Mock Module Series — Architecture & Runbook

100 predefined exam modules per medium, built **from the existing Practice
question bank**. There is no second question bank.

```
                     EXISTING QUESTION BANK
                   (13 subject/medium tables)
                              |
               +--------------+--------------+
               |                             |
           PRACTICE                       MOCK TEST
     subject / chapter / topic            blueprint
               |                             |
          randomised,                 100 predefined modules
        user-specific sets              160 fixed Q each
                                             |
                                    minimise repetition
                                             |
                                  PostgreSQL (source of truth)
                                             |
                                        publish + warm
                                             |
                                      Redis (read cache)
                                             |
                              +--------------+--------------+
                              |                             |
                          English                        Telugu
                        Module 1..100                 Module 1..100
```

Practice is untouched. It keeps reading the same tables through
`lib/practice/subjects/*`.

---

## 1. Apply the migration

`supabase/migrations/019_mock_module_series.sql` must be applied before any
module can be generated. It is **additive only** — no table is dropped or
rewritten, and no question content is copied.

Run it the same way migrations 001–018 were run: paste the file into the
**Supabase SQL editor** and execute, or

```bash
supabase db push
```

What it adds:

| Object | Purpose |
| --- | --- |
| `mock_tests.module_number`, `.series`, `.generated_at`, `.generation_meta` | Module identity. A module is addressed as `(series, medium, module_number)`, so English Module 01 and Telugu Module 01 are independent rows. |
| `mock_test_questions.question_uid` | `table:question_id`. Fixes a real collision: `pedagogy_subject_questions` and `telugu_medium_math` both use `Q000001..Q005000`. See §4. |
| `mock_question_usage` | Global per-medium usage counter driving repetition control. |
| `user_mock_test_progress` | Per-user `not_started / in_progress / completed`. |
| `mock_generation_reports` | Stored coverage/repetition audit per run. |
| `is_active` on the 13 question tables | Lets a question be retired without deleting it. Defaults to `true`, so nothing changes for Practice. |
| Indexes | Module list, usage lookup, per-table generator selection paths. |

---

## 2. Generate the modules

### Option A — admin UI

Admin dashboard → **Generate Mock Modules**:

1. pick **Medium** and **Blueprint**
2. set the module range (1–100)
3. **Dry Run & Review** — plans everything, writes nothing, shows the coverage report
4. **Generate, Validate & Publish** — writes, validates each module, warms Redis

### Option B — CLI

```bash
# Read-only: plan and print the coverage report
npx tsx scripts/generate-mock-series.ts --dry-run

# Write + publish + warm cache, both mediums, modules 1..100
npx tsx scripts/generate-mock-series.ts

# One medium / sub-range
npx tsx scripts/generate-mock-series.ts --medium english --from 1 --to 25
```

The script imports the same `lib/mock-tests/*` modules the API route uses, so a
dry run verifies the real code path rather than a copy.

---

## 3. How repetition is minimised

The generator plans the **whole series in one in-memory pass**, so
non-repetition is a property of the data structure rather than a query:
each pool is consumed, and Module 2 cannot see what Module 1 took until the
pool wraps around.

Selection priority:

1. questions never used before (`usage_count = 0`)
2. then least-used
3. correct section/subject — enforced by the **source table**
4. topic/chapter spread — proportional topic selection
5. difficulty distribution — blueprint ratios, clamped
6. question type — carried through
7. correct medium — enforced by the source table
8. active/valid questions only

Two mechanisms do the work (`lib/mock-tests/series-generator.ts`):

**Per-topic FIFO queues.** Taking a question pops the head and pushes it to the
tail, so a question can only come back after every other question in its topic
has been handed out. "Never-used first, then least-used" in O(1), no re-sorting.

**Proportional topic selection.** The next topic is the one with the lowest
`(draws + penalty × in-module draws) / topic size`. Topic sizes are extremely
skewed here — `telugu_subject_questions` has 37 topics ranging from 17 to 1,277
questions — so uniform round-robin drained small topics ~75× faster than large
ones. Weighting by pool size keeps every topic represented while drawing from
each in proportion to what it can supply.

**Repetition budget.** `DEFAULT_REUSE_BUDGET = 2` caps a difficulty bucket's
per-module share so the whole series draws at most `2 × poolSize` from it. This
matters because the blueprint asks for ~25% hard questions but
`english_subject_questions` has only 13 hard-labelled rows out of 4,293. Taken
literally that is 6 hard questions/module from a pool of 13 — about 46 uses each
over 100 modules, while thousands of medium questions went untouched. The bucket
is trimmed instead and the remainder drawn from buckets that can supply fresh
questions. **Every trim is reported.**

---

## 4. Why `question_uid` exists

`question_id` is only unique *within* a table. In the live data
`pedagogy_subject_questions` and `telugu_medium_math` share the ID space
`Q000001..Q005000` — **5,000 colliding IDs** (48,130 rows, 43,087 distinct bare
IDs).

A Telugu module contains both Pedagogy and Mathematics questions, so a bare
`question_id` there would either

- violate `UNIQUE(mock_test_id, question_id)` and reject a valid module, or
- let a Pedagogy answer key grade a Mathematics answer.

Everything — mappings, Redis payload, answer key, `mock_test_answers` — is keyed
on `question_table:question_id`.

---

## 5. Medium separation

Each blueprint section declares its source tables **per medium**
(`lib/mock-tests/blueprints.ts`). The table is the filter, because the `subject`
column is unreliable: `pedagogy_subject_questions.subject` is
`'Educational Psychology'` (not `'Pedagogy'`), `telugu_medium_science.subject` is
`'సైన్స్'`, and `english_medium_science.subject` is split across Physics /
Biology / Chemistry / Astronomy. The previous `ilike '%Science%'`-style filter
matched nothing in several tables.

| Section | English medium | Telugu medium |
| --- | --- | --- |
| GK & Current Affairs | `gk_english_medium` | `gk_telugu_medium` |
| Perspectives in Education | `pedagogy_english_medium` | `pedagogy_subject_questions` |
| Classroom Psychology | `pedagogy_english_medium` | `pedagogy_subject_questions` |
| Telugu (Language I) | `telugu_subject_questions` | `telugu_subject_questions` |
| English (Language II) | `english_subject_questions` | `english_subject_questions` |
| Mathematics | `math_english_medium` | `telugu_medium_math` |
| Science | `english_medium_science` | `telugu_medium_science` |
| Social Studies | `socal_english_medium` | `socal_telugu_medimum` |

The two language papers are shared on purpose: Language I is a Telugu paper and
Language II an English paper regardless of the candidate's medium.

Publishing **validates** that every question came from a table the blueprint
allows for that medium, so English and Telugu content cannot be mixed.

---

## 6. Caching & performance

Redis keys carry the version, so an in-flight attempt keeps the exact paper it
started:

```
mock:test:{testId}:v{version}:questions   client-safe payload (NO answers)
mock:test:{testId}:v{version}:key         answer key (SERVER ONLY)
mock:test:{testId}:v{version}:meta        test definition
```

- Cache is **warmed at publish time**, so the first student never pays for the cold read.
- On a miss: one batched DB read under a single-flight lock (no stampede), then re-warm.
- Cache-miss DB reads are **one query per source table**, never one per question.
- `mock_test_answers` grading writes back in **two** statements (correct / incorrect),
  replacing up to 160 un-awaited per-answer updates.

## 7. Question pagination vs module pagination

These are independent:

- **Module pagination** — `/api/dsc-sgt/mock-tests?medium=…&page=…&pageSize=20` → Module 1–20, 21–40, …
- **Question pagination** — `/api/dsc-sgt/mock-tests/[id]/questions?start=1&limit=50` → Q1–50, Q51–100, Q101–160

The exam page renders the first chunk immediately and streams the rest in the
background. Each chunk is **one** request served from a single Redis read.

## 8. Security

- `correct_answer` and `explanation` are never in the client payload or the questions endpoint.
- Answers are graded server-side from the answer-key cache key only.
- Saving an answer verifies the `question_uid` actually belongs to that module, and uses the **server's** question number, not the client's.
- A user can only read/modify their own attempt; a submitted attempt is immutable.
