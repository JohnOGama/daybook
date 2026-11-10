'use client';

import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ITEM_ICONS } from './item-icons';
import { type ItemContent, type ItemField, ITEM_TYPES, type ItemType } from './vault-types';

type CustomField = ItemField & { key: string };

const newCustomField = (): CustomField => ({ key: crypto.randomUUID(), label: '', value: '', secret: true });
const isPreset = (type: ItemType, label: string) => ITEM_TYPES[type].fields.some((field) => field.label === label);

type VaultItemFormProps = {
  initial?: ItemContent;
  onSave: (content: ItemContent) => Promise<void>;
  onCancel: () => void;
};

export function VaultItemFormComponent({ initial, onSave, onCancel }: VaultItemFormProps) {
  const [type, setType] = useState<ItemType>(initial?.type ?? 'card');
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [presets, setPresets] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.fields ?? []).filter((field) => isPreset(initial?.type as ItemType, field.label)).map((field) => [field.label, field.value])),
  );
  const [custom, setCustom] = useState<CustomField[]>(() =>
    (initial?.fields ?? [])
      .filter((field) => !isPreset(initial?.type as ItemType, field.label))
      .map((field) => ({ ...field, key: crypto.randomUUID() })),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const changeCustom = (key: string, changes: Partial<ItemField>) =>
    setCustom((fields) => fields.map((field) => (field.key === key ? { ...field, ...changes } : field)));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === '') {
      setError('Give this item a name.');
      return;
    }
    const presetFields = ITEM_TYPES[type].fields.map(({ label, secret }) => ({ label, secret, value: presets[label] ?? '' }));
    const customFields = custom.map(({ label, value, secret }) => ({ label: label.trim(), value, secret }));
    const fields = [...presetFields.filter((field) => field.value.trim() !== ''), ...customFields.filter((field) => field.label !== '')];
    setError(undefined);
    setBusy(true);
    try {
      await onSave({ version: 1, type, name: name.trim(), fields, notes });
    } catch {
      setBusy(false);
    }
  }

  return (
    <article className="mx-auto max-w-[620px] px-4 pt-4 pb-16 md:px-8">
      <h2 className="text-2xl leading-tight font-semibold tracking-tight">{initial ? 'Edit item' : 'Add item'}</h2>
      {!initial && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(ITEM_TYPES) as ItemType[]).map((id) => {
            const Icon = ITEM_ICONS[id];
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={id === type ? 'default' : 'outline'}
                aria-pressed={id === type}
                onClick={() => setType(id)}
              >
                <Icon aria-hidden />
                {ITEM_TYPES[id].label}
              </Button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vault-item-name">Name</Label>
          <Input
            id="vault-item-name"
            autoComplete="off"
            placeholder="What is this?"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {ITEM_TYPES[type].fields.map(({ label, secret }, index) => (
          <div key={label} className="flex flex-col gap-1.5">
            <Label htmlFor={`vault-item-field-${index}`}>{label}</Label>
            <Input
              id={`vault-item-field-${index}`}
              type={secret ? 'password' : 'text'}
              autoComplete="off"
              value={presets[label] ?? ''}
              onChange={(event) => setPresets((current) => ({ ...current, [label]: event.target.value }))}
            />
          </div>
        ))}

        {custom.map((field, index) => (
          <div
            key={field.key}
            role="group"
            aria-label={`Custom field ${index + 1}`}
            className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2"
          >
            <Input
              aria-label="Field name"
              placeholder="Field name"
              autoComplete="off"
              value={field.label}
              onChange={(event) => changeCustom(field.key, { label: event.target.value })}
            />
            <Input
              aria-label="Field value"
              placeholder="Value"
              type={field.secret ? 'password' : 'text'}
              autoComplete="off"
              value={field.value}
              onChange={(event) => changeCustom(field.key, { value: event.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={field.secret ? 'Show this value' : 'Hide this value'}
              onClick={() => changeCustom(field.key, { secret: !field.secret })}
            >
              {field.secret ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove field"
              onClick={() => setCustom((fields) => fields.filter(({ key }) => key !== field.key))}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setCustom((fields) => [...fields, newCustomField()])}>
            <Plus aria-hidden />
            Add field
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vault-item-notes">Notes</Label>
          <Textarea id="vault-item-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </article>
  );
}
