'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createItem, deleteItem, fetchItems, updateItem } from '../src/vault-api';
import { decryptJson, encryptJson } from '../src/vault-crypto';
import type { ItemContent, VaultItem, VaultRecord } from '../src/vault-types';
import { useItemKey } from './useVaultSpaceKey';

const decryptRecord = async (key: CryptoKey, record: VaultRecord): Promise<VaultItem> => ({
  id: record.id,
  updatedAt: record.updatedAt,
  content: await decryptJson<ItemContent>(key, record.id, record).catch(() => null),
});

// ponytail: decrypts every item on each change; keep decrypted items by id and iv if vaults get large
export function useVaultItems(spaceId: string) {
  const key = useItemKey(spaceId);
  const queryClient = useQueryClient();
  const queryKey = ['vault-items', spaceId];
  const { data: records, isError } = useQuery({ queryKey, queryFn: () => fetchItems(spaceId), enabled: key !== null });
  const [decrypted, setDecrypted] = useState<VaultItem[]>();

  useEffect(() => {
    if (!key || !records) {
      setDecrypted(undefined);
      return;
    }
    let isCurrent = true;
    void Promise.all(records.map((record) => decryptRecord(key, record))).then((items) => {
      if (isCurrent) setDecrypted(items);
    });
    return () => {
      isCurrent = false;
    };
  }, [key, records]);

  function optimistic<V>(patch: (variables: V, current: VaultRecord[]) => VaultRecord[]) {
    return {
      onMutate: async (variables: V) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData<VaultRecord[]>(queryKey) ?? [];
        queryClient.setQueryData<VaultRecord[]>(queryKey, patch(variables, previous));
        return previous;
      },
      onError: (error: Error, _variables: V, previous: VaultRecord[] | undefined) => {
        queryClient.setQueryData(queryKey, previous);
        toast.error(error.message);
      },
    };
  }

  const write = useMutation({
    mutationFn: ({ record: { updatedAt: _updatedAt, ...item }, isNew }: { record: VaultRecord; isNew: boolean }) =>
      isNew ? createItem({ ...item, spaceId }) : updateItem(item),
    ...optimistic<{ record: VaultRecord; isNew: boolean }>(({ record }, current) => [
      record,
      ...current.filter(({ id }) => id !== record.id),
    ]),
  });

  const removal = useMutation({
    mutationFn: deleteItem,
    ...optimistic<string>((id, current) => current.filter((record) => record.id !== id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  async function save(id: string | null, content: ItemContent): Promise<string> {
    if (!key) throw new Error('Unlock the vault first.');
    const itemId = id ?? crypto.randomUUID();
    const payload = await encryptJson(key, itemId, content);
    await write.mutateAsync({ record: { id: itemId, updatedAt: new Date().toISOString(), ...payload }, isNew: id === null });
    return itemId;
  }

  return { items: key ? decrypted : undefined, records, isError, save, remove: removal.mutate };
}
