# Model Human Weight as Type-Aware Recalculable Evidence

Human Weight is a current estimate of human substance on a Knowledge Entry, interpreted through Type Behavior rather than a universal ranking. Weight-bearing entry types may expose Human Weight, while non-weight-bearing types omit it. Type Behavior also defines the default Human Weight Expectation and credited human role; for example, authored entries credit the contributor and Quotes credit the quoted person when that person is known.

Human Weight is recalculable from durable evidence. Explicit feedback, Knowledge Slot Fulfillment evidence, and later derived activity signals are Human Weight Evidence; they support the estimate without directly becoming the estimate. Evidence Maturity stays separate from the score and helps the Answer Feed give low-maturity weight-bearing entries enough exposure to gather review.

The current MVP calculation is represented by a versioned Human Weight Calculation Definition. Recalculation snapshots the active definition, stores calculation provenance on updated entries, and runs through a bounded scheduled job. Future formula changes should introduce a new definition version rather than changing the meaning of an existing version.

Quote attribution uses direct type-detail data rather than a generic cross-type person-role table. Direct contributions and accepted Smart Storage Quote proposals create `quoteEntries`; when exactly one Person Tag is present in the accepted context, that Person becomes the credited quoted person. Ambiguous or missing Person context leaves the Quote unattributed until a later review/edit flow exists.
