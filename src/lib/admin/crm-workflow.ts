import "server-only";
import { readCatalogState } from "./catalog-store";

export async function getCrmWorkflow() {
  return (await readCatalogState()).operations.crm_workflow ?? {};
}
