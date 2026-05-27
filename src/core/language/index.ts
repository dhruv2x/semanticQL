import type { AggregateFunction } from "../ast/types.js";

export const AGGREGATE_FUNCTIONS: Readonly<Record<string, AggregateFunction>> = {
    "how many": "count",
    "count": "count",

    "sum": "sum",
    "total": "sum",

    "average": "avg",
    "avg": "avg",
    "mean": "avg",

    "maximum": "max",
    "max": "max",
    "highest": "max",
    "largest": "max",
    "greatest": "max",

    "minimum": "min",
    "min": "min",
    "lowest": "min",
    "smallest": "min",
    "least": "min",
};

export const AGGREGATE_KEYWORDS = Object.keys(AGGREGATE_FUNCTIONS);
