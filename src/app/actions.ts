"use server";

import {
  mapCsvColumnsToJsVariables,
  type MapCsvColumnsToJsVariablesInput,
} from "@/ai/flows/map-csv-columns-to-js-variables";

export async function getColumnMapping(
  input: MapCsvColumnsToJsVariablesInput
): Promise<Record<string, string>> {
  try {
    const mapping = await mapCsvColumnsToJsVariables(input);
    return mapping;
  } catch (error) {
    console.error("Error getting column mapping from AI:", error);
    // Return an empty object on failure to allow manual mapping
    return {};
  }
}
