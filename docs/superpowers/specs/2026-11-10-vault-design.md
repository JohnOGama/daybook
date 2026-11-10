# Vault design

Date: 2026-11-10

Items marked **(my call)** were chosen by Claude, not the owner, and can be overruled. Approved mockup: [vault.html](vault.html), next to this document.

## What it is

A Vault is a third tool for a space, beside List and Notebook. It holds private things such as cards, ID numbers, logins, API keys, secret keys and anything else. It sits behind its own passcode, and everything in it is encrypted in the browser before it is saved.

## Goals

- Save and find cards, IDs, credentials, keys and free-form items in one place.
- Secret values stay masked until asked for, and can be copied in one click.
- The database and the API only ever hold scrambled data.
- A forgotten passcode can be recovered with a recovery key.
- The whole vault can be exported as an encrypted backup, viewed, and imported into any Daybook account.

## Non-goals (for now)

All **(my call)**:

- Resetting a passcode by email or through the server, which would let the server open the vault.
- A readable export such as a spreadsheet, since anyone finding that file would get everything.
- Browser autofill or an extension, password generation, breach checks.
- Sharing items, attachments, fingerprint or face unlock.

## Anti-goals

These would make it a failure even if everything else worked:

- An item's contents, the passcode or the vault key reaches the server, a log or browser storage in readable form.
- One person can see, change or erase another person's vault.

## What this protects against

Say this plainly wherever the feature is described. Encryption protects against:

- Someone reading the database or a backup of it.
- Someone signed in to the owner's Daybook account who does not know the passcode.

It does not protect against:

- Malware on the owner's device, or someone using the device while the vault is unlocked.
- Someone who takes over the web server and changes the code it sends to browsers. Any vault served from a website has this limit.
- A passcode that is easy to guess. Anyone holding a copy of the database or a backup file can try guesses offline, as fast as their hardware allows. That is why the passcode has a minimum length.
- Someone who finds the recovery key and is signed in as the owner. It opens the vault as fully as the passcode does, so it must be kept outside Daybook.
- Losing both the passcode and the recovery key with no backup that either can open. That vault is gone.

The server can see how many items exist, roughly how big each is, and when each changed. The space's title is not encrypted.

## Screens

Follow the mockup. The space opens at `/vault?space=<id>` and is listed in the sidebar with a lock icon and no count.

- **First time:** passcode, type it again, and an acknowledgement, then Create vault. The acknowledgement reads: "I understand that if I forget this passcode and lose my recovery key, nobody can recover what's in the vault."- **Recovery key:** shown once straight after First time, with Copy, Download and a tick box before Continue.
- **Locked:** passcode and Unlock. Under it, "Forgot passcode?" (see Recovery).
- **Unlocked:** laid out like Notebook. On the left are the title, item count, Add item, search and the items, most recently changed first. On the right is the open item. The top right shows "Locks after 5 minutes idle", Lock now and an options menu with Export backup, Import backup, Change passcode and New recovery key.
- **Open item:** name, type, a row per field, notes, Updated date, Edit and Delete.
- **Add and Edit:** one form in the right-hand pane, not a dialog. A row of type buttons, Name, the type's fields, Add field, Notes, Cancel and Save. Save is explicit; there is no autosave.

Change passcode opens a small dialog asking for the current passcode and the new one, typed twice **(my call)**.

## Items

Every item has a name, a type, fields and notes.

| Type | Fields (secret ones marked) |
|---|---|
| Card | Name on card, Card number (secret), Expiry, CVV (secret) |
| ID | Kind of ID, Number (secret), Expiry date |
| Login | Website, Username, Password (secret) |
| Key | Service, Key or secret (secret) |
| Other | None |

- Any item can have extra fields with names you choose. Each has a show/hide control in the form and is hidden by default, since anything added there may be sensitive **(my call)**.
- Only Name is required **(my call)**.
- The line under a name in the list is worked out in the browser: last four digits for a Card, expiry for an ID, username for a Login, service for a Key, number of fields for Other **(my call)**.
- Search runs in the browser over name, type and that line, never over secret values **(my call)**.
- Show reveals one value and each row has Copy. Choosing another item or locking hides everything again **(my call)**.
- Copy tries to clear the clipboard 30 seconds later. Browsers only allow this while the tab has focus, and Windows clipboard history is out of reach, so it is best effort and must not be described as a guarantee **(my call)**.

## Encryption

All **(my call)**, using the browser's built-in Web Crypto so no library is added.

- **Vault key:** a random 256-bit AES-GCM key, created once in the browser and non-extractable once unlocked.
- **Passcode:** at least 12 characters. It is turned into a wrapping key with PBKDF2-SHA-256, a random 16-byte salt and 600,000 iterations, which wraps the vault key with AES-GCM.
- **Stored per person:** salt, iteration count and wrapped vault key. A wrong passcode is detected by the unwrap failing.
- **Refuse weak settings:** the browser refuses to use fewer than 600,000 iterations, so a tampered server can't weaken it.
- **Stored per item:** ciphertext and a fresh random 12-byte IV for every save. The plaintext is JSON holding a format version, type, name, fields and notes. The item's id is bound in as additional authenticated data, so ciphertexts can't be swapped between items.
- **Recovery key:** 160 random bits shown as eight groups of four base-32 characters. Because it is long and random, HKDF-SHA-256 with its own random 16-byte salt is enough to turn it into a second wrapping key, which wraps the same vault key.
- **Stored per person, for recovery:** the recovery salt and the recovery-wrapped vault key. The recovery key itself is never stored or sent.
- **Changing passcode:** ask for the current passcode, unwrap an extractable copy of the vault key for that one step, and re-wrap it with a new salt. Items are not re-encrypted, and the recovery key keeps working.
- **Unreadable item:** if one item fails to decrypt, it appears as "Can't read this item" with Delete, and the rest of the vault still works.

