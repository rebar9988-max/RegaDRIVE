# Patenti A/B source staging

The Italian Ministry portal links the Italian-language Patenti A/B PDF in its
[30 October 2026 catalogue notice](https://www.ilportaledellautomobilista.it/web/portale-automobilista/dettaglio-news/-/asset_publisher/V57QhEdoCmc7/content/quiz-per-le-patenti-am-a-b-superiori-e-cqc).

With PyMuPDF installed, stage the downloaded PDF in a new directory outside this repository.

```sh
python3 scripts/stage-italy-patente.py /path/to/patenti-ab.pdf /path/to/new-private-stage
```

The extractor verifies the source hash and accounts for 7,020 unique statements,
7,020 answer keys, 715 groups, 3,919 image references and 407 distinct images over
586 pages. The private JSON retains ministry question numbers, Italian text, true/false
answers, source pages, topics and references to extracted images.

The source is the shared A/B catalogue. The staged data has no individual B-only
eligibility labels or Kurdish translations. It is an intake format. The existing
licensed importer uses German multiple-choice rules. Before a learner-facing import,
record reuse rights for this release and its images, implement the Italian true/false
import in the licensed content workflow, and review the chapter mappings and translations.
