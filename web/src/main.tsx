import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Search, Sparkles, UserRound, X } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type Interest = { id: number; name: string };

type User = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  interestIds: number[];
};

type Photo = {
  id: number;
  alt: string;
  photographer: string;
  url: string;
  thumbnailUrl: string;
};

type Quote = {
  id: string;
  quote: string;
  finalImageUrl: string;
  attribution?: string;
};

const request = async (path: string, token?: string, options?: RequestInit) => {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || 'Something went wrong.');
  }

  return response.status === 204 ? null : response.json();
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('px_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [query, setQuery] = useState('inspiration');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [view, setView] = useState<'home' | 'profile' | 'admin'>('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    request('/interests').then(setInterests);
    request('/quotes').then(setQuotes);
  }, []);

  useEffect(() => {
    if (!token) return;

    request('/profile', token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('px_token');
        setToken('');
      });
  }, [token]);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    try {
      setPhotos(await request(`/images/search?q=${encodeURIComponent(query)}`, token));
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const authenticated = (data: { token: string; user: User }) => {
    localStorage.setItem('px_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
  };

  if (!token) {
    return (
      <>
        <Landing onSignIn={() => setAuthOpen(true)} />
        {authOpen && <Auth onClose={() => setAuthOpen(false)} onAuth={authenticated} />}
      </>
    );
  }

  return (
    <main>
      <header>
        <a className="brand" onClick={() => setView('home')}>
          <Sparkles size={21} /> Phrase<span>X</span>
        </a>

        <form className="search" onSubmit={search}>
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images to inspire you"
          />
          <button>Search</button>
        </form>

        <nav>
          <button className="icon" onClick={() => setView('profile')} title="Profile">
            <UserRound />
          </button>
          {user?.isAdmin && (
            <button className="adminLink" onClick={() => setView('admin')}>
              Studio
            </button>
          )}
          <button className="avatar" onClick={() => setView('profile')}>
            {user?.displayName?.[0]}
          </button>
        </nav>
      </header>

      {notice && (
        <div className="notice">
          {notice}
          <button onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {view === 'profile' && user && (
        <Profile user={user} interests={interests} token={token} save={setUser} />
      )}

      {view === 'admin' && user?.isAdmin && (
        <Studio
          token={token}
          onCreated={(q: Quote) => {
            setQuotes([q, ...quotes]);
            setView('home');
            setNotice('Your branded quote image is ready.');
          }}
        />
      )}

      {view === 'home' && (
        <>
          <section className="hero">
            <p className="eyebrow">WORDS WORTH KEEPING</p>
            <h1>
              Find a feeling.
              <br />
              <em>Frame the moment.</em>
            </h1>
            <p>Search a visual world made for your next meaningful thought.</p>
            <button className="gold" onClick={() => search()}>
              Explore images <Search size={17} />
            </button>
          </section>

          <section className="content">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">CURATED FOR YOU</p>
                <h2>{photos.length ? `Results for “${query}”` : 'Fresh from PhraseX'}</h2>
              </div>
              <span>{photos.length ? `${photos.length} images` : 'Quote collection'}</span>
            </div>

            {photos.length ? (
              <div className="imageGrid">
                {photos.map((p) => (
                  <figure key={p.id}>
                    <img src={p.thumbnailUrl} alt={p.alt} />
                    <figcaption>Photo by {p.photographer}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="quoteGrid">
                {quotes.map((q) => (
                  <article key={q.id}>
                    <img
                      src={`${import.meta.env.VITE_IMAGE_URL}${q.finalImageUrl}`}
                      alt={q.quote}
                    />
                    <p>{q.quote}</p>
                  </article>
                ))}
                {!quotes.length && (
                  <p className="empty">No published quotes yet. Search Pexels above to begin exploring.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="landing">
      <header>
        <a className="brand">
          <Sparkles size={21} /> Phrase<span>X</span>
        </a>
        <button className="outline" onClick={onSignIn}>
          Sign in
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">A SMALL SPACE FOR BIG FEELINGS</p>
        <h1>
          Words that stay
          <br />
          <em>with you.</em>
        </h1>
        <p>Discover visual inspiration and quotes shaped around what matters to you.</p>
        <button className="gold" onClick={onSignIn}>
          Start your collection <Heart size={17} />
        </button>
      </section>
    </main>
  );
}

function Auth({
  onClose,
  onAuth,
}: {
  onClose: () => void;
  onAuth: (d: { token: string; user: User }) => void;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = register
        ? { email, password, displayName: name }
        : { email, password };

      onAuth(
        await request(register ? '/auth/register' : '/auth/login', undefined, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="modal">
      <form className="dialog" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <X />
        </button>

        <p className="eyebrow">WELCOME TO PHRASEX</p>
        <h2>{register ? 'Create your account' : 'Welcome back'}</h2>

        {register && (
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        <label>
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="gold">{register ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="textButton" onClick={() => setRegister(!register)}>
          {register ? 'Already a member? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}

function Profile({
  user,
  interests,
  token,
  save,
}: {
  user: User;
  interests: Interest[];
  token: string;
  save: (u: User) => void;
}) {
  const [name, setName] = useState(user.displayName);
  const [selected, setSelected] = useState(user.interestIds);
  const [saved, setSaved] = useState(false);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    save(
      await request('/profile', token, {
        method: 'PUT',
        body: JSON.stringify({ displayName: name, interestIds: selected }),
      })
    );
    setSaved(true);
  };

  return (
    <section className="page narrow">
      <p className="eyebrow">YOUR SPACE</p>
      <h1>Your profile</h1>
      <p className="intro">Tell us what moves you. Pick as many themes as you like.</p>

      <form onSubmit={submit}>
        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <h3>Your interests</h3>
        <div className="chips">
          {interests.map((i) => (
            <button
              type="button"
              onClick={() => toggle(i.id)}
              className={selected.includes(i.id) ? 'selected' : ''}
              key={i.id}
            >
              {selected.includes(i.id) && '✓ '}
              {i.name}
            </button>
          ))}
        </div>

        <button className="gold">Save profile</button>
        {saved && <span className="saved">Saved</span>}
      </form>
    </section>
  );
}

function Studio({ token, onCreated }: { token: string; onCreated: (q: Quote) => void }) {
  const [query, setQuery] = useState('love');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chosen, setChosen] = useState<Photo | null>(null);
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setPhotos(await request(`/images/search?q=${encodeURIComponent(query)}`, token));
  };

  const create = async () => {
    if (!chosen || !quote) return;
    setBusy(true);
    try {
      onCreated(
        await request('/admin/quotes', token, {
          method: 'POST',
          body: JSON.stringify({
            imageUrl: chosen.thumbnailUrl,
            quote,
            attribution: `Photo by ${chosen.photographer} on Pexels`,
          }),
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page studio">
      <p className="eyebrow">ADMIN STUDIO</p>
      <h1>Make a quote image</h1>

      <div className="studioLayout">
        <div>
          <form className="search studioSearch" onSubmit={search}>
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
            <button>Find photos</button>
          </form>

          <div className="picker">
            {photos.map((p) => (
              <button
                onClick={() => setChosen(p)}
                className={chosen?.id === p.id ? 'chosen' : ''}
                key={p.id}
              >
                <img src={p.thumbnailUrl} alt={p.alt} />
              </button>
            ))}
          </div>
        </div>

        <aside>
          <div className="preview">
            {chosen ? <img src={chosen.thumbnailUrl} /> : <span>Select a Pexels image</span>}
          </div>

          <label>
            Quote text
            <textarea
              maxLength={260}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="The words you want to share..."
            />
          </label>

          <p className="small">
            The quote is centered on the image. The PhraseX wordmark is added underneath.
          </p>

          <button disabled={!chosen || !quote || busy} className="gold" onClick={create}>
            {busy ? 'Creating image…' : 'Create quote image'}
          </button>
        </aside>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
