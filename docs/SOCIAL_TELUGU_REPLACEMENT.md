# Telugu-medium Social Studies bank — full replacement (2026-09-12)

`socal_telugu_medimum` was replaced with
`ap_sgt_social_studies_telugu_medium_production_bank_2026-09-12.csv`:
**4,836 rows removed, 2,606 imported.**

## Why the old bank was replaced

The old rows carried the same boilerplate-preamble defect that was cleaned out of the
science banks — stems padded with framing that told the candidate nothing:

> ఉపాధ్యాయుడి వివరణ తర్వాత నది సముద్రంలో కలిసే ప్రాంతంలో ఏర్పడే భూస్వరూపం…
> ఒక చిన్న ప్రాజెక్టులో ఎత్తైన, నిటారైన సహజ భూస్వరూపంకు సరైన జత ఏది?

The new bank states the question directly, and its difficulty spread matches the
blueprint almost exactly: **Easy 636 / Medium 1,296 / Hard 674** (24 / 50 / 26 against a
target of 25 / 50 / 25). Answer keys are balanced A 638 / B 664 / C 629 / D 675.

## The part that needed care

103 mock tests (**100 of them published**) drew 2,472 question slots from this table —
24 slots each. Only **95** of the 2,434 distinct referenced ids exist in the new CSV, so a
plain swap would have emptied the Social Studies section of every live Telugu module.

Worse, 162 ids appear in both banks but **158 of them carry different question text**, so
those slots would have silently started showing a different question.

Rather than unpublishing the affected modules (the pattern used by
`replace-english-science.mjs`), the 2,377 orphaned slots were **refilled from the new
pool**: each slot kept its `question_number`, `section_id`, `section_name` and `marks`,
and received a replacement question chosen least-used-first and excluded from questions
already present in that module. No question is reused more than once across the whole
series, and no module contains a duplicate. `mock_question_usage` was then recomputed
from `mock_test_questions`, which the schema treats as the source of truth.

## Verified after the run

| Check | Result |
|---|---|
| rows / distinct question_id | 2,606 / 2,606 |
| bad answer keys, blank fields, duplicate options | 0 / 0 / 0 |
| duplicate question stems | 0 |
| dangling slots (question no longer exists) | **0** |
| affected tests still published | **100 of 100** |
| tests with a full slot count | 100 (the 3 shortfalls are pre-existing drafts) |
| modules containing a duplicate question | 0 |
| stale `mock_question_usage` rows | 0 |

A published module was rendered end to end as a final check: 160 slots, all resolving.

## Known issue — section purity

**728 of the 2,606 rows (28%) are not Social Studies content:** Perspectives in Education
(228), Social methodology (312), Educational Psychology (140) and GK & Current Affairs
(48). `blueprints.ts` gives the `social` section the whole table, so Section 8 can now
serve pedagogy and GK questions. Imported as supplied, by decision. To fix later, add a
chapter filter to the social section (or move those chapters into
`pedagogy_subject_questions` and `gk_telugu_medium`, which already back Sections 1-3).

Also note `class_level` is `III-VIII (difficulty up to X)` for 2,444 rows rather than a
bare class number. Nothing filters on it today, so it is cosmetic.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/replace-social-telugu-questions.mjs` | validate, swap, refill slots, rebuild usage |
| `scripts/verify-social-telugu-replace.mjs` | read-only post-replace integrity check |

Both talk to **PostgREST over HTTPS**, not `pg`: `db.<ref>.supabase.co` publishes only an
AAAA record and the IPv6 route from this machine times out. PostgREST offers no
multi-statement transaction, so the replace is not atomic — full JSON backups of
`socal_telugu_medimum`, the affected `mock_test_questions` rows and the affected
`mock_question_usage` rows are written to `supabase/backups/` before the first write.
