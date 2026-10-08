#!/bin/bash

echo "ENDPOINT: $ENDPOINT"
echo "COLLECTION: $COLLECTION"

# RESET=true: delete the collection first if it exists, so a re-run (e.g. a
# PR preview re-running e2e against a collection left over from a previous
# push) always starts from a clean collection instead of accumulating stale
# vectors. No-op (curl -sf swallows a 404) when the collection is absent.
if [ "${RESET:-false}" = "true" ]; then
    echo "RESET=true — deleting any existing collection first"
    curl -sf -X DELETE "$ENDPOINT/collections/$COLLECTION" >/dev/null 2>&1 || true
fi

status=`curl -sf $ENDPOINT/collections/$COLLECTION | grep ok | wc -l`


if [ "$status" -eq "1" ]; then
    echo 'Collection already exists'
    exit 0;
fi

curl -sf -X PUT $ENDPOINT/collections/$COLLECTION -H 'Content-Type: application/json' -d '{"vectors":{"size":1024,"distance":"Cosine"}}'

echo "Collection $COLLECTION created";
