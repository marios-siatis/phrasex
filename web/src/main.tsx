import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Heart, LogOut, Search, Sparkles, UserRound, X } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = API.replace(/\/api\/?$/, '');

type Category = { id: number; name: string };

type User = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  categoryIds: number[];
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
  category?: string;
};

type AdminQuoteImage = {
  id: string;
  quote: string;
  author: string;
  category: string;
  finalImageUrl: string;
};

type InstagramAccount = {
  id: number;
  instagramUserId: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  createdAt: string;
};

type ScheduledPost = {
  id: number;
  quoteImageId: string;
  instagramAccountId: number;
  instagramAccountDisplayName: string;
  scheduledAt: string;
  posted: boolean;
  createdAt: string;
  quoteImage: AdminQuoteImage;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('inspiration');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [view, setView] = useState<'home' | 'profile' | 'admin' | 'branding' | 'upload' | 'schedule'>('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [quotePreview, setQuotePreview] = useState<Quote | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    request('/categories').then(setCategories);
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
      const quoteResults = await request(`/quotes?q=${encodeURIComponent(query)}`, token);

      setPhotos([]);
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

  const signOut = () => {
    localStorage.removeItem('px_token');
    setToken('');
    setUser(null);
    setProfileMenuOpen(false);
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
          {user?.isAdmin && (
            <>
              <button className="adminLink" onClick={() => setView('admin')}>
                Studio
              </button>
              <button className="adminLink" onClick={() => setView('branding')}>
                Branding
              </button>
              <button className="adminLink" onClick={() => setView('upload')}>
                CSV Upload
              </button>
              <button className="adminLink" onClick={() => setView('schedule')}>
                Schedule
              </button>
            </>
          )}
          <div className="profileMenu">
            <button
              className="icon"
              onClick={() => setProfileMenuOpen((open) => !open)}
              title="Account menu"
              aria-label="Account menu"
              aria-expanded={profileMenuOpen}
            >
              <UserRound />
            </button>
          <button
            className="avatar"
            onClick={() => setProfileMenuOpen((open) => !open)}
            aria-label="Account menu"
            aria-expanded={profileMenuOpen}
          >
            {user?.displayName?.[0]}
          </button>
          {profileMenuOpen && (
            <div className="profileMenuPopover">
              <button
                type="button"
                onClick={() => {
                  setView('profile');
                  setProfileMenuOpen(false);
                }}
              >
                <UserRound size={16} /> Profile
              </button>
              <button type="button" onClick={signOut}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
          </div>
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
        <Profile user={user} categories={categories} token={token} save={setUser} />
      )}

      {view === 'admin' && user?.isAdmin && (
        <Studio
          token={token}
          logos={logos}
          branding={branding}
          categories={categories}
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

      {view === 'upload' && user?.isAdmin && (
        <UploadCsvPage token={token} />
      )}

      {view === 'schedule' && user?.isAdmin && (
        <SchedulePage token={token} />
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
                  <button
                    type="button"
                    className="quotePin"
                    key={q.id}
                    onClick={() => setQuotePreview(q)}
                    aria-label={`Preview quote: ${q.quote}`}
                  >
                    <img
                      src={`${import.meta.env.VITE_IMAGE_URL}${q.finalImageUrl}`}
                      alt={q.quote}
                    />
                    <span className="quotePinDetails">
                      <strong>“{q.quote}”</strong>
                      <span>— {q.author}</span>
                    </span>
                  </button>
                ))}
                {!quotes.length && (
                  <p className="empty">No published quotes yet. Search Pexels above to begin exploring.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {quotePreview && (
        <div
          className="modal"
          role="presentation"
          onMouseDown={() => setQuotePreview(null)}
        >
          <section
            className="dialog quotePreviewDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-quote-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="scheduleDialogClose"
              onClick={() => setQuotePreview(null)}
              aria-label="Close quote preview"
            >
              <X size={18} />
            </button>
            <h2 id="home-quote-preview-title">Quote preview</h2>
            <img
              className="quotePreviewImage"
              src={`${import.meta.env.VITE_IMAGE_URL}${quotePreview.finalImageUrl}`}
              alt={quotePreview.quote}
            />
            <p className="small">
              “{quotePreview.quote}” — {quotePreview.author}
            </p>
          </section>
        </div>
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
  categories,
  token,
  save,
}: {
  user: User;
  categories: Category[];
  token: string;
  save: (u: User) => void;
}) {
  const [name, setName] = useState(user.displayName);
  const [selected, setSelected] = useState(user.categoryIds);
  const [saved, setSaved] = useState(false);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    save(
      await request('/profile', token, {
        method: 'PUT',
        body: JSON.stringify({ displayName: name, categoryIds: selected }),
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

        <h3>Your categories</h3>
        <div className="chips">
          {categories.map((i) => (
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
  categories,
  onCreated,
}: {
  token: string;
  logos: Logo[];
  branding: Branding | null;
  categories: Category[];
  onCreated: (q: Quote) => void;
}) {
  const [query, setQuery] = useState('love');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [chosen, setChosen] = useState<Photo | null>(null);
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
    'from', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'was', 'were', 'with', 'you', 'your', 'i', 'me', 'my', 'we',
    'our', 'they', 'their', 'he', 'she', 'his', 'her'
  ]);

  const generateTags = (text: string) => {
    const words = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word && !STOP_WORDS.has(word));

    return [...new Set(words)].join(', ');
  };

  const effectiveLogo = selectedLogo ?? branding?.logoName;

  useEffect(() => {
    setSelectedLogo((current) => current ?? null);
    setSelectedCategoryId((current) => current ?? ((categories && categories[0]) ? categories[0].id : null));
  }, [branding]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setPhotos(await request(`/images/search?q=${encodeURIComponent(query)}`, token));
  };

  const create = async () => {
    if (!chosen || !quote.trim() || !author.trim() || !selectedCategoryId || !effectiveLogo) {
      return;
    }

    setBusy(true);
    setCreateError('');

    try {
      const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
      const tagsParam = encodeURIComponent(tagsInput || '');

      const createdQuote = await request(
        `/admin/quotes${tagsParam ? `?tags=${tagsParam}` : ''}`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            imageUrl: chosen.thumbnailUrl,
            quote: quote.trim(),
            author: author.trim(),
            category: selectedCategory?.name ?? '',
            logoName: effectiveLogo,
          }),
        }
      );

      onCreated(createdQuote);
    } catch (err) {
      setCreateError((err as Error).message);
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
              onChange={(e) => {
                setAuthor(e.target.value);
                setCreateError('');
              }}
              placeholder="Who said it?"
            />
          </label>

          <label>
            Category *
            <select
              required
              value={selectedCategoryId ?? undefined}
              onChange={(e) => {
                setSelectedCategoryId(Number(e.target.value));
                setCreateError('');
              }}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tags (optional, comma separated)
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </label>

          <label>
            Logo
            <div className="logoGrid">
              {logos.length ? (
                logos.map((logo) => (
                  <button
                    type="button"
                    key={logo.name}
                    className={effectiveLogo === logo.name ? 'chosen' : ''}
                    onClick={() => setSelectedLogo(logo.name)}
                  >
                    <img src={logo.url} alt={logo.name} />
                  </button>
                ))
              ) : (
                <span className="small">No logos available yet.</span>
              )}
            </div>
            <p className="small">
              {effectiveLogo
                ? `Using ${effectiveLogo} as the selected logo.`
                : 'Select a logo or save one as the default branding logo.'}
            </p>
          </label>

          <label>
            Quote text *
            <textarea
              required
              maxLength={260}
              value={quote}
              onChange={(e) => {
                const nextQuote = e.target.value;
                setQuote(nextQuote);
                setTagsInput(generateTags(nextQuote));
                setCreateError('');
              }}
              placeholder="The words you want to share..."
            />
          </label>

          {createError && (
            <div
              role="alert"
              style={{
                marginTop: '12px',
                padding: '14px 16px',
                border: '1px solid rgba(220, 38, 38, 0.45)',
                borderRadius: '10px',
                background: 'rgba(220, 38, 38, 0.08)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '5px' }}>
                Quote not saved
              </strong>
              <span>{createError}</span>
            </div>
          )}

          <p className="small">
            The quote is centered on the image. The PhraseX wordmark is added underneath.
          </p>

          <button
            disabled={!chosen || !quote.trim() || !author.trim() || !effectiveLogo || !selectedCategoryId || busy}
            className="gold"
            onClick={create}
          >
            {busy ? 'Creating image…' : 'Create quote image'}
          </button>
        </aside>
      </div>
    </section>
  );
}

function UploadCsvPage({ token }: { token: string }) {
  type DuplicateQuote = {
    quote: string;
    author: string;
    category: string;
  };

  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inserted, setInserted] = useState<number | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateQuote[]>([]);

  const upload = async () => {
    if (!file) {
      setNotice('Choose a CSV file first.');
      setDuplicates([]);
      return;
    }

    setBusy(true);
    setNotice('');
    setInserted(null);
    setDuplicates([]);

    const form = new FormData();
    form.append('file', file);

    try {
      const response = await fetch(`${API}/admin/textquotes/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || 'Upload failed.');
      }

      const result = await response.json();
      const duplicateQuotes: DuplicateQuote[] = Array.isArray(result.duplicates)
        ? result.duplicates
        : [];

      setInserted(result.inserted ?? 0);
      setDuplicates(duplicateQuotes);

      if (duplicateQuotes.length > 0) {
        setNotice(
          `Imported ${result.inserted ?? 0} quotes. ` +
          `${duplicateQuotes.length} duplicate${duplicateQuotes.length === 1 ? '' : 's'} skipped.`
        );
      } else {
        setNotice(`Imported ${result.inserted ?? 0} quotes. No duplicates found.`);
      }

      setFile(null);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page studio">
      <p className="eyebrow">CSV IMPORT</p>
      <h1>Upload text quotes</h1>
      <p className="intro">Import plain quote text entries into PhraseX from a CSV file.</p>

      <div className="studioSection">
        <label>
          CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setNotice('');
              setInserted(null);
              setDuplicates([]);
            }}
          />
        </label>

        <p className="small">
          The CSV must include headers: <strong>Quote</strong>, <strong>Author</strong>, and <strong>Category</strong>.
        </p>

        <button type="button" className="gold" onClick={upload} disabled={busy}>
          {busy ? 'Uploading…' : 'Upload CSV'}
        </button>

        {notice && <p className="small">{notice}</p>}
        {inserted !== null && <p className="small">Imported {inserted} text quotes.</p>}

        {duplicates.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: '24px',
              padding: '18px',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              borderRadius: '10px',
              background: 'rgba(220, 38, 38, 0.06)',
            }}
          >
            <h3
              style={{
                color: '#dc2626',
                margin: '0 0 14px',
              }}
            >
              Duplicate quotes skipped ({duplicates.length})
            </h3>

            <ul
              style={{
                margin: 0,
                paddingLeft: '22px',
                color: '#dc2626',
              }}
            >
              {duplicates.map((duplicate, index) => (
                <li
                  key={`${duplicate.quote}-${index}`}
                  style={{ marginBottom: '14px' }}
                >
                  <strong>{duplicate.quote}</strong>

                  <div style={{ marginTop: '4px' }}>
                    — {duplicate.author}
                    {duplicate.category ? ` · ${duplicate.category}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function SchedulePage({ token }: { token: string }) {
  const [quoteImages, setQuoteImages] = useState<AdminQuoteImage[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [accountForm, setAccountForm] = useState({
    instagramUserId: '',
    displayName: '',
    accessToken: '',
    refreshToken: '',
  });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'accounts' | 'quotes' | 'scheduled'>('quotes');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<
    'all' | 'failed' | 'scheduled' | 'posted'
  >('all');
  const [scheduleTimeSort, setScheduleTimeSort] = useState<'asc' | 'desc'>(
    'asc'
  );
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<AdminQuoteImage | null>(null);

  const getNextAvailableTime = () => {
    return new Date().toISOString();
  };

  const getSuggestedScheduleTime = (
    accountId = selectedAccountId,
    posts = scheduledPosts
  ) => {
    const latestPost = posts
      .filter((post) => accountId === null || post.instagramAccountId === accountId)
      .sort(
        (first, second) =>
          new Date(second.scheduledAt).getTime() -
          new Date(first.scheduledAt).getTime()
      )[0];

    if (!latestPost) return getNextAvailableTime();

    return new Date(
      new Date(latestPost.scheduledAt).getTime() + 3 * 60 * 60 * 1000
    ).toISOString();
  };

  const getScheduleOptions = (suggestedTime = scheduledAt) => {
    const options: { value: string; label: string }[] = [];
    const start = new Date();
    start.setMinutes(start.getMinutes() + (30 - (start.getMinutes() % 30)));
    start.setSeconds(0);
    start.setMilliseconds(0);

    for (let i = 0; i < 56; i += 1) {
      const optionDate = new Date(start.getTime() + i * 30 * 60 * 1000);
      options.push({
        value: optionDate.toISOString(),
        label: optionDate.toLocaleString(),
      });
    }

    if (suggestedTime && !options.some((option) => option.value === suggestedTime)) {
      options.push({
        value: suggestedTime,
        label: new Date(suggestedTime).toLocaleString(),
      });
      options.sort(
        (first, second) =>
          new Date(first.value).getTime() - new Date(second.value).getTime()
      );
    }

    return options;
  };

  const load = async () => {
    const [quoteResponse, accountResponse, postsResponse] = await Promise.all([
      request('/admin/quoteimages', token),
      request('/admin/instagramaccounts', token),
      request('/admin/scheduledposts', token),
    ]);

    setQuoteImages(Array.isArray(quoteResponse) ? quoteResponse : []);
    setAccounts(Array.isArray(accountResponse) ? accountResponse : []);
    setScheduledPosts(Array.isArray(postsResponse) ? postsResponse : []);

    if (!selectedAccountId && accountResponse?.length > 0) {
      setSelectedAccountId(accountResponse[0].id);
    }

    if (!scheduledAt) {
      const initialAccountId = selectedAccountId ?? accountResponse?.[0]?.id ?? null;
      setScheduledAt(
        getSuggestedScheduleTime(
          initialAccountId,
          Array.isArray(postsResponse) ? postsResponse : []
        )
      );
    }
  };

  useEffect(() => {
    if (!token) return;

    load().catch((err) => setNotice((err as Error).message));
  }, [token]);

  const refresh = async () => {
    setBusy(true);
    setNotice('');

    try {
      await load();
      setNotice('Schedule data refreshed.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async () => {
    if (
      !accountForm.instagramUserId.trim() ||
      !accountForm.displayName.trim() ||
      !accountForm.accessToken.trim()
    ) {
      setNotice('Instagram user ID, display name, and access token are required.');
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      const created = await request('/admin/instagramaccounts', token, {
        method: 'POST',
        body: JSON.stringify({
          instagramUserId: accountForm.instagramUserId.trim(),
          displayName: accountForm.displayName.trim(),
          accessToken: accountForm.accessToken.trim(),
          refreshToken: accountForm.refreshToken.trim() || null,
        }),
      });

      setAccounts((current) => [...current, created]);
      setSelectedAccountId(created.id);
      setAccountForm({
        instagramUserId: '',
        displayName: '',
        accessToken: '',
        refreshToken: '',
      });
      setNotice('Instagram account saved.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connectWithInstagram = async () => {
    try {
      setNotice('');
      const res = await request('/admin/instagramauth/url', token);

      if (res?.url) {
        window.open(res.url, '_blank', 'noopener');
        setNotice('Instagram login opened. Complete the connection, then refresh.');
      }
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const disconnectAccount = async (id: number) => {
    if (!confirm('Disconnect this Instagram account?')) return;

    setBusy(true);

    try {
      await request(`/admin/instagramaccounts/${id}`, token, {
        method: 'DELETE',
      });
      await load();
      setNotice('Account disconnected.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    if (!selectedQuoteId || !selectedAccountId || !scheduledAt) {
      setNotice('Select a quote, account, and scheduled time.');
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      await request('/admin/scheduledposts', token, {
        method: 'POST',
        body: JSON.stringify({
          quoteImageId: selectedQuoteId,
          instagramAccountId: selectedAccountId,
          scheduledAt,
        }),
      });

      await load();
      setScheduleModalOpen(false);
      setNotice('Scheduled post created.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openScheduleModal = (quoteId: string, accountId = selectedAccountId) => {
    setSelectedQuoteId(quoteId);
    if (accountId !== null) setSelectedAccountId(accountId);
    setScheduledAt(getSuggestedScheduleTime(accountId));
    setScheduleModalOpen(true);
  };

  const selectQuote = (quoteId: string) => openScheduleModal(quoteId);

  const rescheduleFailedQuote = (post: ScheduledPost) => {
    openScheduleModal(post.quoteImageId, post.instagramAccountId);
  };

  const selectAccount = (accountId: number) => {
    if (!accountId) {
      setSelectedAccountId(null);
      return;
    }

    setSelectedAccountId(accountId);
    setScheduledAt(getSuggestedScheduleTime(accountId));
  };

  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId
  );
  const selectedQuote = quoteImages.find((quote) => quote.id === selectedQuoteId);
  const scheduledQuoteIds = new Set(
    scheduledPosts.map((post) => post.quoteImageId)
  );
  const availableQuoteImages = quoteImages.filter(
    (quote) => !scheduledQuoteIds.has(quote.id)
  );
  const getPostStatus = (post: ScheduledPost) => {
    if (post.posted) return 'posted';
    return new Date(post.scheduledAt).getTime() < Date.now()
      ? 'failed'
      : 'scheduled';
  };
  const filteredScheduledPosts = scheduledPosts
    .filter(
      (post) =>
        scheduleStatusFilter === 'all' ||
        getPostStatus(post) === scheduleStatusFilter
    )
    .sort((first, second) => {
      const difference =
        new Date(first.scheduledAt).getTime() -
        new Date(second.scheduledAt).getTime();

      return scheduleTimeSort === 'asc' ? difference : -difference;
    });

  return (
    <section className="page studio">
      <p className="eyebrow">SOCIAL PUBLISHING</p>
      <h1>Schedule</h1>
      <p className="intro">
        Connect your social accounts and choose the quotes you want to publish.
      </p>

      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Clear scheduling menu */}
        <aside
          className="studioSection"
          style={{
            padding: 10,
            position: 'sticky',
            top: 20,
          }}
        >
          <p
            className="eyebrow"
            style={{
              padding: '8px 12px',
              marginBottom: 8,
            }}
          >
            PUBLISHING
          </p>

          <button
            type="button"
            onClick={() => setTab('quotes')}
            className={tab === 'quotes' ? 'gold' : 'textButton'}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 10,
            }}
          >
            <strong>Quotes</strong>
            <span
              className="small"
              style={{ display: 'block', marginTop: 4 }}
            >
              {availableQuoteImages.length} available
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('scheduled')}
            className={tab === 'scheduled' ? 'gold' : 'textButton'}
            style={{
              width: '100%',
              textAlign: 'left',
              marginTop: 8,
              padding: '12px 14px',
              borderRadius: 10,
            }}
          >
            <strong>Scheduled quotes</strong>
            <span
              className="small"
              style={{ display: 'block', marginTop: 4 }}
            >
              {scheduledPosts.length} total
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={tab === 'accounts' ? 'gold' : 'textButton'}
            style={{
              width: '100%',
              textAlign: 'left',
              marginTop: 8,
              padding: '12px 14px',
              borderRadius: 10,
            }}
          >
            <strong>Social Connected Accounts</strong>
            <span
              className="small"
              style={{ display: 'block', marginTop: 4 }}
            >
              {accounts.length} connected
            </span>
          </button>
        </aside>

        {/* Main content */}
        <main className="studioSection">
          {tab === 'accounts' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <p className="eyebrow">SOCIAL</p>
                  <h2>Connected Accounts</h2>
                  <p className="small">
                    Instagram accounts connected to PhraseX for publishing.
                  </p>
                </div>

                <button
                  type="button"
                  className="gold"
                  onClick={connectWithInstagram}
                  disabled={busy}
                >
                  Connect Instagram
                </button>
              </div>

              {accounts.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    border: '1px dashed rgba(0, 0, 0, 0.15)',
                    borderRadius: 12,
                  }}
                >
                  <strong>No social accounts connected</strong>
                  <p className="small">
                    Connect Instagram to start scheduling your PhraseX quotes.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: 16,
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: 12,
                      }}
                    >
                      <div>
                        <strong>{account.displayName}</strong>
                        <div className="small">
                          Instagram ID: {account.instagramUserId}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          className="textButton"
                          onClick={() => selectAccount(account.id)}
                        >
                          Use
                        </button>

                        <button
                          type="button"
                          className="textButton"
                          onClick={() => disconnectAccount(account.id)}
                          disabled={busy}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: 28,
                  paddingTop: 20,
                  borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <h3>Manual account</h3>
                <p className="small">
                  Manual token entry is available for development only.
                </p>

                <label>
                  Instagram user ID
                  <input
                    value={accountForm.instagramUserId}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        instagramUserId: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Display name
                  <input
                    value={accountForm.displayName}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        displayName: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Access token
                  <input
                    value={accountForm.accessToken}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        accessToken: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Refresh token
                  <input
                    value={accountForm.refreshToken}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        refreshToken: e.target.value,
                      })
                    }
                  />
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="gold"
                    onClick={saveAccount}
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Save account'}
                  </button>

                  <button
                    type="button"
                    className="textButton"
                    onClick={refresh}
                    disabled={busy}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'quotes' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <p className="eyebrow">CONTENT</p>
                <h2>Quotes</h2>
                <p className="small">
                  Choose a saved quote image and schedule it for a connected
                  social account.
                </p>
              </div>

              {availableQuoteImages.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    border: '1px dashed rgba(0, 0, 0, 0.15)',
                    borderRadius: 12,
                  }}
                >
                  <strong>No unscheduled quote images available</strong>
                  <p className="small">
                    Create a new quote image, or review the existing ones in
                    Scheduled quotes.
                  </p>
                </div>
              ) : (
                <div className="scheduleQuoteGrid">
                  {availableQuoteImages.map((quote) => (
                    <button
                      type="button"
                      key={quote.id}
                      className={`scheduleQuoteCard${selectedQuoteId === quote.id ? ' isSelected' : ''
                        }`}
                      onClick={() => selectQuote(quote.id)}
                      aria-pressed={selectedQuoteId === quote.id}
                    >
                      {quote.finalImageUrl && (
                        <img
                          src={`${import.meta.env.VITE_IMAGE_URL}${quote.finalImageUrl}`}
                          alt={quote.quote}
                        />
                      )}

                      <span className="scheduleQuoteCardBody">
                        <strong>{quote.quote}</strong>

                        <span className="small">— {quote.author}</span>

                        {quote.category && (
                          <span className="small">{quote.category}</span>
                        )}

                        <span className="scheduleQuoteSelection">
                          {selectedQuoteId === quote.id
                            ? 'Selected for scheduling'
                            : 'Select quote'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {tab === 'scheduled' && (
            <div>
              <div className="scheduleQueueHeader">
                <div>
                  <p className="eyebrow">QUEUE</p>
                  <h2>Scheduled quotes</h2>
                  <p className="small">
                    Failed means the scheduled time has passed and the post has
                    not been marked as posted.
                  </p>
                </div>

                <button
                  type="button"
                  className="textButton"
                  onClick={refresh}
                  disabled={busy}
                >
                  Refresh
                </button>
              </div>

              <div className="scheduleFilters" aria-label="Filter scheduled quotes">
                {(['all', 'scheduled', 'posted', 'failed'] as const).map(
                  (status) => (
                    <button
                      type="button"
                      key={status}
                      className={
                        scheduleStatusFilter === status ? 'isActive' : ''
                      }
                      onClick={() => setScheduleStatusFilter(status)}
                      aria-pressed={scheduleStatusFilter === status}
                    >
                      {status[0].toUpperCase() + status.slice(1)}
                    </button>
                  )
                )}
              </div>

              {filteredScheduledPosts.length ? (
                <div className="scheduleTableWrap">
                  <table className="scheduleTable">
                    <thead>
                      <tr>
                        <th>Preview</th>
                        <th>Quote</th>
                        <th>Account</th>
                        <th aria-sort={scheduleTimeSort === 'asc' ? 'ascending' : 'descending'}>
                          <button
                            type="button"
                            className="scheduleTimeSort"
                            onClick={() =>
                              setScheduleTimeSort((current) =>
                                current === 'asc' ? 'desc' : 'asc'
                              )
                            }
                          >
                            Scheduled for {scheduleTimeSort === 'asc' ? '↑' : '↓'}
                          </button>
                        </th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScheduledPosts.map((post) => {
                        const status = getPostStatus(post);

                        return (
                          <tr key={post.id}>
                            <td>
                              {post.quoteImage.finalImageUrl ? (
                                <button
                                  type="button"
                                  className="scheduleThumbnail"
                                  onClick={() => setPreviewQuote(post.quoteImage)}
                                  aria-label={`Preview quote: ${post.quoteImage.quote}`}
                                >
                                  <img
                                    src={`${import.meta.env.VITE_IMAGE_URL}${post.quoteImage.finalImageUrl}`}
                                    alt=""
                                  />
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              <strong>{post.quoteImage.quote}</strong>
                              <span className="small">
                                — {post.quoteImage.author}
                              </span>
                            </td>
                            <td>{post.instagramAccountDisplayName}</td>
                            <td>{new Date(post.scheduledAt).toLocaleString()}</td>
                            <td>
                              <span className={`scheduleStatus ${status}`}>
                                {status[0].toUpperCase() + status.slice(1)}
                              </span>
                              {status === 'failed' && (
                                <button
                                  type="button"
                                  className="scheduleReschedule"
                                  onClick={() => rescheduleFailedQuote(post)}
                                >
                                  Reschedule
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small">No quotes match this filter.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {scheduleModalOpen && selectedQuote && (
        <div
          className="modal"
          role="presentation"
          onMouseDown={() => !busy && setScheduleModalOpen(false)}
        >
          <section
            className="dialog scheduleDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="scheduleDialogClose"
              onClick={() => setScheduleModalOpen(false)}
              aria-label="Close scheduling dialog"
              disabled={busy}
            >
              <X size={18} />
            </button>

            <p className="eyebrow">SCHEDULE QUOTE</p>
            <h2 id="schedule-dialog-title">Schedule this post</h2>
            <p className="small scheduleDialogQuote">
              “{selectedQuote.quote}” — {selectedQuote.author}
            </p>

            {accounts.length === 0 ? (
              <p className="small">
                Connect an Instagram account before scheduling this quote.
              </p>
            ) : (
              <>
                <label>
                  Instagram account
                  <select
                    value={selectedAccountId ?? ''}
                    onChange={(e) => selectAccount(Number(e.target.value))}
                  >
                    <option value="">Choose an Instagram account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Scheduled time
                  <select
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  >
                    {getScheduleOptions(scheduledAt).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="scheduleSuggestion">
                  Proposed time: <strong>{new Date(scheduledAt).toLocaleString()}</strong>
                  {selectedAccount
                    ? ` — three hours after ${selectedAccount.displayName}'s latest scheduled post.`
                    : ' — three hours after the latest scheduled post.'}
                </p>

                <button
                  type="button"
                  className="gold"
                  onClick={saveSchedule}
                  disabled={busy || !selectedAccountId || !scheduledAt}
                >
                  {busy ? 'Scheduling…' : 'Schedule post'}
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {previewQuote && (
        <div
          className="modal"
          role="presentation"
          onMouseDown={() => setPreviewQuote(null)}
        >
          <section
            className="dialog quotePreviewDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="scheduleDialogClose"
              onClick={() => setPreviewQuote(null)}
              aria-label="Close quote preview"
            >
              <X size={18} />
            </button>

            <h2 id="quote-preview-title">Quote preview</h2>
            <img
              className="quotePreviewImage"
              src={`${import.meta.env.VITE_IMAGE_URL}${previewQuote.finalImageUrl}`}
              alt={previewQuote.quote}
            />
            <p className="small">
              “{previewQuote.quote}” — {previewQuote.author}
            </p>
          </section>
        </div>
      )}
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
