"""Reporting domain — read-only cross-domain aggregation. Owns no tables of its own;
every service function here calls other domains' SERVICE layers only (never their
models or repositories directly), per the architecture's cross-domain rule.
"""