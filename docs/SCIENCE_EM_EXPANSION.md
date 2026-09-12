# English-medium Science bank — gap analysis and expansion

Table: `english_medium_science` (Section 7 of the AP DSC SGT blueprint, 24 Q per mock).

## What the analysis found

The bank held **1,249 rows**, against **2,099** in the mirror table `telugu_medium_science`
over the same 110-chapter taxonomy — so the English side was roughly 60% the depth of the
Telugu side, chapter for chapter.

Coverage was checked concept by concept against the AP DSC SGT science syllabus
(classes 5-10 content plus science pedagogy), 733 concepts in six areas:

| Area | Concepts absent | Concepts with a single question |
|---|---|---|
| Physics | 26 | 29 |
| Chemistry | 41 | 19 |
| Biology | 59 | 31 |
| Environment | 16 | 24 |
| Earth & Space | 18 | 13 |
| Methodology | 35 | 22 |
| **Total** | **195** | **138** |

Whole syllabus blocks were missing, not just stray questions — animal phyla
(Porifera through Mammalia), plant groups, plant hormones and tropisms, tissue types,
metallurgy (roasting, calcination, smelting, refining), organic chemistry
(functional groups, homologous series, esterification, saponification, polymers),
the mole concept, the periodic law, biogeochemical cycles, environmental legislation
and treaties, India's space programme, and — most costly for the exam — much of
science pedagogy: objectives, the analytic/synthetic/problem-solving methods,
laboratory organisation, and item analysis.

A second defect: **difficulty was `Hard` 977 / `Medium` 272 / `Easy` 0**, while the
blueprint asks for 25% easy / 50% medium / 25% hard. `lib/mock-tests/question-bank.ts`
already documents this table as having no easy questions at all.

## What was added

**804 new questions**, taking the table to **2,053 rows** — near parity with the Telugu bank.

- Every one of the 195 absent concepts is now covered, and the thin ones deepened.
- Difficulty split of the new rows: 167 easy / 429 medium / 208 hard, moving the pool
  from 0% easy to 8.1% easy and from 78% hard to 58% hard. The pool is still
  hard-heavy: the 1,185 existing hard rows cannot be diluted to 25% by adding
  alone. `generator.ts` clamps the blueprint ratio to what the pool supplies, so this
  degrades gracefully, but a further easy-weighted batch (or re-grading some
  mislabelled hard rows) would close the rest.
- Answer keys across the whole table: A 512 / B 531 / C 510 / D 500.

Authored rows carry the existing conventions exactly — `source_type`
`AUTHORED_QUALITY_V7`, `language` `English`, `question_id` in the
`APSGT-SCI-EM-V7-*` namespace — plus an `expansion_v8` tag so the batch can be
identified or rolled back:

```sql
select count(*) from english_medium_science where tags like '%expansion_v8%';
```

## Scripts

| Script | Purpose |
|---|---|
| `scripts/analyze-science-coverage.mjs` | read-only chapter/topic/subtopic coverage map |
| `scripts/dump-science-json.mjs` | read-only export of the table to JSON |
| `scripts/add-english-science-questions.mjs` | ingests `data/science-em-expansion/*.json` |
| `scripts/verify-science-expansion.mjs` | read-only post-insert integrity check |

The ingest script is additive — it never deletes or rewrites a row, so no mock-test
reference can break. It is a dry run by default and refuses to write unless every
candidate passes:

- four distinct non-empty options, answer in A-D, non-empty explanation/topic/subtopic
- chapter must already exist, and its subject must match the pairing the table uses
- no stem may contain its own correct option as a run of words
- **no duplicates** — a candidate whose normalised stem already exists in the table,
  or appeared earlier in the batch, is dropped (17 were caught this way)
- `question_id` minted from a hash of the stem and collision-checked against the table

Because authoring puts the correct option first, the script re-places it across A-D on a
rotation, which is why the new rows come out at exactly 201 per letter. Inserts run in a
transaction with `on conflict (question_id) do nothing`, so re-running is idempotent.

Verified after apply: 2,053 rows, 2,053 distinct ids, **0 duplicate normalised stems**,
0 blank questions or explanations, 0 bad answer keys, 0 duplicated option sets.
