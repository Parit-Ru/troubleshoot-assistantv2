# Third-party model notice

This repository contains a **modified copy** of a pre-trained sentence-embedding model in
`backend/model-slim/Xenova/paraphrase-multilingual-MiniLM-L12-v2/`.
It is used by the symptom-search feature to turn a user's description of a problem into a
384-dimensional vector.

## Origin

- **Original model:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  <https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2>
  License: **Apache License, Version 2.0** (as stated on the model page).
  The model page lists the paper arXiv:1908.10084.
- **ONNX export used as the starting point:** `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
  <https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2>,
  file `onnx/model_quantized.onnx` (8-bit quantized). Its publisher describes the repository as
  the ONNX weights of the model above, for use with Transformers.js.

The full text of the Apache License 2.0 is in `LICENSE-APACHE-2.0.txt` (in this folder).

## Modifications made in this repository

The model was modified with `scripts/slim_model.py`. The changes are:

1. **Vocabulary reduced.** Rows of the word-embedding table were removed for every vocabulary
   token that contains a character other than Thai script, ASCII, or common punctuation and
   symbols. The table went from 250,037 rows to 87,519 rows. All special tokens were kept, and the
   ids of `<s>`, `<pad>`, `</s>` and `<unk>` (0 to 3) are unchanged.
2. **Files rewritten to match.** `tokenizer.json`, `config.json` (`vocab_size`) and
   `tokenizer_config.json` were rewritten so token ids match the reduced table
   (the `<mask>` token moved from id 250001 to id 87518).
3. **No other weights were changed.** The script checks that every other tensor in the ONNX graph
   is byte-for-byte identical to the original.

Effect: for text made only of the kept characters, the modified model produces the same
embeddings as the original (verified bit-for-bit on 141 test texts with Transformers.js,
see `backend/scripts/compare-models.js`). Characters outside the kept set are mapped to the
unknown token `<unk>`.

## Warranty

The model is provided on an "AS IS" basis, as described in the Apache License 2.0.