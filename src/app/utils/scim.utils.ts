import type { ResourceApi } from '../../scim/api/resource.api.js';
import type { Resource, ResourceId } from '../../scim/model.js';

/**
 * Iterate over all remote resources of a given type and call a callback for each page of resources.
 *
 * @param args - The arguments for the operation.
 * @param args.source - The source resource API to fetch resources from.
 * @param args.pageCount - The number of resources to fetch per page.
 * @param args.callback - The callback to call for each page of resources.
 */
export async function forEachResourcePage<TResource extends Resource>(args: {
  source: ResourceApi<TResource>;
  pageCount?: number;
  callback: (resources: TResource[]) => Promise<void>;
}): Promise<void> {
  let startIndex = 1;
  const count = args.pageCount ?? 100;

  while (startIndex > 0) {
    const resources = await args.source.list({
      pagination: {
        startIndex,
        count,
      },
    });

    await args.callback(resources.Resources ?? []);

    if (resources.Resources?.length === count) {
      startIndex += count;
    } else {
      startIndex = -1;
    }
  }
}

/**
 * Fetch all IDs from a given resource API.
 *
 * @param args - The arguments for the operation.
 * @param args.source - The source resource API to fetch IDs from.
 * @param args.pageCount - The number of resources to fetch per page.
 * @returns A set of resource IDs.
 */
export async function fetchAllIds<TResource extends Resource>(args: {
  source: ResourceApi<TResource>;
  pageCount?: number;
}): Promise<Set<ResourceId>> {
  const ids = new Set<ResourceId>();
  await forEachResourcePage<TResource>({
    ...args,
    callback: async resources => {
      for (const resource of resources) {
        if (resource.id) {
          ids.add(resource.id);
        }
      }
    },
  });
  return ids;
}
