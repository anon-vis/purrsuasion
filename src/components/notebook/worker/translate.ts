/*
Python primitives get translated into javascript primitives by default
Python objects get translated into PyProxy objects (extension of Proxy)
  - These need to get translated before being sent back to the main thread because they are not clone-able
IMPORTANT: PyProxy objects must be stored and then destroyed to avoid memory leaks
*/

import type { TranslatedPyOutput } from "./types";

export function translatePyOutput(output: any): TranslatedPyOutput {
  if (!output) {
    return {
      type: "no output",
      value: output,
    };
  }

  const isPyProxy =
    typeof output === "object" && output !== null && "toJs" in output;

  if (!isPyProxy) {
    const stringified = String(output);

    console.log(stringified);

    if (stringified.startsWith("PythonError")) {
      const error = stringified.split('File "<exec>",')[1].trimStart();
      // console.log(error);
      return {
        type: "error",
        value: error,
      };
    }

    return {
      type: "raw",
      value: stringified,
    };
  }

  try {
    const cls = output.__class__;
    const className = cls.__name__;
    const moduleName = cls.__module__;

    if (className.includes("Chart") && moduleName.includes("altair")) {
      // Safely call to_json, parse, embed
      const jsonStr = output.to_json();
      const spec = JSON.parse(jsonStr);
      cls.destroy();
      return {
        type: "altair chart",
        value: spec,
      };
    }

    if ("to_html" in output) {
      const html = output.to_html();
      cls.destroy();
      console.log("html");
      return {
        type: "html",
        value: html,
      };
    }

    if ("_repr_html_" in output) {
      const html = output._repr_html_();
      cls.destroy();
      return {
        type: "html",
        value: html,
      };
    }

    cls.destroy();

    return {
      type: "raw",
      value: String(output),
    };
  } catch (err) {
    console.error(`Error rendering output: ${err}`);
    return {
      type: "error",
      value: err,
    };
  } finally {
    try {
      output.destroy();
    } catch {}
  }
}
