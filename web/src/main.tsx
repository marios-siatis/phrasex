import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, Search, Sparkles, UserRound, X } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = API.replace(/\/api\/?$/, '');

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
type Logo = {
  name: string;
  url: string;
};
type Branding = {
  title: string;
  description: string;
  logoName: string;
};

type Quote = {
  id: string;
  quote: string;
  finalImageUrl: string;
  attribution?: string;
  author: string;
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
  const [logos, setLogos] = useState<Logo[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [view, setView] = useState<'home' | 'profile' | 'admin' | 'branding'>('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    request('/interests').then(setInterests);
    request('/quotes').then(setQuotes);
    request('/branding')
      .then(setBranding)
      .catch(() => null);
    request('/logos')
      .then((items: string[]) =>
        setLogos(items.map((name) => ({ name, url: `${API_BASE}/logos/${encodeURIComponent(name)}` })))
      )
      .catch(() => setLogos([]));
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
      const [imageResults, quoteResults] = await Promise.all([
        request(`/images/search?q=${encodeURIComponent(query)}`, token).catch(() => []),
        request(`/quotes?q=${encodeURIComponent(query)}`, token),
      ]);

      setPhotos(imageResults);
      setQuotes(quoteResults);
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
            <>
              <button className="adminLink" onClick={() => setView('admin')}>
                Studio
              </button>
              <button className="adminLink" onClick={() => setView('branding')}>
                Branding
              </button>
            </>
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
          logos={logos}
          branding={branding}
          onCreated={(q: Quote) => {
            setQuotes([q, ...quotes]);
            setView('home');
            setNotice('Your branded quote image is ready.');
          }}
        />
      )}

      {view === 'branding' && user?.isAdmin && (
        <BrandingPage
          token={token}
          logos={logos}
          branding={branding}
          onBrandingSaved={setBranding}
        />
      )}

      {view === 'home' && (
        <>
          <section className="hero">
            <p className="eyebrow">WORDS WORTH KEEPING</p>
            <h1>
              {branding?.title ?? 'Find a feeling.'}
              <br />
              <em>{branding?.description ?? 'Frame the moment.'}</em>
            </h1>
            <p>{branding?.description ?? 'Search a visual world made for your next meaningful thought.'}</p>
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
                    <p className="quoteAuthor">— {q.author}</p>
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

function Studio({
  token,
  logos,
  branding,
  onCreated,
}: {
  token: string;
  logos: Logo[];
  branding: Branding | null;
  onCreated: (q: Quote) => void;
}) {
  const [query, setQuery] = useState('love');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chosen, setChosen] = useState<Photo | null>(null);
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(branding?.logoName ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedLogo((current) => current ?? branding?.logoName ?? null);
  }, [branding]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setPhotos(await request(`/images/search?q=${encodeURIComponent(query)}`, token));
  };

  const create = async () => {
    if (!chosen || !quote || !author || !selectedLogo) return;
    setBusy(true);
    try {
      onCreated(
        await request('/admin/quotes', token, {
          method: 'POST',
          body: JSON.stringify({
            imageUrl: chosen.thumbnailUrl,
            quote,
            author,
            logoName: selectedLogo,
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
            Author *
            <input
              required
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Who said it?"
            />
          </label>

          <label>
            Logo *
            <div className="logoGrid">
              {logos.length ? (
                logos.map((logo) => (
                  <button
                    type="button"
                    key={logo.name}
                    className={selectedLogo === logo.name ? 'chosen' : ''}
                    onClick={() => setSelectedLogo(logo.name)}
                  >
                    <img src={logo.url} alt={logo.name} />
                  </button>
                ))
              ) : (
                <span className="small">No logos available yet.</span>
              )}
            </div>
          </label>

          <label>
            Quote text *
            <textarea
              required
              maxLength={260}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="The words you want to share..."
            />
          </label>

          <p className="small">
            The quote is centered on the image. The PhraseX wordmark is added underneath.
          </p>

          <button disabled={!chosen || !quote || !author || !selectedLogo || busy} className="gold" onClick={create}>
            {busy ? 'Creating image…' : 'Create quote image'}
          </button>
        </aside>
      </div>
    </section>
  );
}

function BrandingPage({
  token,
  logos,
  branding,
  onBrandingSaved,
}: {
  token: string;
  logos: Logo[];
  branding: Branding | null;
  onBrandingSaved: (b: Branding) => void;
}) {
  const [title, setTitle] = useState(branding?.title ?? 'PhraseX');
  const [description, setDescription] = useState(branding?.description ?? 'Create meaningful branded quote images.');
  const [logoName, setLogoName] = useState(branding?.logoName ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTitle(branding?.title ?? 'PhraseX');
    setDescription(branding?.description ?? 'Create meaningful branded quote images.');
    setLogoName(branding?.logoName ?? '');
  }, [branding]);

  const saveBranding = async () => {
    if (!title.trim() || !description.trim() || !logoName.trim()) {
      setNotice('Title, description, and logo are required.');
      return;
    }

    setBusy(true);
    try {
      const updatedBranding = await request('/branding', token, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          logoName,
        }),
      });

      onBrandingSaved(updatedBranding);
      setNotice('Branding settings saved.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
      window.setTimeout(() => setNotice(''), 4000);
    }
  };

  return (
    <section className="page studio">
      <p className="eyebrow">BRANDING</p>
      <h1>Branding settings</h1>
      <p className="intro">Manage the site title, summary, and default logo for quote creation.</p>

      <div className="studioSection">
        <label>
          Site title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label>
          Site description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label>
          Default logo
          <div className="logoGrid">
            {logos.length ? (
              logos.map((logo) => (
                <button
                  type="button"
                  key={logo.name}
                  className={logoName === logo.name ? 'chosen' : ''}
                  onClick={() => setLogoName(logo.name)}
                >
                  <img src={logo.url} alt={logo.name} />
                </button>
              ))
            ) : (
              <span className="small">No logos available yet.</span>
            )}
          </div>
        </label>

        <button type="button" className="gold" onClick={saveBranding} disabled={busy}>
          {busy ? 'Saving…' : 'Save branding'}
        </button>
        {notice && <p className="small">{notice}</p>}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
