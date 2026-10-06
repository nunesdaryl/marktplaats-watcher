# Frozen RAG dataset

`python -m evals.export_rag_snapshot <read-only Convex export.zip>` writes
`snapshot.json` from `users`, `watches`, `alerts`, and `alertEmbeddings`. It
removes user identity and all seller fields. Review the output before committing:
listing titles and reasons can still contain personal information. Then manually
label about 15 questions in `cases.json` using this shape:

```json
[{"id":"Q1","owner":"owner-001","question":"Which M5 Pro alert did I get?","expectedAlertIds":["<real alert id>"]}]
```

Label absent-result questions with an empty id list. Keep an owner-only M5 Pro
case and a second owner with no access to it. The runner rejects missing labels,
duplicate ids, and non-original vector dimensions. No producer is called during
the export or eval. Do not commit the original archive.

Recall@5 is averaged over questions with at least one expected alert. Precision@5
uses five as its denominator. The offline replay uses the original vectors and
the keyword-first merge from `embeddings.ts`; its local token overlap stands in
for Convex Search's ranking, so it does not measure the hosted search index.
