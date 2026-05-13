const PREFIXES = "ABCDEFGHiJKLMNoPQSTUVWXYZ123456789";
const FILLERS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

async function testWithVariableFiller() {
    const results = [];

    for (let i = 0; i < PREFIXES.length; i++) {
        const inputPrefix = "D" + PREFIXES[i] + "x";

        for (let j = 0; j < FILLERS.length; j++) {
            const filler = FILLERS[j];
            const input = inputPrefix + filler;

            let output;

            try {
                output = await unspendable(input);
            } catch (err) {
                continue;
            }

            if (typeof output !== "string") continue;

            if (output.startsWith(inputPrefix)) {
                results.push({
                    requested: inputPrefix,
                    tried: input,
                    output: output
                });
                break;
            }
        }
    }

    console.table(results);
    console.log(results.map(r => r.requested + " via " + r.tried + " -> " + r.output).join("\n"));
}

testWithVariableFiller();
