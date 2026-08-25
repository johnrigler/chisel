bunOven3.daisy.js

commands:
    migrate
    ingest <dir>
    status
    oven [filter]
    dedupe
    next [count]
    prompt <oven_id>
    absorb <file> [oven_id]
    bakes
    export

common loop:
    cp bunOven.daisy.sqlite bunOven.daisy.sqlite.before3
    bun bunOven3.daisy.js migrate
    bun bunOven3.daisy.js dedupe
    bun bunOven3.daisy.js next
    bun bunOven3.daisy.js prompt 2 > prompt.2.a.fs
    # send prompt.2.a.fs through ChatGPT app, save response
    bun bunOven3.daisy.js absorb response.2.a.fs 2
    bun bunOven3.daisy.js export > bunOven3.exported

