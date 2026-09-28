---
title: LoCoMo eval
description: How turbomem ingests LoCoMo conversations and scores QA with the official category-aware F1.
---

# LoCoMo

We use the [LoCoMo](https://github.com/snap-research/locomo) `locomo10.json` split (Maharana et al., ACL 2024). The file is **downloaded**, not vendored. See that repository for license and citation.

## Ingest

For each conversation:

1. Map `session_N` turns to turbomem `Message`s. Speaker A is `user`, speaker B is `assistant`. Session timestamps and BLIP captions are included in the text so temporal and multimodal clues can be extracted.
2. Call `memory.add(sessionMessages, { userId: locomo_<sample_id> })` per session (LLM extraction + embed + dedup).
3. For each QA item, `memory.search(question, { userId, limit: 10 })`.
4. Generate a short answer from **retrieved facts only**. If nothing relevant is retrieved, the model is instructed to say `no information available`.
5. Score with the official LoCoMo F1 function, not an LLM judge.

## Category IDs in `locomo10.json`

The integer `category` field does **not** follow the numbered list in the paper. The evaluation code is the source of truth:

| ID | Type | Scoring |
| -- | ---- | ------- |
| 1 | Multi-hop | Comma-split multi-answer F1 |
| 2 | Temporal | Token F1 |
| 3 | Open-domain | Token F1; gold is truncated at the first `;` |
| 4 | Single-hop | Token F1 |
| 5 | Adversarial | 1 iff the prediction contains `no information available` or `not mentioned` |

Token F1 lowercases, strips punctuation, drops `{a, an, the, and}`, then applies the Porter stemmer (NLTK/Porter 1980), matching `task_eval/evaluation.py`.

## Smoke vs full

`--smoke` evaluates the first conversation and the first 20 questions. Published snapshots always use the full `locomo10` set and set `"smoke": false`.

## Citation

```
@article{maharana2024evaluating,
  title={Evaluating very long-term conversational memory of llm agents},
  author={Maharana, Adyasha and Lee, Dong-Ho and Tulyakov, Sergey and Bansal, Mohit and Barbieri, Francesco and Fang, Yuwei},
  journal={arXiv preprint arXiv:2402.17753},
  year={2024}
}
```