### While unlocked

- The key is held only in memory, in a provider above the routes, so moving to another space does not lock the vault.
- Refresh, closing the tab, sign-out, Lock now and 5 minutes with no pointer or keyboard activity all lock it. Each tab unlocks separately **(my call)**.
- Locking drops the key and every decrypted value.
- The passcode and decrypted values never go in React Query's cache, local or session storage, the URL, toasts, or logs. The query cache holds ciphertext only.
- Web Crypto only exists on HTTPS and localhost. Anywhere else, such as a LAN address, the page says the vault needs a secure connection instead of failing strangely.

## Server

- `spaces.tool` gains `vault`.
- A `vaults` table has one row per person: user, salt, iterations, wrapped key, recovery salt, recovery-wrapped key, timestamps. One passcode covers all of a person's vault spaces; unlocking once unlocks them all **(my call)**.
- A `vault_items` table: id (generated in the browser), user, space, ciphertext, IV, created, updated, deleted.
- Every query is scoped to `userId`, and the space must belong to the person and be a Vault, as in `NotebookService`.
- Validation: IV is exactly 12 bytes, ciphertext has a size cap of 64 KB, salt is exactly 16 bytes, iterations are at least 600,000 **(my call)**.
- Creating a second `vaults` row for a person is refused.
- Request bodies on these routes are never logged.

## Existing behaviour

- Add, edit and delete follow the app's rule: the change shows immediately, a server refusal undoes it with an error message, and a success does not refetch.
- Delete asks first and moves the item to Trash, still encrypted.
- In Trash, an item shows its name when the vault is unlocked and "Encrypted item" when it is locked. Restore works either way **(my call)**.
- Deleting a vault space moves it and its items to Trash like any other space.
- Vault spaces have no Duplicate, in the menu or the API, because the server can't re-encrypt items **(my call)**.
- Loading states use Skullet.

## Recovery

"Forgot passcode?" asks for the recovery key and a new passcode, typed twice. The browser unwraps the vault key with the recovery key and re-wraps it under the new passcode. Items stay as they are.

New recovery key, from the options menu, asks for the passcode, shows a new key once, and replaces the stored recovery wrap, so the old key stops working. Existing backup files still open with whichever passcode and recovery key they were exported with **(my call)**.

## Export and import

All **(my call)**:

- **Export backup** downloads one JSON file named by date, holding a format version, the passcode wrap with its salt and iterations, the recovery wrap with its salt, and every item in the open space that isn't in Trash, as id, IV and ciphertext. The browser builds it from data the server already holds, and nothing in it is readable.
- **Import backup** runs inside an unlocked vault, so a brand-new account creates its vault first. Choose the file and enter the passcode or recovery key from when it was exported.
- **Viewing:** the file is opened in the browser and its items are listed with secret values masked and a show control, before anything is saved. Cancel leaves the vault untouched.
- **Importing:** each item is decrypted with the backup's key, using its original id as authenticated data, then encrypted with this vault's key under a new id. Items are added to the open space in one all-or-nothing request, and nothing is replaced. Importing the same file twice gives duplicates.
- The same limits apply to a file as to the server: at least 600,000 iterations, and the 64 KB cap per item. An import is capped at 2,000 items and 8 MB. A file that isn't a valid backup, or a wrong passcode or key, shows an error and imports nothing.
- A backup keeps opening with the old passcode after that passcode is changed, so old backup files should be treated as sensitive.

## Erasing

"Lost your recovery key too?" on the recovery screen offers Erase vault, after a confirmation where the person types ERASE. It permanently deletes their `vaults` row and all their vault items, including those in Trash, then shows First time again. Vault spaces stay, empty. This is the only permanent delete in the app, and it is needed so losing both secrets doesn't leave someone stuck **(my call)**.

## Must hold

Runnable checks cover:

- Encrypting and decrypting an item round-trips, and the stored bytes don't contain the plaintext.
- A wrong passcode fails to unlock; fewer than 600,000 iterations is refused.
- A ciphertext moved onto a different item id fails to decrypt.
- Changing passcode keeps items readable and rejects the old passcode.
- The recovery key sets a new passcode with items intact; a wrong key is refused; a replaced key stops working.
- A backup opens with its passcode or recovery key, imports into a different account under new ids, and is refused when tampered with or below 600,000 iterations.
- Nothing is saved until Import is confirmed, and a failed import saves nothing.
- Locking clears the key and decrypted values, and idle time locks the vault.
- One user is refused another's vault and items, including erase.
- Item routes refuse a space that isn't a Vault.
- Erase removes the vault and items for that person only.

## Left to the builder

API routes, component breakdown, base64 or binary storage, migration details and the exact placement of the Change passcode dialog.

Before deploying, the README's "Before deploying" section should gain: serve over HTTPS, and add a Content-Security-Policy so injected scripts can't read an unlocked vault.
