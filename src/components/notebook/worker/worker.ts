import { loadPyodide, type PyodideAPI } from "pyodide";
import type { WorkerRequest, WorkerResponse } from "./types";
import { translatePyOutput } from "./translate";

let PYODIDE: PyodideAPI;
let PYTHON_NAMESPACE: any;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type } = event.data;
  try {
    switch (type) {
      case "init":
        const promptCategory = event.data.promptCategory;

        PYODIDE = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.2/full/",
        });

        await PYODIDE.loadPackage(["pandas", "altair", "numpy", "jedi"]);
        const dataResponse = await fetch(`/data/${promptCategory}.csv`);

        if (!dataResponse.ok) {
          console.log("Something went wrong loading round data.");
        }

        const dataArrayBuffer = await dataResponse.arrayBuffer();
        const dataUint8Array = new Uint8Array(dataArrayBuffer);
        PYODIDE.FS.writeFile(`/${promptCategory}.csv`, dataUint8Array);

        // Load GeoJSON files for hsam category
        console.log(promptCategory);
        if (promptCategory === "hsam") {
          const geoJsonFiles = [
            "counties.geojson",
            "regions.geojson",
            "states.geojson",
          ];

          for (const filename of geoJsonFiles) {
            const geoResponse = await fetch(`/data/${filename}`);
            if (geoResponse.ok) {
              const geoArrayBuffer = await geoResponse.arrayBuffer();
              const geoUint8Array = new Uint8Array(geoArrayBuffer);
              PYODIDE.FS.writeFile(`/${filename}`, geoUint8Array);
            } else {
              console.log(`Failed to load ${filename}`);
            }
          }
        }

        PYTHON_NAMESPACE = PYODIDE.globals.get("dict")();
        await PYODIDE.runPythonAsync(`
import pandas as pd
import numpy as np
import altair as alt
  `);

        // Store in namespace
        PYTHON_NAMESPACE.set("pd", PYODIDE.globals.get("pd"));
        PYTHON_NAMESPACE.set("np", PYODIDE.globals.get("np"));
        PYTHON_NAMESPACE.set("alt", PYODIDE.globals.get("alt"));

        self.postMessage({ id: id, type: "init", success: true });
        break;
      case "run":
        // Run the code in the global namespace so variables persist
        const result = await PYODIDE.runPythonAsync(event.data.python, {
          globals: PYTHON_NAMESPACE,
        });
        const translatedOutput = translatePyOutput(result);

        self.postMessage({
          id: id,
          type: "run",
          output: translatedOutput,
        });
        break;
      case "interrupt":
        PYODIDE.setInterruptBuffer(event.data.interruptBuffer);
        self.postMessage({
          id: id,
          type: "interrupt",
          success: true,
        });
        break;
      case "completions":
        const { code, line, column } = event.data;

        const jediScript = `
import jedi
import sys

# Get ALL variables from the current global namespace
# This includes pd, np, alt, and any user-defined variables
current_namespace = {}
for key, value in globals().items():
    # Skip built-ins and private variables to avoid clutter
    if not key.startswith('__'):
        current_namespace[key] = value

# Create Jedi Interpreter with the complete runtime context
interpreter = jedi.Interpreter('''${code.replace(
          /'/g,
          "\\'"
        )}''', [current_namespace])

# Get completions at the specified position
completions = interpreter.complete(${line + 1}, ${column})

# Format results
result = []
for c in completions[:5]:  # Limit to 5 results
    try:
        comp_dict = {
            'label': c.name,
            'type': c.type,
            'detail': c.full_name if hasattr(c, 'full_name') else '',
            'documentation': '',
            'signature': ''
        }
        
        # Try to get docstring safely
        if hasattr(c, 'docstring'):
            try:
                doc = c.docstring(raw=True)
                if doc:
                    comp_dict['documentation'] = doc[:200]
            except:
                pass
                
        result.append(comp_dict)
    except Exception as e:
        # Skip problematic completions
        continue

result
`;

        // Run the Jedi script in the same namespace where user code runs
        const completionsResult = await PYODIDE.runPythonAsync(jediScript, {
          globals: PYTHON_NAMESPACE,
        });

        const completions = completionsResult.toJs({
          dict_converter: Object.fromEntries,
        });

        completionsResult.destroy();

        self.postMessage({
          id: id,
          type: "completions",
          completions: completions,
        });
        break;
    }
  } catch (err) {
    const translatedOutput = translatePyOutput(err);

    const message: WorkerResponse = {
      id: id,
      type: "run",
      output: translatedOutput,
    };

    self.postMessage(message);
  }
};
