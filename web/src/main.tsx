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
  const [view, setView] = useState<'home' | 'profile' | 'admin'>('home');
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
          logos={logos}
          branding={branding}
          onBrandingSaved={setBranding}
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
            {/* <button className="gold" onClick={() => search()}>
              Explore images <Search size={17} />
            </button> */}
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
  onBrandingSaved,
  onCreated,
}: {
  token: string;
  logos: Logo[];
  branding: Branding | null;
  onBrandingSaved: (b: Branding) => void;
  onCreated: (q: Quote) => void;
}) {
  const [query, setQuery] = useState('love');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chosen, setChosen] = useState<Photo | null>(null);
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(branding?.logoName ?? null);
  const [brandingTitle, setBrandingTitle] = useState(branding?.title ?? 'PhraseX');
  const [brandingDescription, setBrandingDescription] = useState(branding?.description ?? 'Create meaningful branded quote images.');
  const [brandingLogo, setBrandingLogo] = useState(branding?.logoName ?? '');
  const [busy, setBusy] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingNotice, setBrandingNotice] = useState('');

  useEffect(() => {
    setBrandingTitle(branding?.title ?? 'PhraseX');
    setBrandingDescription(branding?.description ?? 'Create meaningful branded quote images.');
    setBrandingLogo(branding?.logoName ?? '');
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

  const saveBranding = async () => {
    if (!brandingTitle.trim() || !brandingDescription.trim() || !brandingLogo.trim()) {
      setBrandingNotice('Title, description, and logo are required.');
      return;
    }

    setSavingBranding(true);
    try {
      const updatedBranding = await request('/branding', token, {
        method: 'PUT',
        body: JSON.stringify({
          title: brandingTitle,
          description: brandingDescription,
          logoName: brandingLogo,
        }),
      });

      onBrandingSaved(updatedBranding);
      setBrandingNotice('Branding settings saved.');
      setSelectedLogo((current) => current ?? updatedBranding.logoName);
    } catch (err) {
      setBrandingNotice((err as Error).message);
    } finally {
      setSavingBranding(false);
      window.setTimeout(() => setBrandingNotice(''), 4000);
    }
  };

  return (
    <section className="page studio">
      <p className="eyebrow">ADMIN STUDIO</p>
      <h1>Make a quote image</h1>

      <div className="studioLayout">
        <div>
          <section className="studioSection">
            <p className="eyebrow">BRANDING</p>
            <h2>Site title, description, and default quote logo</h2>
            <p className="small">Configure the website branding and choose the default logo for new quote images.</p>

            <label>
              Site title
              <input value={brandingTitle} onChange={(e) => setBrandingTitle(e.target.value)} />
            </label>

            <label>
              Site description
              <textarea value={brandingDescription} onChange={(e) => setBrandingDescription(e.target.value)} />
            </label>

            <label>
              Default logo
              <div className="logoGrid">
                {logos.length ? (
                  logos.map((logo) => (
                    <button
                      type="button"
                      key={logo.name}
                      className={brandingLogo === logo.name ? 'chosen' : ''}
                      onClick={() => {
                        setBrandingLogo(logo.name);
                        setSelectedLogo((current) => current ?? logo.name);
                      }}
                    >
                      <img src={logo.url} alt={logo.name} />
                    </button>
                  ))
                ) : (
                  <span className="small">No logos available yet.</span>
                )}
              </div>
            </label>

            <button type="button" className="gold" onClick={saveBranding} disabled={savingBranding}>
              {savingBranding ? 'Saving…' : 'Save branding'}
            </button>
            {brandingNotice && <p className="small">{brandingNotice}</p>}
          </section>

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

createRoot(document.getElementById('root')!).render(<App />);
