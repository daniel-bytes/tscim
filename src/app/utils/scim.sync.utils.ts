import type { ResourceApi } from '../../scim/api/resource.api.js';
import type { ScimApi } from '../../scim/api/scim.api.js';
import type { Resource } from '../../scim/model.js';
import { fetchAllIds, forEachResourcePage } from './scim.utils.js';

/**
 * Synchronize all resources from a source SCIM API to a target SCIM API.
 *
 * @param args - The arguments for the operation.
 * @param args.syncFrom - The source SCIM API to fetch resources from.
 * @param args.syncTo - The target SCIM API to sync resources to.
 * @param args.pageCount - The number of resources to fetch per page.
 * @param args.deleteOrphanedResources - When true, delete local resources that are not present in the remote.
 */
export async function syncResources(args: {
  syncFrom: ScimApi;
  syncTo: ScimApi;
  pageCount?: number;
  deleteOrphanedResources?: boolean;
}): Promise<void> {
  await syncResourcesOfType({
    ...args,
    syncFrom: args.syncFrom.resources.users,
    syncTo: args.syncTo.resources.users,
  });

  if (args.syncFrom.resources.groups && args.syncTo.resources.groups) {
    await syncResourcesOfType({
      ...args,
      syncFrom: args.syncFrom.resources.groups,
      syncTo: args.syncTo.resources.groups,
    });
  }
}

/**
 * Synchronize all resources of a given type.
 *
 * @param args - The arguments for the operation.
 * @param args.syncFrom - The source resource API to fetch resources from.
 * @param args.syncTo - The target resource API to sync resources to.
 * @param args.pageCount - The number of resources to fetch per page.
 * @param args.deleteOrphanedResources - When true, delete local resources that are not present in the remote.
 */
export async function syncResourcesOfType<TResource extends Resource>(args: {
  syncFrom: ResourceApi<TResource>;
  syncTo: ResourceApi<TResource>;
  pageCount?: number;
  deleteOrphanedResources?: boolean;
}): Promise<void> {
  const syncFromIds = new Set<string>();
  const syncToIds = await fetchAllIds<TResource>({
    ...args,
    source: args.syncTo,
  });

  // Iterate overa ll resources from the source and sync to the target.
  await forEachResourcePage<TResource>({
    ...args,
    source: args.syncFrom,
    callback: async resources => {
      // TODO: Use bulk operations API if available.
      for (const resource of resources) {
        if (resource.id) {
          if (syncToIds.has(resource.id)) {
            // TODO: Can we build an option to use PATCH as well as PUT?
            await args.syncTo.update({
              id: resource.id,
              resource,
            });
          } else {
            await args.syncTo.create({
              resource,
            });
          }
          syncFromIds.add(resource.id);
        }
      }
    },
  });

  if (args.deleteOrphanedResources) {
    // TODO: Use bulk operations API if available.
    for (const localId of syncToIds) {
      if (!syncFromIds.has(localId)) {
        await args.syncTo.delete({ id: localId });
      }
    }
  }
}
