import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { type PresenceMember, SpacePresenceContext } from '../hooks/useSpacePresence';
import { PresenceAvatarsComponent } from './PresenceAvatarsComponent';

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession } }));

const member = (userId: string, name: string, extra: Partial<PresenceMember> = {}): PresenceMember => ({
  userId,
  name,
  image: null,
  access: 'edit',
  clientIds: [1],
  ...extra,
});

function renderWith(members: PresenceMember[]) {
  useSession.mockReturnValue({ data: { user: { id: 'me' } } });
  const doc = new Y.Doc();
  return render(
    <SpacePresenceContext.Provider value={{ doc, awareness: new Awareness(doc), members, connected: true, synced: true, denied: false }}>
      <PresenceAvatarsComponent />
    </SpacePresenceContext.Provider>,
  );
}

describe('PresenceAvatarsComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows nothing when only you are here', () => {
    const { container } = renderWith([member('me', 'Me Myself', { access: 'owner' })]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing outside a space', () => {
    useSession.mockReturnValue({ data: { user: { id: 'me' } } });
    const { container } = render(<PresenceAvatarsComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows initials for each other person and their name and access on hover', async () => {
    renderWith([member('me', 'Me'), member('u2', 'Jane Doe'), member('u3', 'sam', { access: 'view' })]);
    const people = screen.getAllByRole('listitem');
    expect(people.map((person) => person.textContent)).toEqual(['JD', 'S']);
    await userEvent.hover(people[0]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Jane Doe · Can edit');
  });

  it('shows the picture when there is one', async () => {
    // jsdom never loads images, so pretend this one loaded.
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        naturalWidth = 1;
        complete = true;
        addEventListener(type: string, listener: (event: { currentTarget: unknown }) => void) {
          if (type === 'load') setTimeout(() => listener({ currentTarget: this }));
        }
        removeEventListener() {}
        set src(_value: string) {
          setTimeout(() => this.onload?.());
        }
      },
    );
    renderWith([member('u2', 'Jane Doe', { image: 'https://example.com/jane.png' })]);
    expect(await screen.findByRole('img', { name: 'Jane Doe' })).toHaveAttribute('src', 'https://example.com/jane.png');
  });

  it('shows four avatars, then +N listing the rest', async () => {
    const others = ['Ann A', 'Ben B', 'Cat C', 'Dan D', 'Eve E', 'Fay F'].map((name, index) => member(`u${index}`, name));
    renderWith(others);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['AA', 'BB', 'CC', 'DD', '+2']);
    await userEvent.hover(items[4]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Eve E');
    expect(tooltip).toHaveTextContent('Fay F');
  });
});
