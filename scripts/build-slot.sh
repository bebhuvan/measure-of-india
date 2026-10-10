#!/bin/sh
# scripts/build-slot.sh <command...>: run a build-and-check in one of TWO machine-wide slots.
# Several sessions share one machine (docs/briefs/README.md, "Disk"); a single lock queued
# them for over an hour (a full gates run takes 15-20 min), while the machine can hold two
# builds at once. The command runs once a slot is free, and the slot is released when it
# exits. Delete ./dist with a plain command straight after, so no build is left behind.
#   scripts/build-slot.sh sh -c 'npx astro build && npm run gates'; rm -rf ./dist
SLOTS="${ATLAS_BUILD_SLOTS:-2}"
while :; do
  i=1
  while [ "$i" -le "$SLOTS" ]; do
    if mkdir "/tmp/atlas-build-slot-$i.d" 2>/dev/null; then
      trap 'rmdir "/tmp/atlas-build-slot-'"$i"'.d" 2>/dev/null' EXIT INT TERM
      echo "$$ $(date +%H:%M) $*" > "/tmp/atlas-build-slot-$i.d/holder" 2>/dev/null
      "$@"; s=$?
      rm -f "/tmp/atlas-build-slot-$i.d/holder"; rmdir "/tmp/atlas-build-slot-$i.d" 2>/dev/null; trap - EXIT INT TERM
      exit $s
    fi
    # a slot whose holder process is gone is stale: free it
    h=$(cut -d' ' -f1 "/tmp/atlas-build-slot-$i.d/holder" 2>/dev/null)
    if [ -n "$h" ] && ! kill -0 "$h" 2>/dev/null; then rm -f "/tmp/atlas-build-slot-$i.d/holder"; rmdir "/tmp/atlas-build-slot-$i.d" 2>/dev/null; continue; fi
    i=$((i + 1))
  done
  sleep 15
done
